import { afterEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { importSave } from '@bm27/core';
import sample from '../../../data/packs/example-eight-defined-clubs.json';
import type { Command, Reply } from '../src/protocol';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('loads stable clubs in the real Worker, preserves source claims and keeps world and selection after validation errors', async () => {
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
  expect(await send({ id: 1, type: 'setDataPack', json: JSON.stringify(sample) })).toMatchObject({
    type: 'dataPack',
    summary: { definedClubs: 8 },
  });
  const created = await send({ id: 2, type: 'generate', seed: 'defined-worker' });
  expect(created).toMatchObject({ type: 'state', view: { clubData: 'defined', teamCount: 8 } });
  if (created.type !== 'state') throw new Error('Generation failed');
  expect(created.view.teamNames[sample.clubs[0]!.id]).toBe(sample.clubs[0]!.name);
  expect(await send({ id: 3, type: 'chooseTeam', teamId: sample.clubs[0]!.id })).toMatchObject({
    type: 'state',
    view: { myTeam: { teamId: sample.clubs[0]!.id } },
  });
  const before = await send({ id: 4, type: 'exportSave' });
  const invalid = structuredClone(sample);
  invalid.clubs[0]!.region = 'missing';
  expect(await send({ id: 5, type: 'setDataPack', json: JSON.stringify(invalid) })).toMatchObject({
    type: 'error',
    message: expect.stringContaining('clubs[0].region'),
  });
  const queried = await send({ id: 6, type: 'worldClub', teamId: sample.clubs[0]!.id });
  expect(queried).toMatchObject({
    type: 'world',
    result: { kind: 'club', identity: sample.clubs[0]!.identity },
  });
  const after = await send({ id: 7, type: 'exportSave' });
  if (before.type !== 'save' || after.type !== 'save') throw new Error('Export failed');
  expect(after.json).toBe(before.json);
  expect(importSave(after.json).teams[0]!.identity).toEqual(sample.clubs[0]!.identity);
  expect(await send({ id: 8, type: 'importSave', json: after.json })).toMatchObject({
    type: 'state',
    view: { clubData: 'defined', myTeam: { teamId: sample.clubs[0]!.id } },
  });
  expect(await send({ id: 9, type: 'generate', seed: 'defined-worker-next' })).toMatchObject({
    type: 'state',
    view: {
      clubData: 'defined',
      teamNames: expect.objectContaining({ [sample.clubs[0]!.id]: sample.clubs[0]!.name }),
    },
  });
  await send({ id: 10, type: 'setDataPack', json: null });
  expect(await send({ id: 11, type: 'generate', seed: 'back-to-generated' })).toMatchObject({
    type: 'state',
    view: { clubData: 'generated', teamCount: 202 },
  });
});
