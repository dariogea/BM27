import { useState } from 'react';
import { automaticSaveLabel, type SlotSummary } from './slotStore';

interface Props {
  slots: SlotSummary[] | null;
  busy: boolean;
  canSave: boolean;
  autosave: boolean;
  onSave: (name: string) => void;
  onLoad: (name: string) => void;
  onDelete: (name: string) => void;
  onRename: (name: string, next: string) => void;
  onAutosave: (enabled: boolean) => void;
  onRefresh: () => void;
}
function SavedRow({
  slot,
  busy,
  onLoad,
  onDelete,
  onRename,
}: Pick<Props, 'busy' | 'onLoad' | 'onDelete' | 'onRename'> & { slot: SlotSummary }) {
  const [name, setName] = useState(slot.name);
  return (
    <tr>
      <td>
        {slot.automatic ? (
          <strong>{automaticSaveLabel(slot.name)}</strong>
        ) : (
          <label>
            Nombre{' '}
            <input
              aria-label={`Nombre de ${slot.name}`}
              value={name}
              maxLength={80}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
      </td>
      <td>
        {slot.team}
        <br />
        Temporada {slot.season}
        <br />
        <small>Semilla: {slot.seed}</small>
      </td>
      <td>
        {new Date(slot.updatedAt).toLocaleString('es-ES')}
        <br />
        {(slot.bytes / 1024 / 1024).toFixed(2)} MB
      </td>
      <td>
        <button disabled={busy} onClick={() => onLoad(slot.name)}>
          Cargar
        </button>{' '}
        {!slot.automatic && (
          <button
            disabled={busy || !name.trim() || name.trim() === slot.name}
            onClick={() => onRename(slot.name, name)}
          >
            Renombrar
          </button>
        )}{' '}
        <button disabled={busy} onClick={() => onDelete(slot.name)}>
          Eliminar
        </button>
      </td>
    </tr>
  );
}
export function SavesPanel(props: Props) {
  const [name, setName] = useState('Mi partida');
  return (
    <section>
      {props.canSave ? (
        <h2>Partidas de este dispositivo</h2>
      ) : (
        <h1>Partidas de este dispositivo</h1>
      )}
      <p className="note">
        Borrar los datos de esta aplicación o navegador elimina sus guardados internos. Los archivos
        exportados son independientes.
      </p>
      <div className="bar">
        <label>
          Nombre del guardado{' '}
          <input
            value={name}
            maxLength={80}
            disabled={props.busy}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button
          disabled={props.busy || !props.canSave || !name.trim() || props.slots === null}
          onClick={() => props.onSave(name)}
        >
          Guardar / sobrescribir
        </button>
        <button disabled={props.busy} onClick={props.onRefresh}>
          Actualizar lista
        </button>
      </div>

      <label>
        <input
          type="checkbox"
          checked={props.autosave}
          disabled={props.busy || props.slots === null}
          onChange={(e) => props.onAutosave(e.target.checked)}
        />{' '}
        Guardar automáticamente después de cada jornada
      </label>
      <p className="note">Se conserva el autoguardado más reciente y una copia del anterior.</p>
      {props.slots === null ? (
        <p>Lista de partidas no disponible.</p>
      ) : props.slots.length === 0 ? (
        <p>No hay partidas guardadas en este dispositivo.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <caption>Guardados internos disponibles</caption>
            <thead>
              <tr>
                <th scope="col">Partida</th>
                <th scope="col">Equipo y temporada</th>
                <th scope="col">Último guardado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {props.slots.map((s) => (
                <SavedRow
                  key={s.name}
                  slot={s}
                  busy={props.busy}
                  onLoad={props.onLoad}
                  onDelete={props.onDelete}
                  onRename={props.onRename}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
