import { afterEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { importSave } from '@bm27/core';
import sample from '../../../data/packs/example-eight-clubs.json';
import type { Command, Reply } from '../src/protocol';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('validates packs without replacing the open world, preserves a valid selection after errors and generates the selected data', async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  const pending = new Map<number, (reply: Reply) => void>();
  const worker = {
    onmessage: (_: { data: Command }) => {},
    postMessage: (reply: Reply) => {
      pending.get(reply.id)?.(reply);
      pending.delete(reply.id);
    },
  };
  vi.stubGlobal('self', worker);
  await import('../src/worker');
  const send = (command: Command): Promise<Reply> =>
    new Promise((resolve) => {
      pending.set(command.id, resolve);
      worker.onmessage({ data: command });
    });
  const initial = await send({ id: 1, type: 'generate', seed: 'pack-worker' });
  expect(initial).toMatchObject({ type: 'state', view: { teamCount: 202 } });
  const before = await send({ id: 2, type: 'exportSave' });
  const selection = await send({ id: 3, type: 'setDataPack', json: JSON.stringify(sample) });
  expect(selection).toMatchObject({ type: 'dataPack', summary: { id: sample.id } });
  const broken = structuredClone(sample);
  broken.config.levels[0]!.rulesetId = 'missing';
  expect(await send({ id: 4, type: 'setDataPack', json: JSON.stringify(broken) })).toMatchObject({
    type: 'error',
    message: expect.stringContaining('rulesetId'),
  });
  const after = await send({ id: 5, type: 'exportSave' });
  if (before.type !== 'save' || after.type !== 'save') throw new Error('Export failed');
  expect(after.json).toBe(before.json);
  const created = await send({ id: 6, type: 'generate', seed: 'pack-worker' });
  expect(created).toMatchObject({ type: 'state', view: { teamCount: 8 } });
  const saved = await send({ id: 7, type: 'exportSave' });
  if (saved.type !== 'save') throw new Error('Export failed');
  const world = importSave(saved.json);
  expect(world.namePool).toEqual(sample.names);
  expect(world.dataPackId).toBe(sample.id);
  expect(await send({ id: 8, type: 'setDataPack', json: null })).toMatchObject({
    type: 'dataPack',
    summary: null,
  });
  const stillOpen = await send({ id: 9, type: 'exportSave' });
  expect(stillOpen.type === 'save' && stillOpen.json).toBe(saved.json);
  expect(await send({ id: 10, type: 'generate', seed: 'pack-worker' })).toMatchObject({
    type: 'state',
    view: { teamCount: 202 },
  });
});
