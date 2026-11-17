import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  advanceSeason,
  generateUniverse,
  getBuiltinRuleset,
  playMatch,
  prepareTeam,
  setTeamTactics,
} from '@bm27/core';
import { ReplayProofs } from '../../../apps/web/src/replayProof';
import type { Command, Reply } from '../../../apps/web/src/protocol';

const world = generateUniverse({ seed: 'audit-replay' });
const firstStep = advanceSeason(world);
const result = firstStep.played[0]!;

describe('replay provenance', () => {
  it('accepts unchanged inputs and rejects changed tactics, players, rules and seed', () => {
    const source = firstStep.universe;
    const proofs = new ReplayProofs();
    proofs.remember(source, result);
    expect(proofs.allows(source, result)).toBe(true);
    const home = source.teams.find((t) => t.id === result.homeTeamId)!;
    expect(
      proofs.allows(
        setTeamTactics(source, home.id, {
          pace: home.tactics.pace === 'fast' ? 'slow' : 'fast',
        }),
        result,
      ),
    ).toBe(false);
    expect(proofs.allows({ ...source, seed: 'different' }, result)).toBe(false);
    const rotation = [...home.playerIds];
    [rotation[0], rotation[1]] = [rotation[1]!, rotation[0]!];
    expect(
      proofs.allows(
        { ...source, teams: source.teams.map((t) => (t.id === home.id ? { ...t, rotation } : t)) },
        result,
      ),
    ).toBe(false);
    expect(
      proofs.allows(
        {
          ...source,
          players: source.players.map((p) =>
            p.id === home.playerIds[0] ? { ...p, heightCm: p.heightCm + 1 } : p,
          ),
        },
        result,
      ),
    ).toBe(false);
    expect(
      proofs.allows(
        {
          ...source,
          rulesets: source.rulesets.map((r) => ({
            ...r,
            shotClockSeconds: r.shotClockSeconds + 1,
          })),
        },
        result,
      ),
    ).toBe(false);
  });

  it('does not infer missing evidence from a matching scoreboard', () => {
    const players = new Map(world.players.map((p) => [p.id, p]));
    const home = world.teams[0]!,
      away = prepareTeam(world.teams[1]!, players);
    const original = playMatch(
      prepareTeam(home, players),
      away,
      getBuiltinRuleset('fiba'),
      'replay-regression/1628',
    );
    const changedWorld = setTeamTactics(world, home.id, { pace: 'fast' });
    const changed = playMatch(
      prepareTeam(changedWorld.teams[0]!, players),
      away,
      getBuiltinRuleset('fiba'),
      'replay-regression/1628',
    );
    expect([original.boxScore.home.points, original.boxScore.away.points]).toEqual([86, 67]);
    expect([changed.boxScore.home.points, changed.boxScore.away.points]).toEqual([86, 67]);
    expect(changed.boxScore).not.toEqual(original.boxScore);
    expect(changed.events).not.toEqual(original.events);
    const proofs = new ReplayProofs();
    expect(proofs.allows(firstStep.universe, result)).toBe(false);
    proofs.remember(firstStep.universe, result);
    proofs.clear();
    expect(proofs.allows(firstStep.universe, result)).toBe(false);
  });
});

afterEach(() => vi.unstubAllGlobals());

it('the Worker retains live details but refuses unverified replays after loading a save', async () => {
  let reply: Reply;
  const worker = {
    onmessage: (_message: { data: Command }): void => {},
    postMessage: (value: Reply): void => {
      reply = value;
    },
  };
  vi.stubGlobal('self', worker);
  await import('../../../apps/web/src/worker');
  const send = (command: Command): Reply => {
    worker.onmessage({ data: command });
    return reply;
  };
  const generated = send({ id: 1, type: 'generate', seed: 'replay-worker' });
  if (generated.type !== 'state') throw new Error('Generation failed');
  const teamId = generated.view.competitions[0]!.teamIds[0]!;
  send({ id: 2, type: 'chooseTeam', teamId });
  const advanced = send({ id: 3, type: 'advance' });
  if (advanced.type !== 'state') throw new Error('Advance failed');
  const matches = advanced.view.tables.flatMap((c) => c.matches);
  const own = matches.find((m) => m.homeTeamId === teamId || m.awayTeamId === teamId)!;
  const other = matches.find((m) => m.homeTeamId !== teamId && m.awayTeamId !== teamId)!;
  expect(send({ id: 4, type: 'matchDetail', matchId: own.id }).type).toBe('matchDetail');
  expect(send({ id: 5, type: 'matchDetail', matchId: other.id }).type).toBe('matchDetail');
  const saved = send({ id: 6, type: 'exportSave' });
  if (saved.type !== 'save') throw new Error('Export failed');
  expect(send({ id: 7, type: 'importSave', json: saved.json }).type).toBe('state');
  const unavailable = send({ id: 8, type: 'matchDetail', matchId: own.id });
  expect(unavailable.type).toBe('error');
  if (unavailable.type === 'error') expect(unavailable.message).toContain('no se pueden verificar');
  const continued = send({ id: 9, type: 'advance' });
  if (continued.type !== 'state') throw new Error('Continuation failed');
  const newMatch = continued.view.tables
    .flatMap((c) => c.matches)
    .find(
      (m) =>
        !matches.some((old) => old.id === m.id) &&
        m.homeTeamId !== teamId &&
        m.awayTeamId !== teamId,
    )!;
  expect(send({ id: 10, type: 'matchDetail', matchId: newMatch.id }).type).toBe('matchDetail');
  const chosen = send({ id: 11, type: 'chooseTeam', teamId: newMatch.homeTeamId });
  if (chosen.type !== 'state') throw new Error('Team selection failed');
  const currentTactics = chosen.view.myTeam!.tactics;
  send({
    id: 12,
    type: 'setTactics',
    tactics: {
      ...currentTactics,
      pressure: 'high',
      pace: currentTactics.pace === 'fast' ? 'slow' : 'fast',
    },
  });
  expect(send({ id: 13, type: 'advance' }).type).toBe('state');
  expect(send({ id: 14, type: 'matchDetail', matchId: newMatch.id }).type).toBe('error');
});
