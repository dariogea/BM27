import { useEffect, useRef, useState } from 'react';
import type { HalftimeChanges, HalftimeSettings } from '@bm27/core';
import { TACTIC_LABELS } from './MatchView';

const options = [
  'pace',
  'pressure',
  'offenseFocus',
  'defenseScheme',
  'pickAndRollCoverage',
  'offensiveRebounding',
] as const;

export function describeHalftime(tactics: HalftimeChanges): string {
  return options
    .flatMap((key) => {
      const value = tactics[key];
      const [label, values] = TACTIC_LABELS[key];
      return value === undefined ? [] : [`${label} ${values[value]}`];
    })
    .join(' · ');
}

export function HalftimeControls(props: {
  club: string;
  initial: HalftimeSettings;
  ready: boolean;
  busy: boolean;
  onContinue: (tactics?: HalftimeChanges) => void;
  onCancel: () => void;
}) {
  const [tactics, setTactics] = useState(props.initial);
  const firstOption = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (props.ready) firstOption.current?.focus();
  }, [props.ready]);

  const resume = () => {
    const changed = options.filter(
      (key) =>
        tactics[key] !== props.initial[key] &&
        (key !== 'pickAndRollCoverage' || tactics.defenseScheme === 'man'),
    );
    const changes = Object.fromEntries(changed.map((key) => [key, tactics[key]]));
    props.onContinue(changed.length ? changes : undefined);
  };

  return (
    <section className="replay-viewer" aria-label="Instrucciones al descanso">
      {props.ready && (
        <>
          <h2>Descanso</h2>
          <p>Instrucciones para {props.club} en lo que queda de partido.</p>
          <div className="bar halftime-tactics">
            {options.map((key) => {
              const [label, values] = TACTIC_LABELS[key];
              const zoneCoverage =
                key === 'pickAndRollCoverage' && tactics.defenseScheme === 'zone';
              return (
                <label key={key}>
                  {label} al descanso
                  <select
                    ref={key === 'pace' ? firstOption : undefined}
                    value={tactics[key]}
                    disabled={props.busy || zoneCoverage}
                    onChange={(event) => setTactics({ ...tactics, [key]: event.target.value })}
                  >
                    {Object.entries(values).map(([value, name]) => (
                      <option key={value} value={value}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
          <button type="button" disabled={props.busy} onClick={resume}>
            Jugar segunda mitad
          </button>
        </>
      )}
      <button type="button" disabled={props.busy} onClick={props.onCancel}>
        Volver sin jugar la jornada
      </button>
    </section>
  );
}
