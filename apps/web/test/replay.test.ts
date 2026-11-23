import { beforeAll, describe, expect, it } from 'vitest';
import { generateUniverseFromDataPack, simulateCompetitionSeason } from '@bm27/core';
import type { MatchDetail } from '@bm27/schema';
import sample from '../../../data/packs/example-eight-clubs.json';
import { buildReplay, replayClock, replayEventText, replayPlayerTotals } from '../src/replayData';

const matches: MatchDetail[] = [];
beforeAll(() => {
  const world = generateUniverseFromDataPack(sample, 'replay-events');
  simulateCompetitionSeason(world, world.competitions[0]!.id, {
    onMatch: (detail) => matches.push(detail),
  });
});
describe('event-only match playback', () => {
  it('reaches exactly the box score through every complete match without altering its source', () => {
    expect(matches.length).toBeGreaterThan(56);
    for (const match of matches) {
      const before = JSON.stringify(match);
      const { frames } = buildReplay(match);
      expect(frames).toHaveLength(match.events.length + 1);
      expect(frames[0]).toMatchObject({ event: null, homeScore: 0, awayScore: 0 });
      expect(frames.at(-1)).toMatchObject({
        homeScore: match.boxScore.home.points,
        awayScore: match.boxScore.away.points,
      });
      expect(match.boxScore.home.totals).toMatchObject(frames.at(-1)!.homeTotals);
      expect(match.boxScore.away.totals).toMatchObject(frames.at(-1)!.awayTotals);
      expect(Object.values(frames[0]!.homeTotals).every((value) => value === 0)).toBe(true);
      expect(Object.values(frames[0]!.awayTotals).every((value) => value === 0)).toBe(true);
      expect(JSON.stringify(match)).toBe(before);
      frames.slice(1).forEach((frame, i) => {
        expect(frame.event).toEqual(match.events[i]);
        expect(frame.period).toBe(match.events[i]!.period);
        expect(frame.clock).toBe(match.events[i]!.clock);
      });
    }
  });
  it('reconstructs each player’s contributions and preserves the stats at earlier cursors', () => {
    for (const match of matches) {
      const { frames } = buildReplay(match);
      for (const team of [match.boxScore.home, match.boxScore.away]) {
        for (const { starter: _starter, playerId, ...line } of team.players) {
          expect(replayPlayerTotals(frames[0]!, playerId)).toEqual({
            ...Object.fromEntries(Object.keys(line).map((key) => [key, 0])),
            plusMinus: 0,
          });
          const { plusMinus: _margin, ...actual } = replayPlayerTotals(frames.at(-1)!, playerId);
          expect(actual).toEqual(line);
        }
      }
      const firstShot = match.events.findIndex((event) => event.type === 'shot');
      const event = match.events[firstShot];
      if (!event || event.type !== 'shot') throw new Error('Missing first shot');
      expect(replayPlayerTotals(frames[firstShot]!, event.playerId).fieldGoalsAttempted).toBe(0);
      expect(replayPlayerTotals(frames[firstShot + 1]!, event.playerId).fieldGoalsAttempted).toBe(
        1,
      );
    }
  });
  it('credits the score differential only to the players on court at each score change', () => {
    for (const match of matches) {
      const { frames } = buildReplay(match);
      for (let i = 1; i < frames.length; i++) {
        const before = frames[i - 1]!;
        const after = frames[i]!;
        const delta = after.homeScore - before.homeScore - (after.awayScore - before.awayScore);
        if (!delta) continue;
        for (const [team, active, sign] of [
          [match.boxScore.home, before.homePlayers, 1],
          [match.boxScore.away, before.awayPlayers, -1],
        ] as const) {
          for (const { playerId } of team.players) {
            const change =
              replayPlayerTotals(after, playerId).plusMinus -
              replayPlayerTotals(before, playerId).plusMinus;
            expect(change).toBe(active.includes(playerId) ? delta * sign : 0);
          }
        }
      }
      const end = frames.at(-1)!;
      const total = match.boxScore.home.players.reduce(
        (sum, row) => sum + replayPlayerTotals(end, row.playerId).plusMinus,
        0,
      );
      expect(total).toBe(5 * (end.homeScore - end.awayScore));
    }
  });
  it('counts the outgoing shift at a substitution and resumes only when the game clock moves', () => {
    const match = matches[0]!;
    const { teamId, players } = match.boxScore.home;
    const ids = players.map((p) => p.playerId);
    const outgoing = ids[0]!;
    const incoming = ids[5]!;
    const base = { possession: 0, offenseTeamId: teamId };
    const { frames } = buildReplay({
      ...match,
      events: [
        { ...base, seq: 0, period: 4, clock: 60, type: 'period_start', periodSeconds: 60 },
        {
          ...base,
          seq: 1,
          period: 4,
          clock: 60,
          type: 'lineup',
          teamId,
          playerIds: ids.slice(0, 5),
        },
        {
          ...base,
          seq: 2,
          period: 4,
          clock: 10,
          type: 'substitution',
          teamId,
          playerOutId: outgoing,
          playerInId: incoming,
        },
        { ...base, seq: 3, period: 4, clock: 10, type: 'timeout', teamId, reason: 'rest' },
        { ...base, seq: 4, period: 4, clock: 0, type: 'period_end' },
        { ...base, seq: 5, period: 5, clock: 300, type: 'period_start', periodSeconds: 300 },
        { ...base, seq: 6, period: 5, clock: 290, type: 'timeout', teamId, reason: 'rest' },
      ],
    });
    const seconds = (id: string) => frames.map((frame) => replayPlayerTotals(frame, id).seconds);
    expect(seconds(outgoing)).toEqual([0, 0, 0, 50, 50, 50, 50, 50]);
    expect(seconds(incoming)).toEqual([0, 0, 0, 0, 0, 10, 10, 20]);
  });
  it('clips each highlight from the first event of its possession and credits the actual player', () => {
    const seen = new Set<string>();
    for (const match of matches) {
      const { highlights } = buildReplay(match);
      const expected = match.events.filter(
        (e) =>
          (e.type === 'shot' && ((e.made && e.shotType === 'three') || e.blockPlayerId)) ||
          (e.type === 'turnover' && e.stealPlayerId),
      );
      expect(highlights.map((h) => match.events[h.end - 1])).toEqual(expected);
      for (const h of highlights) {
        const event = match.events[h.end - 1]!;
        const previous = match.events[h.start - 1];
        expect(previous?.period === event.period && previous.possession === event.possession).toBe(
          false,
        );
        expect(
          match.events
            .slice(h.start, h.end)
            .every((e) => e.period === event.period && e.possession === event.possession),
        ).toBe(true);
        const actor =
          event.type === 'shot'
            ? (event.blockPlayerId ?? event.playerId)
            : event.type === 'turnover'
              ? event.stealPlayerId
              : undefined;
        expect(h.playerId).toBe(actor);
        const team = match.boxScore.home.players.some((p) => p.playerId === actor)
          ? match.boxScore.home
          : match.boxScore.away;
        expect(h.teamId).toBe(team.teamId);
        seen.add(h.label);
      }
    }
    expect(seen).toEqual(new Set(['Triple', 'Tapón', 'Robo']));
  });
  it('preserves every field-goal location and only maps field goals, never free throws', () => {
    for (const match of matches) {
      const { shots } = buildReplay(match);
      expect(shots.map((s) => s.event)).toEqual(match.events.filter((e) => e.type === 'shot'));
      for (const shot of shots) {
        expect(shot.event).toEqual(match.events[shot.at - 1]);
        expect(shot.teamId).toBe(
          match.boxScore.home.players.some((p) => p.playerId === shot.event.playerId)
            ? match.boxScore.home.teamId
            : match.boxScore.away.teamId,
        );
      }
    }
  });
  it('uses recorded starting lineups and substitutions while keeping earlier snapshots intact', () => {
    let changes = 0;
    for (const match of matches) {
      const { frames } = buildReplay(match);
      for (let i = 1; i < frames.length; i++) {
        const frame = frames[i]!,
          event = frame.event!;
        const home =
          event.type === 'lineup' || event.type === 'substitution'
            ? event.teamId === match.boxScore.home.teamId
            : false;
        if (event.type === 'lineup')
          expect(home ? frame.homePlayers : frame.awayPlayers).toEqual(event.playerIds);
        if (event.type === 'substitution') {
          changes++;
          const before = home ? frames[i - 1]!.homePlayers : frames[i - 1]!.awayPlayers;
          const after = home ? frame.homePlayers : frame.awayPlayers;
          expect(before).toContain(event.playerOutId);
          expect(after).toEqual(
            before.map((id) => (id === event.playerOutId ? event.playerInId : id)),
          );
          expect(after).toHaveLength(5);
          expect(new Set(after).size).toBe(5);
          expect(before).toContain(event.playerOutId);
        }
      }
    }
    expect(changes).toBeGreaterThan(0);
  });
  it('credits a technical free throw to the shooter’s club even when the other team has possession', () => {
    const match = structuredClone(matches[0]!);
    match.events = [
      {
        seq: 0,
        period: 1,
        clock: 100,
        possession: 4,
        offenseTeamId: match.boxScore.home.teamId,
        type: 'free_throw',
        playerId: match.boxScore.away.players[0]!.playerId,
        made: true,
      },
    ];
    const { frames } = buildReplay(match);
    expect(frames[0]!.awayTotals.freeThrowsAttempted).toBe(0);
    expect(frames[1]).toMatchObject({
      homeScore: 0,
      awayScore: 1,
      homeTotals: { freeThrowsMade: 0, freeThrowsAttempted: 0 },
      awayTotals: { freeThrowsMade: 1, freeThrowsAttempted: 1 },
    });
  });
  it('rejects scoring by players outside the acta rather than silently guessing a club', () => {
    const match = structuredClone(matches[0]!);
    match.events = [
      {
        seq: 0,
        period: 1,
        clock: 100,
        possession: 4,
        offenseTeamId: match.boxScore.home.teamId,
        type: 'free_throw',
        playerId: 'missing',
        made: true,
      },
    ];
    expect(() => buildReplay(match)).toThrow(/ajeno al acta/);
  });
  it('formats the recorded clock and supplies Spanish descriptions for all events encountered', () => {
    expect(replayClock(900)).toBe('15:00');
    expect(replayClock(3)).toBe('0:03');
    expect(replayClock(0)).toBe('0:00');
    expect(replayEventText(null, (id) => id)).toContain('salto inicial');
    for (const match of matches)
      for (const event of match.events)
        expect(replayEventText(event, (id) => id).length).toBeGreaterThan(3);
  });
});
