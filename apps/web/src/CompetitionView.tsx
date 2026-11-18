import { useMemo, useState } from 'react';
import { formOf, sortStandings, winShare, type StandingKey } from './competitionData';
import './panels.css';
import type { CompetitionViewData } from './protocol';

const FORM_LABELS = { W: 'Victoria', L: 'Derrota' } as const;

export function CompetitionView(props: {
  competition: CompetitionViewData;
  userTeamId: string | null;
  name: (teamId: string) => string;
  selectedMatchId: string;
  onMatch: (matchId: string) => void;
}) {
  const { competition, name } = props;
  const [stage, setStage] = useState<'regular' | 'playoff'>('regular');
  // null = follow the latest round played
  const [chosenRound, setRound] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: StandingKey; descending: boolean }>({
    key: 'position',
    descending: false,
  });
  const [onlyMine, setOnlyMine] = useState(false);
  const header = (key: StandingKey, label: string, title?: string, className?: string) => {
    const active = sort.key === key;
    return (
      <th
        className={className}
        title={title}
        aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : 'none'}
      >
        <button
          type="button"
          className="th-sort"
          onClick={() =>
            setSort(
              active
                ? { key, descending: !sort.descending }
                : {
                    key,
                    descending:
                      key !== 'name' &&
                      key !== 'position' &&
                      key !== 'pointsAgainst' &&
                      key !== 'losses',
                  },
            )
          }
        >
          {label}
          <span aria-hidden="true">{active ? (sort.descending ? ' ▼' : ' ▲') : ''}</span>
        </button>
      </th>
    );
  };
  const promoted = new Set(competition.promotedTeamIds);
  const relegated = new Set(competition.relegatedTeamIds);
  const inPlayoffs = new Set(
    competition.playoffSeries.flatMap((s) => [s.highSeedTeamId, s.lowSeedTeamId ?? '']),
  );

  const rounds = useMemo(() => {
    const set = new Set(competition.matches.filter((m) => m.stage === stage).map((m) => m.round));
    return [...set].sort((a, b) => a - b);
  }, [competition, stage]);
  const round = chosenRound ?? rounds[rounds.length - 1] ?? 1;
  const matches = competition.matches.filter(
    (m) =>
      m.stage === stage &&
      m.round === round &&
      (!onlyMine ||
        (props.userTeamId !== null &&
          (m.homeTeamId === props.userTeamId || m.awayTeamId === props.userTeamId))),
  );

  return (
    <section>
      <h2>
        Temporada {competition.seasonNumber} ·{' '}
        {competition.championTeamId
          ? `Campeón: ${name(competition.championTeamId)}`
          : competition.phase === 'playoffs'
            ? 'Playoffs en juego'
            : `Liga regular, jornada ${Math.max(1, ...competition.matches.filter((m) => m.stage === 'regular').map((m) => m.round))}`}
      </h2>
      <p className="note">
        <span className="up">Verde</span>: asciende · <span className="down">Rojo</span>: desciende
        · <span className="playoff">Azul</span>: juega playoffs. Desempates: victorias,
        enfrentamientos directos, diferencia de puntos. Pulsa una cabecera para ordenar (el orden
        oficial es «#»). «Forma»: últimos 5 resultados, el más reciente a la derecha.
      </p>
      <div className="columns">
        {competition.groups.map((group) => (
          <div
            key={group.name}
            className="scroll"
            tabIndex={0}
            role="region"
            aria-label={`Clasificación: ${group.name}`}
          >
            <h3>Clasificación · {group.name}</h3>
            <table>
              <thead>
                <tr>
                  {header('position', '#', 'Orden oficial de la clasificación')}
                  {header('name', 'Equipo', undefined, 'name')}
                  {header('played', 'PJ', 'Partidos jugados')}
                  {header('wins', 'G', 'Victorias')}
                  {header('losses', 'P', 'Derrotas')}
                  {header('pointsFor', 'PF', 'Puntos a favor')}
                  {header('pointsAgainst', 'PC', 'Puntos en contra')}
                  {header('difference', 'Dif', 'Diferencia de puntos')}
                  {header('percentage', '%G', 'Porcentaje de victorias')}
                  <th title="Últimos 5 resultados, el más reciente a la derecha">Forma</th>
                </tr>
              </thead>
              <tbody>
                {sortStandings(group.standings, sort.key, sort.descending, name).map((row) => (
                  <tr
                    key={row.teamId}
                    className={
                      (row.teamId === props.userTeamId ? 'mine ' : '') +
                      (promoted.has(row.teamId)
                        ? 'up'
                        : relegated.has(row.teamId)
                          ? 'down'
                          : inPlayoffs.has(row.teamId)
                            ? 'playoff'
                            : '')
                    }
                  >
                    <td>{row.position}</td>
                    <td className="name">{name(row.teamId)}</td>
                    <td>{row.played}</td>
                    <td>{row.wins}</td>
                    <td>{row.losses}</td>
                    <td>{row.pointsFor}</td>
                    <td>{row.pointsAgainst}</td>
                    <td>{row.pointsFor - row.pointsAgainst}</td>
                    <td>{row.played ? `${Math.round(100 * winShare(row))} %` : '–'}</td>
                    <td>
                      <span className="form">
                        {formOf(competition.matches, row.teamId).map((result, i) => (
                          <span
                            key={i}
                            className={`form-chip form-${result}`}
                            title={FORM_LABELS[result]}
                          >
                            {result === 'W' ? 'G' : 'P'}
                            <span className="sr-only"> ({FORM_LABELS[result]})</span>
                          </span>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {competition.playoffSeries.length > 0 && (
        <>
          <h3>Playoffs</h3>
          <div className="scroll" tabIndex={0} role="region" aria-label="Series de playoffs">
            <table>
              <thead>
                <tr>
                  <th>Ronda</th>
                  <th className="name">Mejor clasificado</th>
                  <th>Resultado</th>
                  <th className="name">Rival</th>
                  <th className="name">Pasa</th>
                </tr>
              </thead>
              <tbody>
                {competition.playoffSeries.map((s, i) => (
                  <tr key={i}>
                    <td>{s.round}</td>
                    <td className="name">
                      ({s.highSeed}) {name(s.highSeedTeamId)}
                    </td>
                    <td>{s.lowSeedTeamId ? `${s.highSeedWins}–${s.lowSeedWins}` : 'exento'}</td>
                    <td className="name">{s.lowSeedTeamId ? name(s.lowSeedTeamId) : '—'}</td>
                    <td className="name">{s.winnerTeamId ? name(s.winnerTeamId) : 'en juego'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3>Partidos</h3>
      <div className="bar">
        <select
          value={stage}
          onChange={(e) => {
            setStage(e.target.value as 'regular' | 'playoff');
            setRound(null);
          }}
          aria-label="Fase"
        >
          <option value="regular">Liga regular</option>
          <option value="playoff">Playoffs</option>
        </select>
        <select
          value={round}
          onChange={(e) => setRound(Number(e.target.value))}
          aria-label="Jornada"
        >
          {rounds.map((r) => (
            <option key={r} value={r}>
              {stage === 'regular' ? 'Jornada' : 'Ronda'} {r}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={onlyMine}
            disabled={props.userTeamId === null}
            onChange={(e) => setOnlyMine(e.target.checked)}
          />{' '}
          Solo mis partidos
        </label>
        <span className="note">
          Pulsa un partido (o usa Intro) para ver su box score. {matches.length}{' '}
          {matches.length === 1 ? 'partido' : 'partidos'}.
        </span>
      </div>
      <div className="scroll" tabIndex={0} role="region" aria-label="Partidos de la jornada">
        <table>
          <thead>
            <tr>
              <th className="name">Local</th>
              <th>Pts</th>
              <th>Pts</th>
              <th className="name">Visitante</th>
              <th>Prórrogas</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr
                key={m.id}
                className={`clickable ${m.id === props.selectedMatchId ? 'selected' : ''}`}
                tabIndex={0}
                aria-label={`Ver el box score: ${name(m.homeTeamId)} ${m.homeScore}, ${name(m.awayTeamId)} ${m.awayScore}`}
                aria-selected={m.id === props.selectedMatchId}
                onClick={() => props.onMatch(m.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    props.onMatch(m.id);
                  }
                }}
              >
                <td className="name">{name(m.homeTeamId)}</td>
                <td>{m.homeScore}</td>
                <td>{m.awayScore}</td>
                <td className="name">{name(m.awayTeamId)}</td>
                <td>{m.overtimePeriods || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
