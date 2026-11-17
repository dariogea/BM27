import { afterEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { Command, Reply } from '../src/protocol';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('routes world queries without exposing rival potential or changing saved state, and recovers from errors', async () => {
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
  const generated = await send({ id: 1, type: 'generate', seed: 'world-worker' });
  if (generated.type !== 'state') throw new Error('Generation failed');
  const teams = generated.view.competitions[0]!.teamIds;
  const chosen = await send({ id: 2, type: 'chooseTeam', teamId: teams[0]! });
  if (chosen.type !== 'state' || !chosen.view.myTeam) throw new Error('Choice failed');
  const before = await send({ id: 3, type: 'exportSave' });
  const own = await send({
    id: 4,
    type: 'worldPlayer',
    playerId: chosen.view.myTeam.squad[0]!.player.id,
  });
  expect(own.type === 'world' && own.result.kind === 'player' && own.result.potential).toBe(
    chosen.view.myTeam.squad[0]!.player.potential,
  );
  const club = await send({ id: 5, type: 'worldClub', teamId: teams[1]! });
  if (club.type !== 'world' || club.result.kind !== 'club') throw new Error('Club query failed');
  const other = await send({ id: 6, type: 'worldPlayer', playerId: club.result.players[0]!.id });
  expect(
    other.type === 'world' && other.result.kind === 'player' && other.result.potential,
  ).toBeNull();
  expect(await send({ id: 7, type: 'worldPlayer', playerId: 'missing' })).toMatchObject({
    id: 7,
    type: 'error',
  });
  const search = await send({
    id: 8,
    type: 'worldSearch',
    entity: 'clubs',
    query: '',
    competitionId: generated.view.competitions[0]!.id,
    page: 0,
    includeRetired: false,
  });
  expect(search).toMatchObject({
    id: 8,
    type: 'world',
    result: { kind: 'search', total: teams.length },
  });
  const after = await send({ id: 9, type: 'exportSave' });
  if (before.type !== 'save' || after.type !== 'save') throw new Error('Export failed');
  expect(after.json).toBe(before.json);
});
