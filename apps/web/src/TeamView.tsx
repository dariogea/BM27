import type { Position, TeamTactics } from '@bm27/schema';
import { useState } from 'react';
import { TACTIC_LABELS, minutes } from './MatchView';
import type { MyTeamView, OffseasonReport, SquadPlayer } from './protocol';

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

export function SquadTable({ squad }: { squad: SquadPlayer[] }) {
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th className="name">Jugador</th>
            <th>Pos</th>
            <th>Edad</th>
            <th>Alt</th>
            <th title="Valoración global">VAL</th>
            <th title="Techo de habilidad si se desarrolla del todo (solo lo ves en tu equipo)">
              POT
            </th>
            <th title="Tiro cerca del aro">Aro</th>
            <th title="Media distancia">Med</th>
            <th title="Triple">Tri</th>
            <th title="Pase">Pas</th>
            <th title="Bote">Bot</th>
            <th title="Defensa exterior">DEx</th>
            <th title="Defensa interior">DIn</th>
            <th title="Rebote defensivo">Reb</th>
            <th title="Velocidad">Vel</th>
            <th title="Resistencia">Res</th>
            <th>PJ</th>
            <th>MIN</th>
            <th>PTS</th>
            <th>REB</th>
            <th>AS</th>
          </tr>
        </thead>
        <tbody>
          {squad.map(({ player: p, overall, stats }, index) => {
            const a = p.attributes;
            const games = stats?.games ?? 0;
            return (
              <tr key={p.id} className={index < 5 ? 'starter' : ''}>
                <td className="name">
                  {p.firstName} {p.lastName}
                  {index < 5 ? ' *' : ''}
                </td>
                <td>{p.positions.join('/')}</td>
                <td>{p.age}</td>
                <td>{p.heightCm}</td>
                <td>
                  <strong>{overall.toFixed(0)}</strong>
                </td>
                <td>{p.potential}</td>
                <td>{a.offensive.closeShot}</td>
                <td>{a.offensive.midRange}</td>
                <td>{a.offensive.threePoint}</td>
                <td>{a.offensive.passing}</td>
                <td>{a.offensive.ballHandling}</td>
                <td>{a.defensive.perimeterDefense}</td>
                <td>{a.defensive.interiorDefense}</td>
                <td>{a.defensive.defensiveRebound}</td>
                <td>{a.physical.speed}</td>
                <td>{a.physical.stamina}</td>
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
        * titular en el próximo partido. Atributos de 1 a 99. Las medias (MIN, PTS, REB, AS) son por
        partido en la temporada en curso.
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
      <p className="note">
        Habilidad = media de los 20 atributos. Los jóvenes mejoran hacia su potencial y los
        veteranos pierden primero físico y luego técnica.
      </p>
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
      <p className="note">
        Todas las opciones tienen efecto real en el partido. Las cifras medidas de cada una están en
        el documento <code>docs/tacticas.md</code>.
      </p>
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
        Los cinco primeros son los titulares, cada uno en el puesto indicado. El resto es el
        banquillo: cuanto más arriba, más minutos. Estado actual:{' '}
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
