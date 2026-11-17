import { queryLeagueRecords } from './leagueRecordsData';
import type { Universe } from '@bm27/schema';
import type { WorldPayload, WorldQuery } from './worldTypes';

const PAGE_SIZE = 40;
const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es');
const fullName = (player: { firstName: string; lastName: string }): string =>
  `${player.firstName} ${player.lastName}`;

/** Read-only projections for the Worker. No generator calls or random state are used. */
export function queryWorld(universe: Universe, query: WorldQuery): WorldPayload {
  if (query.type === 'worldRecords') return queryLeagueRecords(universe, query);
  const teams = new Map(universe.teams.map((team) => [team.id, team]));
  const competitions = new Map(
    universe.competitions.flatMap((competition) =>
      competition.teamIds.map((id) => [id, competition] as const),
    ),
  );
  if (query.type === 'worldSearch') {
    if (
      !['players', 'clubs'].includes(query.entity) ||
      typeof query.query !== 'string' ||
      query.query.length > 120 ||
      !Number.isSafeInteger(query.page) ||
      query.page < 0 ||
      typeof query.includeRetired !== 'boolean'
    )
      throw new Error('Consulta de búsqueda no válida.');
    if (query.competitionId && !universe.competitions.some((c) => c.id === query.competitionId))
      throw new Error('La competición no existe.');
    const text = fold(query.query.trim());
    const rows =
      query.entity === 'players'
        ? universe.players
            .filter(
              (p) =>
                (query.includeRetired || !p.retired) &&
                (!query.competitionId ||
                  (p.teamId && competitions.get(p.teamId)?.id === query.competitionId)) &&
                fold(fullName(p)).includes(text),
            )
            .map((p) => ({
              id: p.id,
              name: fullName(p),
              context: p.retired
                ? 'Retirado'
                : p.teamId
                  ? (teams.get(p.teamId)?.name ?? 'Club no disponible')
                  : 'Agente libre',
              competition: p.teamId ? (competitions.get(p.teamId)?.name ?? '—') : '—',
              detail: `${p.age} años · ${p.positions.join('/')}`,
            }))
        : universe.teams
            .filter(
              (team) =>
                (!query.competitionId || competitions.get(team.id)?.id === query.competitionId) &&
                fold(team.name).includes(text),
            )
            .map((team) => ({
              id: team.id,
              name: team.name,
              context: team.city,
              competition: competitions.get(team.id)?.name ?? '—',
              detail: `${team.playerIds.length} jugadores`,
            }));
    rows.sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id));
    const page = Math.min(query.page, Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1));
    return {
      kind: 'search',
      entity: query.entity,
      page,
      pageSize: PAGE_SIZE,
      total: rows.length,
      rows: rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    };
  }
  const records = [...universe.history]
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .flatMap((season) =>
      season.competitions.map((competition) => ({
        season: season.seasonNumber,
        competitionId: competition.competitionId,
        playerStats: competition.playerStats,
        matches: competition.matches,
      })),
    );
  if (universe.currentSeason)
    for (const competition of universe.currentSeason.competitions)
      records.push({
        season: universe.currentSeason.seasonNumber,
        competitionId: competition.competitionId,
        playerStats: competition.playerStats,
        matches: competition.matches,
      });
  if (query.type === 'worldPlayer') {
    const player = universe.players.find((p) => p.id === query.playerId);
    if (!player) throw new Error('El jugador no existe en esta partida.');
    const club = player.teamId ? teams.get(player.teamId) : undefined;
    return {
      kind: 'player',
      id: player.id,
      name: fullName(player),
      age: player.age,
      heightCm: player.heightCm,
      positions: player.positions,
      retired: player.retired,
      club: club ? { id: club.id, name: club.name } : null,
      attributes: player.attributes,
      potential:
        universe.userTeamId !== null && player.teamId === universe.userTeamId
          ? player.potential
          : null,
      contract: player.contract,
      injuryGames: player.injury?.gamesRemaining ?? 0,
      seasons: records
        .flatMap((record) =>
          record.playerStats
            .filter((stats) => stats.playerId === player.id)
            .map((stats) => ({
              season: record.season,
              teamName: teams.get(stats.teamId)?.name ?? stats.teamId,
              competitionName:
                universe.competitions.find((c) => c.id === record.competitionId)?.name ??
                record.competitionId,
              stats,
            })),
        )
        .reverse(),
    };
  }
  const team = teams.get(query.teamId);
  if (!team) throw new Error('El club no existe en esta partida.');
  const competition = competitions.get(team.id);
  return {
    kind: 'club',
    id: team.id,
    name: team.name,
    city: team.city,
    region: team.region,
    reputation: team.reputation,
    competition: competition?.name ?? 'Sin competición',
    salaryCap: competition?.salaryCap ?? 0,
    tactics: team.tactics,
    players: universe.players
      .filter((p) => p.teamId === team.id && !p.retired)
      .map((p) => ({ id: p.id, name: fullName(p), age: p.age, positions: p.positions }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id)),
    results: records
      .flatMap((record) =>
        record.matches
          .filter((match) => match.homeTeamId === team.id || match.awayTeamId === team.id)
          .map((match) => {
            const home = match.homeTeamId === team.id;
            const opponentId = home ? match.awayTeamId : match.homeTeamId;
            return {
              id: match.id,
              season: record.season,
              round: match.round,
              playoff: match.stage === 'playoff',
              opponent: teams.get(opponentId)?.name ?? opponentId,
              home,
              ownScore: home ? match.homeScore : match.awayScore,
              opponentScore: home ? match.awayScore : match.homeScore,
            };
          }),
      )
      .slice(-10)
      .reverse(),
  };
}
