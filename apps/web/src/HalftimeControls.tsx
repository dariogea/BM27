import { useEffect, useRef, useState } from 'react';
import type { HalftimeTactics } from '@bm27/core';
import { TACTIC_LABELS } from './MatchView';

export function describeHalftime(tactics: HalftimeTactics): string {
  return `Ritmo ${TACTIC_LABELS.pace[1][tactics.pace]} · presión ${TACTIC_LABELS.pressure[1][tactics.pressure]}`;
}

export function HalftimeControls(props: {
  club: string;
  initial: HalftimeTactics;
  ready: boolean;
  busy: boolean;
  onContinue: (tactics?: HalftimeTactics) => void;
  onCancel: () => void;
}) {
  const [tactics, setTactics] = useState(props.initial);
  const firstOption = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (props.ready) firstOption.current?.focus();
  }, [props.ready]);

  const changed =
    tactics.pace !== props.initial.pace || tactics.pressure !== props.initial.pressure;

  return (
    <section className="replay-viewer" aria-label="Instrucciones al descanso">
      {props.ready && (
        <>
          <h2>Descanso</h2>
          <p>Instrucciones para {props.club} en lo que queda de partido.</p>
          <div className="bar">
            <label>
              Ritmo al descanso
              <select
                ref={firstOption}
                value={tactics.pace}
                disabled={props.busy}
                onChange={(event) =>
                  setTactics({ ...tactics, pace: event.target.value as HalftimeTactics['pace'] })
                }
              >
                {Object.entries(TACTIC_LABELS.pace[1]).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Presión al descanso
              <select
                value={tactics.pressure}
                disabled={props.busy}
                onChange={(event) =>
                  setTactics({
                    ...tactics,
                    pressure: event.target.value as HalftimeTactics['pressure'],
                  })
                }
              >
                {Object.entries(TACTIC_LABELS.pressure[1]).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={props.busy}
              onClick={() => props.onContinue(changed ? tactics : undefined)}
            >
              Jugar segunda mitad
            </button>
          </div>
        </>
      )}
      <button type="button" disabled={props.busy} onClick={props.onCancel}>
        Volver sin jugar la jornada
      </button>
    </section>
  );
}
