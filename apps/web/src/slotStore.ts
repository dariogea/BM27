import { exportSave, importSave, type SaveStore } from '@bm27/core';
import type { Universe } from '@bm27/schema';

export const AUTO_SAVE = '__bm27_autosave__';
export const PREVIOUS_AUTO_SAVE = '__bm27_autosave_previous__';
export const isAutomaticSlot = (name: string): boolean =>
  name === AUTO_SAVE || name === PREVIOUS_AUTO_SAVE;
export const automaticSaveLabel = (name: string): string =>
  name === PREVIOUS_AUTO_SAVE ? 'Guardado automático anterior' : 'Guardado automático';
export interface SlotSummary {
  name: string;
  seed: string;
  season: number;
  team: string;
  updatedAt: string;
  bytes: number;
  automatic: boolean;
}
interface Payload {
  name: string;
  json: string;
}

const finished = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () =>
      reject(tx.error ?? new Error('La operación de almacenamiento se interrumpió.'));
  });
const requested = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
const checkedName = (name: string): string => {
  const value = name.trim();
  if (!value || value.length > 80) throw new Error('El nombre debe tener entre 1 y 80 caracteres.');
  return value;
};

/** IndexedDB is local to this application/origin. Portable files remain the backup route. */
export class IndexedDbSaveStore implements SaveStore {
  private connection: Promise<IDBDatabase> | null = null;
  constructor(
    private readonly factory: IDBFactory | undefined = globalThis.indexedDB,
    private readonly databaseName = 'bm27-saves-v1',
  ) {}

  private async perform<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError')
        throw new Error(
          'No queda espacio para guardar. Exporta tus partidas a archivo y elimina ranuras que ya no necesites.',
        );
      throw error;
    }
  }
  private open(): Promise<IDBDatabase> {
    if (!this.factory)
      return Promise.reject(
        new Error(
          'El almacenamiento interno no está disponible. Puedes guardar y cargar mediante archivos.',
        ),
      );
    if (!this.connection) {
      this.connection = new Promise<IDBDatabase>((resolve, reject) => {
        let blocked = false;
        const request = this.factory!.open(this.databaseName, 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('payloads', { keyPath: 'name' });
          request.result.createObjectStore('summaries', { keyPath: 'name' });
          request.result.createObjectStore('settings');
        };
        request.onsuccess = () => {
          const db = request.result;
          if (blocked) {
            db.close();
            return;
          }
          db.onversionchange = () => {
            db.close();
            this.connection = null;
          };
          resolve(db);
        };
        request.onerror = () => {
          this.connection = null;
          reject(request.error);
        };
        request.onblocked = () => {
          blocked = true;
          reject(new Error('Cierra otras ventanas de BM27 para actualizar el almacenamiento.'));
        };
      }).catch((error) => {
        this.connection = null;
        throw error;
      });
    }
    return this.connection;
  }
  private async read<T>(store: string, key: string): Promise<T | undefined> {
    const db = await this.open();
    const tx = db.transaction(store, 'readonly');
    const [value] = await Promise.all([
      requested(tx.objectStore(store).get(key) as IDBRequest<T | undefined>),
      finished(tx),
    ]);
    return value;
  }
  async save(name: string, universe: Universe): Promise<void> {
    name = checkedName(name);
    return this.perform(async () => {
      const json = exportSave(universe);
      const summary: SlotSummary = {
        name,
        seed: universe.seed,
        season: universe.seasonNumber,
        team: universe.teams.find((t) => t.id === universe.userTeamId)?.name ?? 'Sin equipo',
        updatedAt: new Date().toISOString(),
        bytes: new TextEncoder().encode(json).byteLength,
        automatic: isAutomaticSlot(name),
      };
      const db = await this.open();
      const tx = db.transaction(['payloads', 'summaries'], 'readwrite');
      const done = finished(tx);
      const data = tx.objectStore('payloads');
      const meta = tx.objectStore('summaries');
      if (name === AUTO_SAVE) {
        const previousData = data.get(AUTO_SAVE) as IDBRequest<Payload | undefined>;
        const previousSummary = meta.get(AUTO_SAVE) as IDBRequest<SlotSummary | undefined>;
        previousSummary.onsuccess = () => {
          if (previousData.result && previousSummary.result) {
            data.put({ ...previousData.result, name: PREVIOUS_AUTO_SAVE });
            meta.put({ ...previousSummary.result, name: PREVIOUS_AUTO_SAVE });
          }
        };
      }
      data.put({ name, json });
      meta.put(summary);
      await done;
    });
  }
  async load(name: string): Promise<Universe> {
    return this.perform(async () => {
      const row = await this.read<Payload>('payloads', checkedName(name));
      if (!row) throw new Error('No se encuentra esa partida guardada.');
      try {
        return importSave(row.json);
      } catch {
        throw new Error(
          'La partida está dañada o no es compatible. Las demás ranuras no se han modificado. Puedes importar una copia de seguridad.',
        );
      }
    });
  }
  async summaries(): Promise<SlotSummary[]> {
    return this.perform(async () => {
      const db = await this.open();
      const tx = db.transaction('summaries', 'readonly');
      const [rows] = await Promise.all([
        requested(tx.objectStore('summaries').getAll() as IDBRequest<SlotSummary[]>),
        finished(tx),
      ]);
      return rows.sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) ||
          Number(a.name === PREVIOUS_AUTO_SAVE) - Number(b.name === PREVIOUS_AUTO_SAVE) ||
          a.name.localeCompare(b.name),
      );
    });
  }
  async list(): Promise<string[]> {
    return (await this.summaries()).map((s) => s.name).sort();
  }
  async delete(name: string): Promise<void> {
    return this.perform(async () => {
      const db = await this.open();
      const tx = db.transaction(['payloads', 'summaries'], 'readwrite');
      const done = finished(tx);
      tx.objectStore('payloads').delete(checkedName(name));
      tx.objectStore('summaries').delete(name.trim());
      await done;
    });
  }
  async rename(oldName: string, newName: string): Promise<void> {
    oldName = checkedName(oldName);
    newName = checkedName(newName);
    if (isAutomaticSlot(oldName) || isAutomaticSlot(newName))
      throw new Error('El nombre del guardado automático está reservado.');
    if (oldName === newName) return;
    return this.perform(async () => {
      const db = await this.open();
      const tx = db.transaction(['payloads', 'summaries'], 'readwrite');
      let failure: Error | undefined;
      const done = finished(tx).catch((error) => {
        throw failure ?? error;
      });
      const data = tx.objectStore('payloads'),
        meta = tx.objectStore('summaries');
      const old = data.get(oldName) as IDBRequest<Payload | undefined>;
      old.onsuccess = () => {
        if (!old.result) {
          failure = new Error('No se encuentra esa partida guardada.');
          tx.abort();
          return;
        }
        const target = data.get(newName);
        target.onsuccess = () => {
          if (target.result) {
            failure = new Error('Ya existe una partida con ese nombre.');
            tx.abort();
            return;
          }
          const summary = meta.get(oldName) as IDBRequest<SlotSummary>;
          summary.onsuccess = () => {
            data.add({ ...old.result!, name: newName });
            meta.add({ ...summary.result, name: newName });
            data.delete(oldName);
            meta.delete(oldName);
          };
        };
      };
      await done;
    });
  }
  async autosaveEnabled(): Promise<boolean> {
    return this.perform(async () => {
      const value = await this.read<boolean>('settings', 'autosave');
      return typeof value === 'boolean' ? value : true;
    });
  }
  async setAutosave(enabled: boolean): Promise<void> {
    return this.perform(async () => {
      const db = await this.open();
      const tx = db.transaction('settings', 'readwrite');
      const done = finished(tx);
      tx.objectStore('settings').put(enabled, 'autosave');
      await done;
    });
  }
  async close(): Promise<void> {
    if (this.connection) (await this.connection).close();
    this.connection = null;
  }
}
