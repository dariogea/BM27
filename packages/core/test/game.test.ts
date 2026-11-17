import { parseUniverse, type Universe } from '@bm27/schema';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  advanceSeason,
  exportSave,
  generateUniverse,
  hashValue,
  importSave,
  prepareTeam,
  replayMatch,
  setTeamRotation,
  setTeamTactics,
  setUserTeam,
  simulateSeason,
  standingsOf,
  startSeason,
} from '../src/index';

let fresh: Universe;

beforeAll(() => {
  fresh = generateUniverse({ seed: 'game-test' });
});

/** Plays `steps` steps of the season. */
function play(universe: Universe, steps: number): Universe {
  let current = universe;
  for (let i = 0; i < steps; i++) current = advanceSeason(current).universe;
  return current;
}

describe('season step by step', () => {
  it('starting a season creates the full calendar and plays nothing', () => {
    const started = startSeason(fresh);
    const progress = started.currentSeason!;
    expect(progress.step).toBe(0);
    expect(progress.competitions.map((c) => c.fixtures.length)).toEqual([306, 306, 364, 1768]);
    expect(progress.competitions.every((c) => c.matches.length === 0)).toBe(true);
    expect(() => startSeason(started)).toThrow(/already in progress/);
    expect(() => parseUniverse(started)).not.toThrow();
  });

  it('each step plays one matchday for every team', () => {
    const outcome = advanceSeason(fresh);
    const level1 = outcome.universe.currentSeason!.competitions[0]!;
    expect(level1.matches.length).toBe(9); // 18 teams → 9 games
    expect(level1.nextRound).toBe(2);
    expect(outcome.season).toBeNull();
    for (const row of standingsOf(level1)[0]!.standings) expect(row.played).toBe(1);
    // 202 teams, groups of 13 leave one team resting: 9 + 9 + 14 + (8*7 + 2*6)
    expect(outcome.played.length).toBe(9 + 9 + 14 + 68);
  });

  it('does not modify the universe it receives', () => {
    const before = hashValue(fresh);
    const started = startSeason(fresh);
    const startedHash = hashValue(started);
    advanceSeason(started);
    expect(hashValue(fresh)).toBe(before);
    expect(hashValue(started)).toBe(startedHash);
  });

  it('stepping to the end equals simulating the whole season at once', () => {
    const whole = simulateSeason(fresh);
    let current = fresh;
    let steps = 0;
    let season = null;
    while (!season) {
      const outcome = advanceSeason(current);
      current = outcome.universe;
      season = outcome.season;
      steps++;
    }
    expect(steps).toBeGreaterThan(34); // 34 matchdays + playoffs
    expect(current.currentSeason).toBeNull();
    expect(current.seasonNumber).toBe(2);
    expect(hashValue(season)).toBe(hashValue(whole.season));
    expect(hashValue(current)).toBe(hashValue(whole.universe));
  });

  it('save in the middle of a season → load → continue equals not saving', () => {
    const straight = simulateSeason(fresh).universe;
    for (const steps of [1, 17, 36]) {
      const midway = play(fresh, steps);
      expect(midway.currentSeason).not.toBeNull();
      const loaded = importSave(exportSave(midway));
      expect(hashValue(loaded)).toBe(hashValue(midway));
      expect(hashValue(simulateSeason(loaded).universe)).toBe(hashValue(straight));
    }
  });

  it('playoffs advance one game at a time', () => {
    let current = play(fresh, 34); // level 1 regular season is over
    const level1 = (): NonNullable<Universe['currentSeason']>['competitions'][number] =>
      current.currentSeason!.competitions[0]!;
    expect(level1().phase).toBe('playoffs');
    expect(level1().playoffSeeds.length).toBe(8);
    expect(level1().playoffSeries.length).toBe(4);
    expect(level1().playoffSeries.every((s) => s.matchIds.length === 0)).toBe(true);
    current = advanceSeason(current).universe;
    expect(
      level1()
        .playoffSeries.slice(0, 4)
        .every((s) => s.matchIds.length === 1),
    ).toBe(true);
    expect(level1().playoffSeries.every((s) => s.winnerTeamId === null)).toBe(true); // best of 3
  });
});

describe('managing a team', () => {
  it('chooses the user team and rejects unknown ones', () => {
    const teamId = fresh.teams[3]!.id;
    expect(setUserTeam(fresh, teamId).userTeamId).toBe(teamId);
    expect(setUserTeam(setUserTeam(fresh, teamId), null).userTeamId).toBeNull();
    expect(() => setUserTeam(fresh, 'nope')).toThrow(/Unknown team/);
    expect(fresh.userTeamId).toBeNull();
  });

  it('tactics changes are validated', () => {
    const teamId = fresh.teams[0]!.id;
    const changed = setTeamTactics(fresh, teamId, { pace: 'fast', rotationDepth: 8 });
    const team = changed.teams.find((t) => t.id === teamId)!;
    expect(team.tactics.pace).toBe('fast');
    expect(team.tactics.rotationDepth).toBe(8);
    expect(team.tactics.pressure).toBe(fresh.teams[0]!.tactics.pressure); // untouched
    expect(() => setTeamTactics(fresh, teamId, { pace: 'warp' as never })).toThrow(
      /Invalid tactics/,
    );
    expect(() => setTeamTactics(fresh, teamId, { rotationDepth: 30 })).toThrow(/rotationDepth/);
  });

  it('tactics changes affect only matches played afterwards', () => {
    const teamId = fresh.competitions[0]!.teamIds[0]!;
    const original = fresh.teams.find((t) => t.id === teamId)!.tactics;
    const afterFive = play(fresh, 5);
    const changed = setTeamTactics(afterFive, teamId, {
      pace: original.pace === 'fast' ? 'slow' : 'fast',
      offenseFocus: original.offenseFocus === 'perimeter' ? 'inside' : 'perimeter',
    });

    const withChange = play(changed, 5).currentSeason!.competitions[0]!.matches;
    const withoutChange = play(afterFive, 5).currentSeason!.competitions[0]!.matches;
    const involves = (m: { homeTeamId: string; awayTeamId: string }): boolean =>
      m.homeTeamId === teamId || m.awayTeamId === teamId;

    // The first five matchdays are identical in both worlds...
    expect(hashValue(withChange.filter((m) => m.round <= 5))).toBe(
      hashValue(withoutChange.filter((m) => m.round <= 5)),
    );
    // ...afterwards the team's own matches differ...
    const later = (list: typeof withChange) => list.filter((m) => m.round > 5);
    expect(hashValue(later(withChange).filter(involves))).not.toBe(
      hashValue(later(withoutChange).filter(involves)),
    );
    // ...and nobody else's do on the very next matchday. (From T-028 on, injuries make
    // matches depend on earlier ones: a changed result can injure a different opponent
    // player, who then misses a different later game. That is the only way the change spreads.)
    const nextDay = (list: typeof withChange) => list.filter((m) => m.round === 6);
    expect(hashValue(nextDay(withChange).filter((m) => !involves(m)))).toBe(
      hashValue(nextDay(withoutChange).filter((m) => !involves(m))),
    );
  });

  it('a hand-picked line-up is used exactly as given', () => {
    const team = fresh.teams[0]!;
    const playersById = new Map(fresh.players.map((p) => [p.id, p]));
    const automatic = prepareTeam(team, playersById);
    const reversed = [...team.playerIds].reverse();
    const universe = setTeamRotation(fresh, team.id, reversed);
    const manual = prepareTeam(universe.teams[0]!, new Map(universe.players.map((p) => [p.id, p])));

    expect(manual.players.slice(0, 5).map((p) => p.id)).toEqual(reversed.slice(0, 5));
    expect(manual.players.map((p) => p.id)).toEqual(reversed);
    expect(manual.players.map((p) => p.id)).not.toEqual(automatic.players.map((p) => p.id));

    // And it shows on court: the listed starters start the next match.
    const outcome = advanceSeason(universe, {
      onMatch: (detail) => {
        if (detail.result.homeTeamId !== team.id && detail.result.awayTeamId !== team.id) return;
        const box =
          detail.boxScore.home.teamId === team.id ? detail.boxScore.home : detail.boxScore.away;
        const starters = box.players.filter((l) => l.starter).map((l) => l.playerId);
        expect([...starters].sort()).toEqual(reversed.slice(0, 5).sort());
      },
    });
    expect(outcome.played.length).toBeGreaterThan(0);

    expect(setTeamRotation(universe, team.id, null).teams[0]!.rotation).toBeNull();
  });

  it('rejects impossible line-ups', () => {
    const team = fresh.teams[0]!;
    const other = fresh.teams[1]!;
    expect(() => setTeamRotation(fresh, team.id, team.playerIds.slice(0, 4))).toThrow(/at least 5/);
    expect(() =>
      setTeamRotation(fresh, team.id, [...team.playerIds.slice(0, 5), team.playerIds[0]!]),
    ).toThrow(/twice/);
    expect(() =>
      setTeamRotation(fresh, team.id, [...team.playerIds.slice(0, 5), other.playerIds[0]!]),
    ).toThrow(/not in this team/);
  });

  it('a worse line-up loses more: benching the five best players hurts', () => {
    // A good team (third in level 1) has room to fall; a bottom team would not.
    const baseline = simulateSeason(fresh).season.competitions[0]!.groups[0]!.standings;
    const teamId = baseline[2]!.teamId;
    const team = fresh.teams.find((t) => t.id === teamId)!;
    const playersById = new Map(fresh.players.map((p) => [p.id, p]));
    const best = prepareTeam(team, playersById).players.map((p) => p.id);
    // Worst players start and carry the minutes; the best ones barely play.
    const upsideDown = setTeamRotation(fresh, teamId, [...best].reverse());
    const wins = (universe: Universe): number =>
      simulateSeason(universe).season.competitions[0]!.groups[0]!.standings.find(
        (r) => r.teamId === teamId,
      )!.wins;
    expect(wins(upsideDown)).toBeLessThan(wins(fresh) - 3);
  });

  it('the line-up survives retirements and transfers between seasons', () => {
    const team = fresh.teams[0]!;
    let universe = setTeamRotation(fresh, team.id, team.playerIds);
    for (let i = 0; i < 4; i++) universe = simulateSeason(universe).universe;
    // Players leave and arrive when the market closes; the line-up always lists exactly the squad.
    const after = startSeason(universe).teams[0]!;
    expect(after.rotation).not.toBeNull();
    expect([...after.rotation!].sort()).toEqual([...after.playerIds].sort());
    expect(() => parseUniverse(universe)).not.toThrow();
  });

  it('matches of a season in progress can be replayed exactly', () => {
    let detailFromPlay = null as null | { id: string; hash: string };
    const outcome = advanceSeason(fresh, {
      onMatch: (detail) => {
        detailFromPlay ??= { id: detail.result.id, hash: hashValue(detail) };
      },
    });
    const result = outcome.played.find((m) => m.id === detailFromPlay!.id)!;
    expect(hashValue(replayMatch(outcome.universe, result))).toBe(detailFromPlay!.hash);
  });
});
