import { useRef, useState } from 'react';
import { MAX_DATA_PACK_BYTES } from '@bm27/schema';
import { isDesktop, pickTextFile } from './platform';
import type { DataPackSummary } from './protocol';

export function DataPackPanel(props: {
  selected: DataPackSummary | null;
  busy: boolean;
  onSelect: (json: string | null) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const open = async (): Promise<void> => {
    setError('');
    if (!isDesktop()) {
      input.current?.click();
      return;
    }
    try {
      const json = await pickTextFile();
      if (json !== null) await props.onSelect(json);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <section className="data-pack-selector" aria-label="Datos para una nueva partida">
      <h2>Datos para una nueva partida</h2>
      <p>{props.selected ? props.selected.name : 'Universo predeterminado de BM27'}</p>
      {props.selected && (
        <>
          <p className="note">{props.selected.description}</p>
          <p className="note">
            {props.selected.definedClubs
              ? `${props.selected.definedClubs} clubes definidos individualmente. Jugadores generados.`
              : 'Clubes y jugadores generados a partir de listas de nombres.'}
          </p>
          <ul>
            {props.selected.competitions.map((competition) => (
              <li key={competition.id}>
                {competition.name} · {competition.teams} clubes
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="bar">
        <button
          disabled={props.busy}
          onClick={() => {
            void open();
          }}
        >
          Cargar paquete de datos
        </button>
        <button
          disabled={props.busy || !props.selected}
          onClick={() => {
            setError('');
            void props.onSelect(null);
          }}
        >
          Usar datos predeterminados
        </button>
      </div>
      <p className="note">
        Se aplica al pulsar «Generar universo». Elige un archivo JSON de hasta 2 MiB.
      </p>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        data-testid="data-pack-file"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          setError('');
          if (!file) return;
          if (file.size > MAX_DATA_PACK_BYTES) {
            setError('El paquete supera el límite de 2 MiB.');
            return;
          }
          try {
            await props.onSelect(await file.text());
          } catch (error) {
            setError(error instanceof Error ? error.message : String(error));
          }
        }}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
