import { parseUniverse, type Player, type Universe } from '@bm27/schema';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  advanceSeason,
  askingSalary,
  clubRating,
  competitionOfTeam,
  exportSave,
  freeAgents,
  generateUniverse,
  hashValue,
  importSave,
  isExpired,
  marketProblem,
  playerAbility,
  playerValue,
  releasePlayer,
  renewContract,
  setUserTeam,
  signFreeAgent,
  simulateSeason,
  startSeason,
  teamPayroll,
} from '../src/index';

let fresh: Universe;
/** The universe at the start of season 2: contracts have run out and the market is open. */
let offseason: Universe;

beforeAll(() => {
  fresh = generateUniverse({ seed: 'market-test' });
  offseason = simulateSeason(setUserTeam(fresh, fresh.competitions[0]!.teamIds[2]!)).universe;
});

/** Renews every expiring contract of the user's team that still fits under the cap. */
function renewWhatFits(universe: Universe): Universe {
  let u = universe;
  const team = u.teams.find((t) => t.id === u.userTeamId)!;
  for (const id of team.playerIds) {
    if (
      !isExpired(
        u,
        u.players.find((p) => p.id === id)!,
      )
    )
      continue;
    try {
      u = renewContract(u, id, 2);
    } catch {
      // does not fit: the player leaves when the season starts
    }
  }
  return u;
}

const playerOf = (u: Universe, id: string): Player => u.players.find((p) => p.id === id)!;
const myTeam = (u: Universe) => u.teams.find((t) => t.id === u.userTeamId)!;

describe('valuation', () => {
  it('better players ask for more; potential counts for the young; veterans ask for less', () => {
    const rich = fresh.players.filter((p) => p.age >= 25 && p.age <= 28);
    const sorted = [...rich].sort((a, b) => playerAbility(b) - playerAbility(a));
    const best = playerValue(sorted[0]!);
    const median = playerValue(sorted[Math.floor(sorted.length / 2)]!);
    const worst = playerValue(sorted[sorted.length - 1]!);
    expect(best).toBeGreaterThan(median * 1.5);
    expect(median).toBeGreaterThan(worst * 1.5);

    const base = sorted[Math.floor(sorted.length / 2)]!;
    expect(playerValue({ ...base, age: 20, potential: base.potential + 12 })).toBeGreaterThan(
      playerValue({ ...base, age: 20, potential: base.potential }),
    );
    expect(playerValue({ ...base, age: 25, potential: playerAbility(base) })).toBeGreaterThan(
      playerValue({ ...base, age: 35, potential: playerAbility(base) }),
    );
    expect(clubRating({ ...base, age: 19, potential: 95 })).toBeGreaterThan(playerAbility(base));
  });

  it('respects the competition minimum salary', () => {
    const competition = fresh.competitions[3]!;
    const weak = [...fresh.players].sort((a, b) => playerAbility(a) - playerAbility(b))[0]!;
    expect(askingSalary(weak, competition)).toBe(competition.minSalary);
  });
});

describe('a new universe', () => {
  it('gives a contract to every player with a club, and only to them', () => {
    for (const player of fresh.players) {
      if (player.teamId === null) expect(player.contract).toBeNull();
      else {
        expect(player.contract).not.toBeNull();
        expect(player.contract!.endSeason).toBeGreaterThanOrEqual(1);
        expect(player.contract!.endSeason).toBeLessThanOrEqual(4);
      }
    }
    expect(freeAgents(fresh).length).toBeGreaterThan(30);
    expect(() => parseUniverse(fresh)).not.toThrow();
  });

  it('keeps every club under its cap and above the minimum salary', () => {
    for (const team of fresh.teams) {
      const competition = competitionOfTeam(fresh, team.id);
      expect(teamPayroll(fresh, team.id)).toBeLessThanOrEqual(competition.salaryCap);
      for (const id of team.playerIds) {
        expect(playerOf(fresh, id).contract!.salary).toBeGreaterThanOrEqual(competition.minSalary);
      }
    }
  });

  it('pays better players more within a club', () => {
    const level1 = fresh.competitions[0]!;
    let better = 0;
    let total = 0;
    for (const teamId of level1.teamIds) {
      const roster = fresh.teams
        .find((t) => t.id === teamId)!
        .playerIds.map((id) => playerOf(fresh, id));
      const sorted = roster.sort((a, b) => playerAbility(b) - playerAbility(a));
      total++;
      if (sorted[0]!.contract!.salary > sorted[sorted.length - 1]!.contract!.salary) better++;
    }
    expect(better / total).toBeGreaterThan(0.9);
  });

  it('rejects a universe whose contracts and clubs disagree', () => {
    const broken = JSON.parse(JSON.stringify(fresh));
    broken.players[0].contract = null; // a player with a club but no contract
    const freeAgent = broken.players.find((p: Player) => p.teamId === null);
    freeAgent.contract = { salary: 50_000, endSeason: 3 }; // a free agent with a contract
    expect(() => parseUniverse(broken)).toThrow(/contract exactly when he has a club/);
  });
});

describe('end of season', () => {
  it('clubs renew or release expiring players; the user decides his own', () => {
    const user = offseason.userTeamId!;
    for (const team of offseason.teams) {
      const expired = team.playerIds.filter((id) => isExpired(offseason, playerOf(offseason, id)));
      if (team.id === user) continue;
      expect(expired, `club ${team.id} still has expired contracts`).toEqual([]);
    }
    // The user's expiring contracts are still there, waiting for a decision.
    expect(
      myTeam(offseason).playerIds.some((id) => isExpired(offseason, playerOf(offseason, id))),
    ).toBe(true);
  });

  it('logs what happened and keeps only a few seasons of history', () => {
    const types = new Set(offseason.transactions.map((t) => t.type));
    expect(types.has('renewed')).toBe(true);
    expect(types.has('expired')).toBe(true);
    expect(types.has('retired')).toBe(true);
    let current = setUserTeam(offseason, null);
    for (let i = 0; i < 4; i++) current = simulateSeason(current).universe;
    const seasons = new Set(current.transactions.map((t) => t.seasonNumber));
    expect(Math.min(...seasons)).toBeGreaterThan(current.seasonNumber - 3);
  });

  it('every retirement brings a young free agent; old free agents retire', () => {
    const retired = offseason.transactions.filter((t) => t.type === 'retired').length;
    const youngFreeAgents = freeAgents(offseason).filter((p) => p.age <= 21).length;
    expect(retired).toBeGreaterThan(50);
    expect(youngFreeAgents).toBeGreaterThanOrEqual(retired - 5);
    // A veteran can only be in the pool because his contract was not renewed this very offseason.
    const justReleased = new Set(
      offseason.transactions.filter((t) => t.type === 'expired').map((t) => t.playerId),
    );
    for (const p of freeAgents(offseason).filter((x) => x.age >= 29)) {
      expect(justReleased.has(p.id), `${p.id} has waited a season and should have retired`).toBe(
        true,
      );
    }
  });
});

describe('the market closes when the season starts', () => {
  let started: Universe;
  beforeAll(() => {
    // The user keeps what fits under the cap, so that the season can start.
    started = startSeason(renewWhatFits(offseason));
  });

  it('every club has between the minimum and the maximum number of players and fits its cap', () => {
    const relegated = new Set(
      started.history.at(-1)!.competitions.flatMap((c) => c.relegatedTeamIds),
    );
    for (const team of started.teams) {
      const competition = competitionOfTeam(started, team.id);
      expect(team.playerIds.length).toBeGreaterThanOrEqual(competition.rosterMin);
      expect(team.playerIds.length).toBeLessThanOrEqual(competition.rosterMax);
      // The cap limits signings, not contracts already signed: a club that has just been
      // relegated may be above the cap of its new level. Everybody else is within the cap,
      // plus at most the minimum-wage contracts needed to reach the minimum squad.
      if (!relegated.has(team.id)) {
        expect(teamPayroll(started, team.id)).toBeLessThan(
          competition.salaryCap + competition.rosterMin * competition.minSalary,
        );
      }
      for (const id of team.playerIds)
        expect(isExpired(started, playerOf(started, id))).toBe(false);
    }
    expect(() => parseUniverse(started)).not.toThrow();
  });

  it('clubs sign free agents and the pool shrinks', () => {
    const signed = started.transactions.filter(
      (t) => t.type === 'signed' && t.seasonNumber === started.seasonNumber,
    );
    expect(signed.length).toBeGreaterThan(100);
    expect(freeAgents(started).length).toBeLessThan(freeAgents(offseason).length / 2);
    for (const move of signed) expect(playerOf(started, move.playerId).teamId).toBe(move.teamId);
  });

  it('is deterministic', () => {
    expect(hashValue(startSeason(renewWhatFits(offseason)))).toBe(hashValue(started));
  });

  it('can be saved and loaded in the middle of the market, and still gives the same season', () => {
    const loaded = importSave(exportSave(offseason));
    expect(hashValue(loaded)).toBe(hashValue(offseason));
    expect(hashValue(startSeason(setUserTeam(loaded, null)))).toBe(
      hashValue(startSeason(setUserTeam(offseason, null))),
    );
  });
});

describe('the user in the market', () => {
  const bestAffordable = (u: Universe): Player => {
    const team = myTeam(u);
    const competition = competitionOfTeam(u, team.id);
    return freeAgents(u)
      .filter((p) => askingSalary(p, competition) < competition.salaryCap - teamPayroll(u, team.id))
      .sort((a, b) => playerAbility(b) - playerAbility(a))[0]!;
  };

  it('signs a free agent: contract, roster, log and pool are updated; the original is untouched', () => {
    // Make room first: release the worst player.
    const roster = myTeam(offseason).playerIds.map((id) => playerOf(offseason, id));
    const worst = [...roster].sort((a, b) => playerAbility(a) - playerAbility(b))[0]!;
    const room = releasePlayer(offseason, worst.id);
    const target = bestAffordable(room);
    const before = hashValue(room);
    const signed = signFreeAgent(room, target.id, 3);
    const after = playerOf(signed, target.id);
    expect(after.teamId).toBe(room.userTeamId);
    expect(after.contract!.endSeason).toBe(room.seasonNumber + 2);
    expect(after.contract!.salary).toBe(
      askingSalary(target, competitionOfTeam(room, room.userTeamId!)),
    );
    expect(myTeam(signed).playerIds).toContain(target.id);
    expect(freeAgents(signed).some((p) => p.id === target.id)).toBe(false);
    expect(signed.transactions.at(-1)).toMatchObject({ type: 'signed', playerId: target.id });
    expect(hashValue(room)).toBe(before);
    expect(() => parseUniverse(signed)).not.toThrow();
  });

  it('refuses signings that break the rules, with a readable message', () => {
    const team = myTeam(offseason);
    const competition = competitionOfTeam(offseason, team.id);
    const star = [...freeAgents(offseason)].sort((a, b) => playerAbility(b) - playerAbility(a))[0]!;

    // Not enough cap room: make the club's payroll nearly full by renewing nobody and raising it artificially.
    const crowded: Universe = {
      ...offseason,
      competitions: offseason.competitions.map((c) =>
        c.id === competition.id
          ? {
              ...c,
              // Only the contracts that stay count against the cap.
              salaryCap:
                team.playerIds
                  .map((id) => playerOf(offseason, id))
                  .filter((p) => !isExpired(offseason, p))
                  .reduce((sum, p) => sum + p.contract!.salary, 0) + 1_000,
            }
          : c,
      ),
    };
    expect(() => signFreeAgent(crowded, star.id, 2)).toThrow(/tope salarial/);

    // Roster full.
    let full = offseason;
    for (let i = 0; myTeam(full).playerIds.length < competition.rosterMax && i < 10; i++) {
      full = signFreeAgent(
        full,
        freeAgents(full).sort((a, b) => playerAbility(a) - playerAbility(b))[0]!.id,
        1,
      );
    }
    expect(() => signFreeAgent(full, star.id, 2)).toThrow(/máximo de 15/);

    expect(() => signFreeAgent(offseason, star.id, 0)).toThrow(/entre 1 y 4/);
    expect(() => signFreeAgent(offseason, star.id, 5)).toThrow(/entre 1 y 4/);
    expect(() => signFreeAgent(offseason, myTeam(offseason).playerIds[0]!, 2)).toThrow(
      /no es agente libre/,
    );
    expect(() => signFreeAgent(offseason, 'nope', 2)).toThrow(/no encontrado/);
    expect(() => signFreeAgent({ ...offseason, userTeamId: null }, star.id, 2)).toThrow(
      /elige un equipo/,
    );
  });

  it('the market is closed while a season is being played', () => {
    const playing = advanceSeason(renewWhatFits(offseason)).universe;
    expect(playing.currentSeason).not.toBeNull();
    const target = freeAgents(playing)[0]!;
    expect(() => signFreeAgent(playing, target.id, 2)).toThrow(/mercado está cerrado/);
    expect(() => releasePlayer(playing, myTeam(playing).playerIds[0]!)).toThrow(
      /mercado está cerrado/,
    );
  });

  it('renews a contract at the asking salary', () => {
    const expiring = myTeam(offseason).playerIds.find((id) =>
      isExpired(offseason, playerOf(offseason, id)),
    )!;
    const renewed = renewContract(offseason, expiring, 3);
    const player = playerOf(renewed, expiring);
    expect(isExpired(renewed, player)).toBe(false);
    expect(player.contract!.endSeason).toBe(offseason.seasonNumber + 2);
    expect(renewed.transactions.at(-1)).toMatchObject({ type: 'renewed', playerId: expiring });
    expect(() => renewContract(offseason, freeAgents(offseason)[0]!.id, 2)).toThrow(
      /no es de tu equipo/,
    );
  });

  it('releases a player to the pool and drops him from a hand-picked line-up', () => {
    const team = myTeam(offseason);
    const withLineup = {
      ...offseason,
      teams: offseason.teams.map((t) =>
        t.id === team.id ? { ...t, rotation: [...t.playerIds] } : t,
      ),
    };
    const leaving = team.playerIds[team.playerIds.length - 1]!;
    const released = releasePlayer(withLineup, leaving);
    expect(playerOf(released, leaving)).toMatchObject({ teamId: null, contract: null });
    expect(myTeam(released).playerIds).not.toContain(leaving);
    expect(myTeam(released).rotation).not.toContain(leaving);
    expect(freeAgents(released).some((p) => p.id === leaving)).toBe(true);
    expect(() => parseUniverse(released)).not.toThrow();
  });

  it('cannot start the season with an incomplete squad, and says why', () => {
    // Do nothing about the expiring contracts: the squad falls below the minimum.
    const expiring = myTeam(offseason).playerIds.filter((id) =>
      isExpired(offseason, playerOf(offseason, id)),
    );
    expect(expiring.length).toBeGreaterThan(0);
    let short = offseason;
    // Shrink the squad until the minimum is no longer met.
    const competition = competitionOfTeam(offseason, myTeam(offseason).id);
    for (const id of myTeam(short).playerIds) {
      if (myTeam(short).playerIds.length <= competition.rosterMin - 1 + expiring.length) break;
      if (!isExpired(short, playerOf(short, id))) short = releasePlayer(short, id);
    }
    expect(marketProblem(short)).toMatch(/necesitas al menos 12/);
    expect(() => startSeason(short)).toThrow(/necesitas al menos 12/);
    expect(() => advanceSeason(short)).toThrow(/necesitas al menos 12/);
    expect(short.currentSeason).toBeNull(); // nothing was changed
  });

  it('un-renewed contracts expire when the season starts', () => {
    const expiring = myTeam(offseason).playerIds.filter((id) =>
      isExpired(offseason, playerOf(offseason, id)),
    );
    // Sign enough free agents to stay above the minimum without the expiring players.
    let u = offseason;
    const competition = competitionOfTeam(u, myTeam(u).id);
    while (myTeam(u).playerIds.length - expiring.length < competition.rosterMin) {
      const cheap = freeAgents(u).sort(
        (a, b) => askingSalary(a, competition) - askingSalary(b, competition),
      )[0]!;
      u = signFreeAgent(u, cheap.id, 1);
    }
    if (myTeam(u).playerIds.length > competition.rosterMax)
      throw new Error('test setup: squad too big');
    const started = startSeason(u);
    for (const id of expiring) expect(myTeam(started).playerIds).not.toContain(id);
  });
});

describe('long-run stability with the market', () => {
  it('talent, age, squad sizes and payrolls stay healthy over several seasons', () => {
    let current = generateUniverse({ seed: 'market-stability' });
    const level = (u: Universe): number[] => {
      const byId = new Map(u.players.map((p) => [p.id, p]));
      return [...u.competitions]
        .sort((a, b) => a.level - b.level)
        .map((c) => {
          let sum = 0;
          let n = 0;
          for (const teamId of c.teamIds) {
            for (const id of u.teams.find((t) => t.id === teamId)!.playerIds) {
              sum += playerAbility(byId.get(id)!);
              n++;
            }
          }
          return sum / n;
        });
    };
    const first = level(startSeason(current));
    for (let i = 0; i < 6; i++) current = simulateSeason(current).universe;
    const opened = startSeason(current);
    const last = level(opened);
    first.forEach((value, i) => {
      expect(Math.abs((last[i] as number) - value), `level ${i + 1}`).toBeLessThan(2.5);
    });
    const sizes = opened.teams.map((t) => t.playerIds.length);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(15);
    expect(freeAgents(opened).length).toBeLessThan(300);
    expect(() => parseUniverse(current)).not.toThrow();
  });
});

/**
 * Issue #26 (found by the Codex audit): a minimum-wage contract used to be accepted over the
 * salary limit even with a complete squad. D-030 only allows it to reach the minimum squad.
 */
describe('the minimum-wage exception (D-030)', () => {
  /** The user's competition with a cap so low that the club is far above its limit. */
  function tight(u: Universe): Universe {
    const competition = competitionOfTeam(u, u.userTeamId!);
    return {
      ...u,
      competitions: u.competitions.map((c) =>
        c.id === competition.id ? { ...c, salaryCap: 1 } : c,
      ),
    };
  }
  /** Plenty of cash, so that releasing players for the setup is never refused. */
  function rich(u: Universe): Universe {
    return {
      ...u,
      teams: u.teams.map((t) =>
        t.id === u.userTeamId ? { ...t, finance: { ...t.finance, balance: 500_000_000 } } : t,
      ),
    };
  }
  /** A player who asks for the minimum wage, from the free agents. */
  function cheapAgent(u: Universe, skip: string[] = []): Player {
    const competition = competitionOfTeam(u, u.userTeamId!);
    const found = freeAgents(u).find(
      (p) => !skip.includes(p.id) && askingSalary(p, competition) <= competition.minSalary,
    );
    if (!found) throw new Error('test setup: no free agent asks for the minimum wage');
    return found;
  }
  const staying = (u: Universe): number =>
    myTeam(u).playerIds.filter((id) => !isExpired(u, playerOf(u, id))).length;

  // A season-1 universe has a market open, no expired contracts and a few free agents.
  const start = (): Universe => {
    const base = generateUniverse({ seed: 'min-wage-exception' });
    // A club with 13 players: not full (15) and above the minimum (12).
    const team = base.teams.find((t) => t.playerIds.length === 13)!;
    return setUserTeam(base, team.id);
  };

  it('refuses a minimum-wage signing over the limit when the squad is complete (the #26 case)', () => {
    const u = tight(start());
    const competition = competitionOfTeam(u, u.userTeamId!);
    expect(myTeam(u).playerIds.length).toBeGreaterThanOrEqual(competition.rosterMin);
    expect(teamPayroll(u, u.userTeamId!)).toBeGreaterThan(competition.salaryCap);
    const agent = cheapAgent(u);
    expect(() => signFreeAgent(u, agent.id, 1)).toThrow(/No cabe/);
  });

  it('still allows a minimum-wage signing that is needed to reach the minimum squad', () => {
    let u = rich(tight(start()));
    const competition = competitionOfTeam(u, u.userTeamId!);
    // Let players go until the squad is one short of the minimum.
    while (staying(u) >= competition.rosterMin) {
      u = releasePlayer(u, myTeam(u).playerIds[myTeam(u).playerIds.length - 1]!);
    }
    expect(staying(u)).toBe(competition.rosterMin - 1);

    const first = cheapAgent(u);
    u = signFreeAgent(u, first.id, 1); // fills the missing spot, over the limit: allowed
    expect(staying(u)).toBe(competition.rosterMin);
    // The squad is complete again: the exception is gone.
    expect(() => signFreeAgent(u, cheapAgent(u, [first.id]).id, 1)).toThrow(/No cabe/);
  });

  it('never lets a renewal of a player still under contract use the exception', () => {
    const base = start();
    const team = myTeam(base);
    // A player with one year left (renewable) who would ask for the minimum wage.
    const weakened: Universe = {
      ...base,
      players: base.players.map((p) =>
        p.id === team.playerIds[0]
          ? {
              ...p,
              potential: 1,
              age: 36,
              contract: { salary: p.contract!.salary, endSeason: base.seasonNumber },
              attributes: {
                offensive: Object.fromEntries(
                  Object.keys(p.attributes.offensive).map((k) => [k, 1]),
                ) as Player['attributes']['offensive'],
                defensive: Object.fromEntries(
                  Object.keys(p.attributes.defensive).map((k) => [k, 1]),
                ) as Player['attributes']['defensive'],
                physical: Object.fromEntries(
                  Object.keys(p.attributes.physical).map((k) => [k, 1]),
                ) as Player['attributes']['physical'],
                mental: Object.fromEntries(
                  Object.keys(p.attributes.mental).map((k) => [k, 1]),
                ) as Player['attributes']['mental'],
              },
            }
          : p,
      ),
    };
    const u = tight(weakened);
    const competition = competitionOfTeam(u, u.userTeamId!);
    expect(askingSalary(playerOf(u, team.playerIds[0]!), competition, true)).toBe(
      competition.minSalary,
    );
    expect(isExpired(u, playerOf(u, team.playerIds[0]!))).toBe(false);
    expect(() => renewContract(u, team.playerIds[0]!, 1)).toThrow(/No cabe/);
  });

  it('allows bringing back an expired player at the minimum wage only while the squad is short', () => {
    // The offseason of the main fixture has expired contracts for the user's club.
    let u = rich(tight(setUserTeam(offseason, offseason.userTeamId)));
    const competition = competitionOfTeam(u, u.userTeamId!);
    const weak = (p: Player): Player => ({
      ...p,
      potential: 1,
      age: 36,
      attributes: {
        offensive: Object.fromEntries(
          Object.keys(p.attributes.offensive).map((k) => [k, 1]),
        ) as Player['attributes']['offensive'],
        defensive: Object.fromEntries(
          Object.keys(p.attributes.defensive).map((k) => [k, 1]),
        ) as Player['attributes']['defensive'],
        physical: Object.fromEntries(
          Object.keys(p.attributes.physical).map((k) => [k, 1]),
        ) as Player['attributes']['physical'],
        mental: Object.fromEntries(
          Object.keys(p.attributes.mental).map((k) => [k, 1]),
        ) as Player['attributes']['mental'],
      },
    });
    const expired = myTeam(u).playerIds.filter((id) => isExpired(u, playerOf(u, id)));
    expect(expired.length).toBeGreaterThanOrEqual(2);
    u = { ...u, players: u.players.map((p) => (expired.slice(0, 2).includes(p.id) ? weak(p) : p)) };
    // Shrink the squad that stays until it is exactly one below the minimum.
    while (staying(u) >= competition.rosterMin) {
      const leaving = myTeam(u).playerIds.find((id) => !isExpired(u, playerOf(u, id)))!;
      u = releasePlayer(u, leaving);
    }
    expect(staying(u)).toBe(competition.rosterMin - 1);

    const [first, second] = expired as [string, string];
    u = renewContract(u, first, 1); // needed to reach the minimum: allowed over the limit
    expect(staying(u)).toBe(competition.rosterMin);
    expect(() => renewContract(u, second, 1)).toThrow(/No cabe/); // squad complete: refused
  });
});
