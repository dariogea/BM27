import type { MatchDetail } from '@bm27/schema';
import { spreadsheetCsv } from './spreadsheetCsv';

export function matchCsv(
  { result, boxScore }: MatchDetail,
  playerNames: Record<string, string>,
  teamName: (id: string) => string,
): string {
  const header = [
    'Partido',
    'Temporada',
    'Fase',
    'Jornada o ronda',
    'Local',
    'Visitante',
    'Puntos local',
    'Puntos visitante',
    'Equipo',
    'Sede',
    'Jugador',
    'Titular',
    'Segundos en pista',
    'Puntos',
    'Tiros de campo anotados',
    'Tiros de campo intentados',
    'Triples anotados',
    'Triples intentados',
    'Tiros libres anotados',
    'Tiros libres intentados',
    'Rebotes ofensivos',
    'Rebotes defensivos',
    'Asistencias',
    'Robos',
    'Tapones',
    'Pérdidas',
    'Faltas',
  ];
  const home = teamName(result.homeTeamId);
  const away = teamName(result.awayTeamId);
  const rows = [boxScore.home, boxScore.away].flatMap((team) =>
    team.players
      .sort((a, b) => Number(b.starter) - Number(a.starter) || b.seconds - a.seconds)
      .map((p) => [
        result.id,
        result.seasonNumber,
        result.stage === 'regular' ? 'Liga regular' : 'Playoffs',
        result.round,
        home,
        away,
        result.homeScore,
        result.awayScore,
        team.teamId === result.homeTeamId ? home : away,
        team.teamId === result.homeTeamId ? 'Local' : 'Visitante',
        playerNames[p.playerId] ?? p.playerId,
        p.starter ? 'Sí' : 'No',
        p.seconds,
        p.points,
        p.fieldGoalsMade,
        p.fieldGoalsAttempted,
        p.threePointersMade,
        p.threePointersAttempted,
        p.freeThrowsMade,
        p.freeThrowsAttempted,
        p.offensiveRebounds,
        p.defensiveRebounds,
        p.assists,
        p.steals,
        p.blocks,
        p.turnovers,
        p.fouls,
      ]),
  );
  return spreadsheetCsv([header, ...rows]);
}
