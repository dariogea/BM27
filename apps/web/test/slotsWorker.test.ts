import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { Command, Reply } from '../src/protocol';
import { AUTO_SAVE } from '../src/slotStore';

let factory: IDBFactory;
let send: (command: Command) => Promise<Reply>;
beforeEach(async () => {
  vi.resetModules();
  factory = new IDBFactory();
  vi.stubGlobal('indexedDB', factory);
  const pending = new Map<number, (r: Reply) => void>();
  const worker = {
    onmessage: (_: { data: Command }) => {},
    postMessage: (r: Reply) => {
      pending.get(r.id)?.(r);
      pending.delete(r.id);
    },
  };
  vi.stubGlobal('self', worker);
  await import('../src/worker');
  send = (command) =>
    new Promise((resolve) => {
      pending.set(command.id, resolve);
      worker.onmessage({ data: command });
    });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('serializes saving and simulation and resumes the saved game identically', async () => {
  await send({ id: 1, type: 'generate', seed: 'slot-worker' });
  const [saved, advanced] = await Promise.all([
    send({ id: 2, type: 'saveSlot', name: 'Antes' }),
    send({ id: 3, type: 'advance' }),
  ]);
  expect(saved.type).toBe('slots');
  expect(advanced.type).toBe('state');
  const loaded = await send({ id: 4, type: 'loadSlot', name: 'Antes' });
  expect(loaded.type).toBe('state');
  const replayed = await send({ id: 5, type: 'advance' });
  if (advanced.type !== 'state' || replayed.type !== 'state') throw Error('Simulation failed');
  expect(replayed.view).toEqual(advanced.view);
});
it('autosaves on season completion without overwriting manual saves and can be disabled', async () => {
  await send({ id: 1, type: 'generate', seed: 'autosave-worker' });
  await send({ id: 2, type: 'saveSlot', name: 'Manual' });
  const ended = await send({ id: 3, type: 'finishSeason' });
  if (ended.type !== 'state') throw Error('Season failed');
  expect(ended.message).toContain('Guardado automático completado');
  const slots = await send({ id: 4, type: 'listSlots' });
  if (slots.type !== 'slots') throw Error('Listing failed');
  expect(slots.slots.find((s) => s.name === AUTO_SAVE)?.season).toBe(2);
  expect(slots.slots.find((s) => s.name === 'Manual')?.season).toBe(1);
  await send({ id: 5, type: 'setAutosave', enabled: false });
  const second = await send({ id: 6, type: 'finishSeason' });
  expect(second.type).toBe('state');
  const after = await send({ id: 7, type: 'listSlots' });
  if (after.type !== 'slots') throw Error('Listing failed');
  expect(after.autosave).toBe(false);
  expect(after.slots.find((s) => s.name === AUTO_SAVE)?.season).toBe(2);
});
it('a damaged slot cannot replace the open universe', async () => {
  await send({ id: 1, type: 'generate', seed: 'intact-worker' });
  await send({ id: 2, type: 'saveSlot', name: 'Rotura' });
  const before = await send({ id: 3, type: 'exportSave' });
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = factory.open('bm27-saves-v1', 1);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('payloads', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore('payloads').put({ name: 'Rotura', json: 'invalid' });
  });
  db.close();
  const failed = await send({ id: 4, type: 'loadSlot', name: 'Rotura' });
  expect(failed.type).toBe('error');
  const after = await send({ id: 5, type: 'exportSave' });
  if (before.type !== 'save' || after.type !== 'save') throw Error('Export failed');
  expect(after.json).toBe(before.json);
});
it('failed automatic storage reports the problem while retaining the completed season', async () => {
  await send({ id: 1, type: 'generate', seed: 'quota-worker' });
  vi.spyOn(factory, 'open').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError');
  });
  const ended = await send({ id: 2, type: 'finishSeason' });
  if (ended.type !== 'state') throw Error('Season lost');
  expect(ended.view.seasonNumber).toBe(2);
  expect(ended.message).toContain('No se pudo completar el guardado automático');
  expect((await send({ id: 3, type: 'exportSave' })).type).toBe('save');
});
