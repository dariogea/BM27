import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { advanceSeason, generateUniverse } from '@bm27/core';
import { AUTO_SAVE, IndexedDbSaveStore } from '../src/slotStore';

const world = generateUniverse({ seed: 'internal-saves' });
const open: IndexedDbSaveStore[] = [];
function store(factory = new IDBFactory()) {
  const value = new IndexedDbSaveStore(factory, 'test-saves');
  open.push(value);
  return value;
}
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(open.splice(0).map((s) => s.close().catch(() => {})));
});

describe('IndexedDB save slots', () => {
  it('persists distinct named saves and small metadata across connections', async () => {
    const factory = new IDBFactory();
    const first = store(factory);
    await first.save('Primera', world);
    await first.save('Segunda', { ...world, seed: 'another-seed' });
    const second = store(factory);
    expect(await second.list()).toEqual(['Primera', 'Segunda']);
    const rows = await second.summaries();
    expect(rows.find((r) => r.name === 'Primera')).toMatchObject({
      seed: world.seed,
      season: world.seasonNumber,
      automatic: false,
    });
    expect(rows[0]!.bytes).toBeGreaterThan(0);
    expect(rows[0]).not.toHaveProperty('json');
    expect(await second.load('Primera')).toEqual(world);
  });
  it('overwrites only the selected slot and preserves simulation continuation', async () => {
    const db = store();
    await db.save('A', world);
    await db.save('B', world);
    const advanced = advanceSeason(world).universe;
    await db.save('A', advanced);
    expect(await db.load('B')).toEqual(world);
    expect(advanceSeason(await db.load('A')).universe).toEqual(advanceSeason(advanced).universe);
  });
  it('renames atomically and refuses a collision without losing either slot', async () => {
    const db = store();
    await db.save('A', world);
    await db.save('B', world);
    await expect(db.rename('A', 'B')).rejects.toThrow('Ya existe');
    expect(await db.list()).toEqual(['A', 'B']);
    await db.rename('A', 'C');
    expect(await db.list()).toEqual(['B', 'C']);
    expect(await db.load('C')).toEqual(world);
    await db.delete('C');
    expect(await db.list()).toEqual(['B']);
  });
  it('isolates a corrupted payload and leaves the other slots usable', async () => {
    const factory = new IDBFactory(),
      db = store(factory);
    await db.save('Dañada', world);
    await db.save('Sana', world);
    const native = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = factory.open('test-saves', 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = native.transaction('payloads', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore('payloads').put({ name: 'Dañada', json: '{invalid' });
    });
    native.close();
    await expect(db.load('Dañada')).rejects.toThrow('dañada');
    expect(await db.load('Sana')).toEqual(world);
    expect(await db.list()).toEqual(['Dañada', 'Sana']);
  });
  it('persists autosave preferences and keeps the automatic slot separate', async () => {
    const factory = new IDBFactory(),
      db = store(factory);
    expect(await db.autosaveEnabled()).toBe(true);
    await db.setAutosave(false);
    expect(await store(factory).autosaveEnabled()).toBe(false);
    await db.save('Manual', world);
    await db.save(AUTO_SAVE, world);
    expect((await db.summaries()).find((r) => r.name === AUTO_SAVE)?.automatic).toBe(true);
    await expect(db.rename(AUTO_SAVE, 'Renombrado')).rejects.toThrow('reservado');
    expect(await db.load('Manual')).toEqual(world);
  });
  it('reports unavailable storage and quota errors with the file backup route', async () => {
    const unavailable = new IndexedDbSaveStore(undefined);
    await expect(unavailable.list()).rejects.toThrow('archivos');
    const factory = new IDBFactory();
    const quota = vi.spyOn(factory, 'open').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const retry = store(factory);
    await expect(retry.save('Nueva', world)).rejects.toThrow('No queda espacio');
    quota.mockRestore();
    await retry.save('Nueva', world);
    expect(await retry.load('Nueva')).toEqual(world);
  });
  it('rejects empty or oversized names and reports missing saves', async () => {
    const db = store();
    await expect(db.save(' ', world)).rejects.toThrow('nombre');
    await expect(db.save('x'.repeat(81), world)).rejects.toThrow('nombre');
    await expect(db.load('ausente')).rejects.toThrow('No se encuentra');
  });
});
