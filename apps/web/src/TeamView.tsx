import type { Position, TeamTactics } from '@bm27/schema';
import { useState } from 'react';
import { TACTIC_LABELS, minutes } from './MatchView';
import type { MyTeamView, OffseasonReport, SquadPlayer } from './protocol';
import './panels.css';

const POSITION_LABELS: Record<Position, string> = {
  PG: 'Base',
  SG: 'Escolta',
  SF: 'Alero',
  PF: 'Ala-pívot',
  C: 'Pívot',
};
const SLOT_NAMES = ['Base', 'Escolta', 'Alero', 'Ala-pívot', 'Pívot'];

const TACTIC_HELP: Record<keyof TeamTactics, string> = {
  pace: 'Rápido: más posesiones y contraataques, pero más pérdidas y cansancio.',
  offenseFocus: 'Interior: más poste, cortes y tiros libres. Exterior: más triples.',
  defenseScheme: 'La zona protege la pintura y comete menos faltas, pero concede triples.',
  pickAndRollCoverage:
    'Hundirse regala media distancia; el dos contra uno fuerza pérdidas pero deja tiradores solos.',
  pressure: 'Alta: más robos a cambio de más faltas y más cansancio.',
  offensiveRebounding: 'Cargar gana rebotes de ataque pero concede contraataques.',
  rotationDepth: 'Cuántos jugadores entran en el reparto de minutos.',
};

const per = (total: number, games: number): string => (games ? (total / games).toFixed(1) : '–');

type SortKey =
  | 'order'
  | 'name'
  | 'pos'
  | 'age'
  | 'height'
  | 'overall'
  | 'potential'
  | 'close'
  | 'mid'
  | 'three'
  | 'pass'
  | 'handle'
  | 'perimeter'
  | 'interior'
  | 'rebound'
  | 'speed'
  | 'stamina'
  | 'salary'
  | 'until'
  | 'games'
  | 'minutes'
  | 'points'
  | 'rebounds'
  | 'assists';

/** Numeric value used to sort a row by a column (text columns sort alphabetically). */
function sortValue(row: SquadPlayer, key: SortKey): number | string {
  const { player: p, stats, contract } = row;
  const a = p.attributes;
  const games = stats?.games ?? 0;
  const avg = (total: number): number => (games ? total / games : -1);
  switch (key) {
    case 'name':
      return `${p.lastName} ${p.firstName}`;
    case 'pos':
      return p.positions[0] ?? '';
    case 'age':
      return p.age;
    case 'height':
      return p.heightCm;
    case 'overall':
      return row.overall;
    case 'potential':
      return p.potential;
    case 'close':
      return a.offensive.closeShot;
    case 'mid':
      return a.offensive.midRange;
    case 'three':
      return a.offensive.threePoint;
    case 'pass':
      return a.offensive.passing;
    case 'handle':
      return a.offensive.ballHandling;
    case 'perimeter':
      return a.defensive.perimeterDefense;
    case 'interior':
      return a.defensive.interiorDefense;
    case 'rebound':
      return a.defensive.defensiveRebound;
    case 'speed':
      return a.physical.speed;
    case 'stamina':
      return a.physical.stamina;
    case 'salary':
      return contract?.salary ?? -1;
    case 'until':
      return contract?.endSeason ?? -1;
    case 'games':
      return games;
    case 'minutes':
      return avg(stats?.seconds ?? 0);
    case 'points':
      return avg(stats?.points ?? 0);
    case 'rebounds':
      return avg((stats?.offensiveRebounds ?? 0) + (stats?.defensiveRebounds ?? 0));
    case 'assists':
      return avg(stats?.assists ?? 0);
    default:
      return 0;
  }
}

/** Colour tier of an attribute (1 weak … 5 elite). The number is always shown too. */
const tier = (value: number): number =>
  value >= 85 ? 5 : value >= 75 ? 4 : value >= 60 ? 3 : value >= 45 ? 2 : 1;

const TIER_LABELS = ['', 'bajo', 'justo', 'bueno', 'muy bueno', 'élite'];

function Attr({ value }: { value: number }) {
  return (
    <td className={`attr attr-t${tier(value)}`} title={TIER_LABELS[tier(value)]}>
      {value}
    </td>
  );
}

export function SquadTable({ squad }: { squad: SquadPlayer[] }) {
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({
    key: 'order',
    descending: false,
  });
  const rows = squad.map((row, index) => ({ row, index }));
  if (sort.key !== 'order') {
    rows.sort((x, y) => {
      const a = sortValue(x.row, sort.key);
      const b = sortValue(y.row, sort.key);
      const order =
        typeof a === 'string' || typeof b === 'string'
          ? String(a).localeCompare(String(b), 'es')
          : a - b;
      return (sort.descending ? -order : order) || x.index - y.index;
    });
  }
  const header = (key: SortKey, label: string, title?: string, className?: string) => {
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
                : { key, descending: key !== 'name' && key !== 'pos' },
            )
          }
        >
          {label}
          <span aria-hidden="true">{active ? (sort.descending ? ' ▼' : ' ▲') : ''}</span>
        </button>
      </th>
    );
  };
  return (
    <div className="scroll" tabIndex={0} role="region" aria-label="Plantilla y estadísticas">
      <table className="squad-table">
        <thead>
          <tr>
            {header('name', 'Jugador', 'Ordenar por nombre', 'name')}
            {header('pos', 'Pos')}
            {header('age', 'Edad')}
            {header('height', 'Alt')}
            {header('overall', 'VAL', 'Valoración global')}
            {header(
              'potential',
              'POT',
              'Techo de habilidad si se desarrolla del todo (solo lo ves en tu equipo)',
            )}
            {header('close', 'Aro', 'Tiro cerca del aro')}
            {header('mid', 'Med', 'Media distancia')}
            {header('three', 'Tri', 'Triple')}
            {header('pass', 'Pas', 'Pase')}
            {header('handle', 'Bot', 'Bote')}
            {header('perimeter', 'DEx', 'Defensa exterior')}
            {header('interior', 'DIn', 'Defensa interior')}
            {header('rebound', 'Reb', 'Rebote defensivo')}
            {header('speed', 'Vel', 'Velocidad')}
            {header('stamina', 'Res', 'Resistencia')}
            {header('salary', 'Salario', 'Salario anual')}
            {header('until', 'Hasta', 'Última temporada del contrato')}
            {header('games', 'PJ')}
            {header('minutes', 'MIN')}
            {header('points', 'PTS')}
            {header('rebounds', 'REB')}
            {header('assists', 'AS')}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row, index }) => {
            const { player: p, overall, stats, contract, expired } = row;
            const a = p.attributes;
            const games = stats?.games ?? 0;
            return (
              <tr key={p.id} className={index < 5 ? 'starter' : ''}>
                <td className="name">
                  {p.firstName} {p.lastName}
                  {index < 5 ? ' *' : ''}
                  {p.injury ? (
                    <span
                      className="badge badge-injury"
                      title="Lesionado: no juega hasta que se recupere"
                    >
                      Lesión · {p.injury.gamesRemaining}{' '}
                      {p.injury.gamesRemaining === 1 ? 'partido' : 'partidos'}
                    </span>
                  ) : null}
                </td>
                <td>{p.positions.join('/')}</td>
                <td>{p.age}</td>
                <td>{p.heightCm}</td>
                <Attr value={Math.round(overall)} />
                <Attr value={p.potential} />
                <Attr value={a.offensive.closeShot} />
                <Attr value={a.offensive.midRange} />
                <Attr value={a.offensive.threePoint} />
                <Attr value={a.offensive.passing} />
                <Attr value={a.offensive.ballHandling} />
                <Attr value={a.defensive.perimeterDefense} />
                <Attr value={a.defensive.interiorDefense} />
                <Attr value={a.defensive.defensiveRebound} />
                <Attr value={a.physical.speed} />
                <Attr value={a.physical.stamina} />
                <td>{contract ? `${Math.round(contract.salary / 1000)} k€` : '–'}</td>
                <td>
                  {contract ? contract.endSeason : '–'}
                  {expired ? (
                    <span className="badge badge-expired" title="Contrato cumplido: renuévalo">
                      Cumplido
                    </span>
                  ) : null}
                </td>
                <td>{games || '–'}</td>
                <td>{stats && games ? minutes(Math.round(stats.seconds / games)) : '–'}</td>
                <td>{per(stats?.points ?? 0, games)}</td>
                <td>
                  {per((stats?.offensiveRebounds ?? 0) + (stats?.defensiveRebounds ?? 0), games)}
                </td>
                <td>{per(stats?.assists ?? 0, games)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="note">
        * titular en el próximo partido. Atributos (1–99):{' '}
        <span className="attr attr-t1">bajo</span> <span className="attr attr-t2">justo</span>{' '}
        <span className="attr attr-t3">bueno</span> <span className="attr attr-t4">muy bueno</span>{' '}
        <span className="attr attr-t5">élite</span>. MIN, PTS, REB y AS por partido.
      </p>
    </div>
  );
}

const signed = (n: number): string => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));

/** Who improved, who declined and who retired when the season ended. */
export function OffseasonPanel({ report }: { report: OffseasonReport }) {
  const stayed = report.rows
    .filter((r) => !r.retired)
    .map((r) => ({ ...r, change: r.abilityAfter - r.abilityBefore }))
    .sort((a, b) => b.change - a.change);
  const retired = report.rows.filter((r) => r.retired);
  return (
    <div className="panel" data-testid="offseason">
      <h3>Fin de la temporada {report.seasonNumber}: evolución de tu plantilla</h3>
      <p className="note">Habilidad media de los 20 atributos.</p>
      <table>
        <thead>
          <tr>
            <th className="name">Jugador</th>
            <th>Edad</th>
            <th>Antes</th>
            <th>Ahora</th>
            <th>Cambio</th>
            <th>POT</th>
          </tr>
        </thead>
        <tbody>
          {stayed.map((r) => (
            <tr key={r.playerId} className={r.change >= 1 ? 'up' : r.change <= -1 ? 'down' : ''}>
              <td className="name">{r.name}</td>
              <td>{r.age + 1}</td>
              <td>{r.abilityBefore.toFixed(1)}</td>
              <td>{r.abilityAfter.toFixed(1)}</td>
              <td>
                <strong>{signed(r.change)}</strong>
              </td>
              <td>{r.potential}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {retired.length > 0 && (
        <p>
          <strong>Se retiran:</strong>{' '}
          {retired
            .map((r) => `${r.name} (${r.age + 1} años, habilidad ${r.abilityAfter.toFixed(0)})`)
            .join(', ')}
          .
        </p>
      )}
      {report.arrivals.length > 0 && (
        <p>
          <strong>Llegan jóvenes a la plantilla:</strong>{' '}
          {report.arrivals
            .map(
              (a) =>
                `${a.name} (${a.age} años, habilidad ${a.ability.toFixed(0)}, potencial ${a.potential})`,
            )
            .join(', ')}
          .
        </p>
      )}
    </div>
  );
}

export function TacticsEditor(props: {
  team: MyTeamView;
  busy: boolean;
  onSave: (tactics: TeamTactics) => void;
}) {
  const [draft, setDraft] = useState<TeamTactics>(props.team.tactics);
  const changed = JSON.stringify(draft) !== JSON.stringify(props.team.tactics);
  const keys = Object.keys(TACTIC_LABELS) as (keyof TeamTactics)[];
  return (
    <div>
      <table>
        <tbody>
          {keys.map((key) => {
            const [label, values] = TACTIC_LABELS[key];
            return (
              <tr key={key}>
                <td className="name">
                  <strong>{label}</strong>
                </td>
                <td className="name">
                  {key === 'rotationDepth' ? (
                    <select
                      aria-label={label}
                      value={draft.rotationDepth}
                      onChange={(e) =>
                        setDraft({ ...draft, rotationDepth: Number(e.target.value) })
                      }
                    >
                      {[7, 8, 9, 10, 11, 12].map((n) => (
                        <option key={n} value={n}>
                          {n} jugadores
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      aria-label={label}
                      value={draft[key]}
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.value } as TeamTactics)}
                    >
                      {Object.entries(values).map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="name note">{TACTIC_HELP[key]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="bar">
        <button disabled={props.busy || !changed} onClick={() => props.onSave(draft)}>
          Guardar tácticas
        </button>
        {changed && <span className="note">Hay cambios sin guardar.</span>}
      </div>
    </div>
  );
}

export function LineupEditor(props: {
  team: MyTeamView;
  busy: boolean;
  onSave: (playerIds: string[] | null) => void;
}) {
  const initial = props.team.squad.map((s) => s.player.id);
  const [order, setOrder] = useState<string[]>(initial);
  const byId = new Map(props.team.squad.map((s) => [s.player.id, s]));
  const changed = order.join() !== initial.join();
  const move = (index: number, delta: number): void => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = order.slice();
    [next[index], next[target]] = [next[target] as string, next[index] as string];
    setOrder(next);
  };
  return (
    <div>
      <p className="note">
        Prioridad de rotación ·{' '}
        <strong>
          {props.team.rotation ? 'quinteto elegido por ti' : 'lo decide el entrenador'}
        </strong>
        .
      </p>
      <table data-testid="lineup">
        <thead>
          <tr>
            <th>#</th>
            <th className="name">Puesto</th>
            <th className="name">Jugador</th>
            <th className="name">Posición natural</th>
            <th>VAL</th>
            <th>Mover</th>
          </tr>
        </thead>
        <tbody>
          {order.map((id, index) => {
            const entry = byId.get(id);
            if (!entry) return null;
            const p = entry.player;
            const natural = p.positions.map((pos) => POSITION_LABELS[pos]);
            const outOfPosition = index < 5 && !natural.includes(SLOT_NAMES[index] as string);
            return (
              <tr key={id} className={index < 5 ? 'starter' : ''}>
                <td>{index + 1}</td>
                <td className="name">{index < 5 ? SLOT_NAMES[index] : 'Banquillo'}</td>
                <td className="name">
                  {p.firstName} {p.lastName}
                </td>
                <td className="name">
                  {natural.join(' / ')}
                  {outOfPosition ? ' ⚠ fuera de posición' : ''}
                </td>
                <td>{entry.overall.toFixed(0)}</td>
                <td>
                  <button disabled={index === 0} onClick={() => move(index, -1)} aria-label="Subir">
                    ↑
                  </button>{' '}
                  <button
                    disabled={index === order.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label="Bajar"
                  >
                    ↓
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="bar">
        <button disabled={props.busy || !changed} onClick={() => props.onSave(order)}>
          Guardar quinteto
        </button>
        <button disabled={props.busy || !props.team.rotation} onClick={() => props.onSave(null)}>
          Que decida el entrenador
        </button>
        {changed && <span className="note">Hay cambios sin guardar.</span>}
      </div>
    </div>
  );
}
