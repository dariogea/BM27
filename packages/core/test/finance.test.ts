import { parseUniverse, type Player, type Universe } from '@bm27/schema';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  FINANCE,
  advanceSeason,
  competitionOfTeam,
  createRng,
  effectiveSalaryLimit,
  expectedRevenue,
  generateUniverse,
  hashValue,
  isFinanciallyRestricted,
  overdraftLimit,
  regularHomeGames,
  releasePlayer,
  renewContract,
  resolveContracts,
  revenueOf,
  setUserTeam,
  severanceCost,
  signFreeAgent,
  simulateSeason,
  startSeason,
  teamPayroll,
  wageBudget,
  freeAgents,
  askingSalary,
  playerAbility,
} from '../src/index';

let fresh: Universe;
let played: ReturnType<typeof simulateSeason>;

beforeAll(() => {
  fresh = generateUniverse({ seed: 'finance-test' });
  played = simulateSeason(fresh);
});

const team = (u: Universe, id: string) => u.teams.find((t) => t.id === id)!;
const player = (u: Universe, id: string): Player => u.players.find((p) => p.id === id)!;

/** The universe with one club's cash changed. */
function withBalance(u: Universe, teamId: string, balance: number): Universe {
  return {
    ...u,
    teams: u.teams.map((t) => (t.id === teamId ? { ...t, finance: { ...t.finance, balance } } : t)),
  };
}

describe('revenue', () => {
  const economy = fresh_economy();
  function fresh_economy() {
    return generateUniverse({ seed: 'economy-shape' }).competitions[0]!.economy;
  }

  it('grows with reputation, home games and playoff games', () => {
    const base = revenueOf(economy, 50, 17);
    expect(revenueOf(economy, 80, 17).total).toBeGreaterThan(base.total);
    expect(revenueOf(economy, 20, 17).total).toBeLessThan(base.total);
    expect(revenueOf(economy, 50, 17).tickets).toBeGreaterThan(revenueOf(economy, 50, 10).tickets);
    expect(revenueOf(economy, 50, 17, 3).tickets).toBeGreaterThan(base.tickets);
    // Television does not depend on the club.
    expect(revenueOf(economy, 10, 17).tv).toBe(revenueOf(economy, 90, 17).tv);
    expect(base.total).toBe(base.tv + base.sponsors + base.tickets);
  });

  it('is higher in higher leagues for the same reputation', () => {
    const levels = [...fresh.competitions].sort((a, b) => a.level - b.level);
    for (let i = 0; i < levels.length - 1; i++) {
      expect(expectedRevenue(levels[i]!, 50)).toBeGreaterThan(expectedRevenue(levels[i + 1]!, 50));
    }
    expect(regularHomeGames(levels[0]!)).toBe(17); // 18 teams, double round robin
  });
});

describe('a new universe', () => {
  it('has a reputation and some cash for every club, all valid', () => {
    expect(() => parseUniverse(fresh)).not.toThrow();
    for (const t of fresh.teams) {
      expect(t.reputation).toBeGreaterThanOrEqual(0);
      expect(t.reputation).toBeLessThanOrEqual(100);
      expect(t.finance.balance).toBeGreaterThan(0);
      expect(t.finance.lastRevenue).toBeGreaterThan(0);
    }
  });

  it('has better clubs in higher leagues, with clubs inside a league spread around the typical value', () => {
    const mean = (ids: string[]): number =>
      ids.reduce((s, id) => s + team(fresh, id).reputation, 0) / ids.length;
    const levels = [...fresh.competitions].sort((a, b) => a.level - b.level);
    for (let i = 0; i < levels.length - 1; i++) {
      expect(mean(levels[i]!.teamIds)).toBeGreaterThan(mean(levels[i + 1]!.teamIds) + 5);
    }
    for (const c of levels) {
      expect(Math.abs(mean(c.teamIds) - c.economy.baseReputation)).toBeLessThan(8);
    }
  });

  it('keeps every payroll within the wage budget, which is within the cap', () => {
    for (const t of fresh.teams) {
      const competition = competitionOfTeam(fresh, t.id);
      const budget = wageBudget(t, competition);
      expect(budget).toBeLessThanOrEqual(competition.salaryCap);
      expect(teamPayroll(fresh, t.id)).toBeLessThanOrEqual(budget);
    }
  });

  it('gives richer clubs bigger budgets', () => {
    const level1 = fresh.competitions[0]!;
    const rows = level1.teamIds
      .map((id) => ({
        rep: team(fresh, id).reputation,
        budget: wageBudget(team(fresh, id), level1),
      }))
      .sort((a, b) => a.rep - b.rep);
    expect(rows[rows.length - 1]!.budget).toBeGreaterThanOrEqual(rows[0]!.budget);
  });
});

describe('closing the books', () => {
  it('records every club that played, with exact accounting', () => {
    const season = played.season;
    const opened = startSeason(fresh);
    expect(season.finance.length).toBe(fresh.teams.length);
    for (const record of season.finance) {
      const before = team(fresh, record.teamId);
      const after = team(played.universe, record.teamId);
      expect(record.result).toBe(
        record.tv + record.sponsors + record.tickets - record.wages - record.fixedCosts,
      );
      expect(record.balanceEnd).toBe(before.finance.balance + record.result);
      expect(after.finance.balance).toBe(record.balanceEnd);
      expect(after.finance.lastRevenue).toBe(record.tv + record.sponsors + record.tickets);
      expect(after.reputation).toBe(record.reputationEnd);
      // Wages paid are the salaries under contract during that season, i.e. once the market has closed.
      expect(record.wages).toBe(teamPayroll(opened, record.teamId));
      // Home games: every club plays about half of its league games at home.
      expect(record.homeGames).toBeGreaterThanOrEqual(6);
    }
    expect(played.universe.history.at(-1)!.finance.length).toBe(fresh.teams.length);
  });

  it('is deterministic, and a season played in steps gives the same books', () => {
    const again = simulateSeason(generateUniverse({ seed: 'finance-test' }));
    expect(hashValue(again.season.finance)).toBe(hashValue(played.season.finance));
    let u = fresh;
    let season = null as Universe['history'][number] | null;
    while (!season) {
      const step = advanceSeason(u);
      u = step.universe;
      season = step.season;
    }
    expect(hashValue(season.finance)).toBe(hashValue(played.season.finance));
  });

  it('moves reputation towards what the league and the final position deserve', () => {
    for (const result of played.season.competitions) {
      const competition = fresh.competitions.find((c) => c.id === result.competitionId)!;
      const n = result.finalRanking.length;
      result.finalRanking.forEach((id, index) => {
        const before = team(fresh, id).reputation;
        const target =
          competition.economy.baseReputation +
          FINANCE.positionSwing * (0.5 - index / (n - 1)) +
          (index === 0 ? FINANCE.championBonus : 0);
        const expected = Math.round(
          Math.max(0, Math.min(100, before + FINANCE.reputationPull * (target - before))),
        );
        expect(team(played.universe, id).reputation, `${id} (#${index + 1})`).toBe(expected);
      });
    }
  });
});

describe('long-run stability of the money', () => {
  it('reputation stays around the typical value of each level and nobody is ruined', () => {
    let u = fresh;
    for (let i = 0; i < 8; i++) u = simulateSeason(u).universe;
    for (const c of u.competitions) {
      const reps = c.teamIds.map((id) => team(u, id).reputation);
      const mean = reps.reduce((a, b) => a + b, 0) / reps.length;
      expect(Math.abs(mean - c.economy.baseReputation), `level ${c.level}`).toBeLessThan(10);
    }
    const restricted = u.teams.filter(isFinanciallyRestricted).length;
    expect(restricted).toBeLessThan(u.teams.length * 0.05);
    expect(() => parseUniverse(u)).not.toThrow();
  });
});

describe('the user and the money', () => {
  let offseason: Universe;
  beforeAll(() => {
    offseason = simulateSeason(setUserTeam(fresh, fresh.competitions[0]!.teamIds[1]!)).universe;
  });
  const mine = (u: Universe) => team(u, u.userTeamId!);

  it('pays severance when releasing a player with years left on his contract', () => {
    const roster = mine(offseason).playerIds.map((id) => player(offseason, id));
    const target = roster.find((p) => p.contract!.endSeason >= offseason.seasonNumber + 1)!;
    const expected = severanceCost(target, offseason.seasonNumber);
    const seasonsLeft = target.contract!.endSeason - offseason.seasonNumber + 1;
    expect(expected).toBeGreaterThan(0);
    expect(
      Math.abs(expected - target.contract!.salary * seasonsLeft * FINANCE.severanceShare),
    ).toBeLessThan(1000);

    const after = releasePlayer(offseason, target.id);
    expect(mine(after).finance.balance).toBe(mine(offseason).finance.balance - expected);
    expect(after.transactions.at(-1)).toMatchObject({
      type: 'released',
      playerId: target.id,
      cost: expected,
    });
    expect(() => parseUniverse(after)).not.toThrow();
  });

  it('does not charge for a contract that has already run out', () => {
    const expired = mine(offseason).playerIds.find(
      (id) => player(offseason, id).contract!.endSeason < offseason.seasonNumber,
    )!;
    const after = releasePlayer(offseason, expired);
    expect(mine(after).finance.balance).toBe(mine(offseason).finance.balance);
    expect(after.transactions.at(-1)!.cost).toBe(0);
  });

  it('cannot release a player if the severance would leave the club too deep in debt', () => {
    const broke = withBalance(offseason, offseason.userTeamId!, -overdraftLimit(mine(offseason)));
    const costly = mine(broke)
      .playerIds.map((id) => player(broke, id))
      .find(
        (p) =>
          severanceCost(p, broke.seasonNumber) > 0 && p.contract!.endSeason >= broke.seasonNumber,
      )!;
    expect(() => releasePlayer(broke, costly.id)).toThrow(/No puedes pagar la indemnización/);
  });

  it('a club in deep debt cannot take on salaries', () => {
    const t = mine(offseason);
    const competition = competitionOfTeam(offseason, t.id);
    // Make room in the squad while the club can still pay, then plunge it into debt.
    let roomy = offseason;
    for (const id of mine(offseason).playerIds.slice(-4)) {
      if (mine(roomy).playerIds.length > 12) roomy = releasePlayer(roomy, id);
    }
    const broke = withBalance(roomy, t.id, -overdraftLimit(mine(roomy)) - 1);
    expect(isFinanciallyRestricted(mine(broke))).toBe(true);
    expect(effectiveSalaryLimit(mine(broke), competition)).toBe(0);
    const target = freeAgents(broke).find(
      (p) => askingSalary(p, competition) > competition.minSalary,
    )!;
    expect(() => signFreeAgent(broke, target.id, 2)).toThrow(/números rojos/);
  });

  it('explains when a signing does not fit the wage budget', () => {
    const t = mine(offseason);
    const competition = competitionOfTeam(offseason, t.id);
    // A club whose income allows a budget well below the league cap.
    const poor: Universe = {
      ...offseason,
      teams: offseason.teams.map((x) =>
        x.id === t.id
          ? {
              ...x,
              // Cash for the severance pay, so that only the wage budget speaks.
              finance: { ...x.finance, balance: 2_000_000, lastRevenue: 1_000_000 },
              reputation: 5,
            }
          : x,
      ),
    };
    expect(wageBudget(mine(poor), competition)).toBeLessThan(competition.salaryCap);
    const star = [...freeAgents(poor)].sort((a, b) => playerAbility(b) - playerAbility(a))[0]!;
    // Make sure the squad has room, so that only the money speaks.
    let roomy = poor;
    for (const id of mine(poor).playerIds.slice(-4)) roomy = releasePlayer(roomy, id);
    expect(() => signFreeAgent(roomy, star.id, 3)).toThrow(/presupuesto salarial/);
  });

  it('the wage budget also limits renewals', () => {
    const t = mine(offseason);
    const expiring = t.playerIds.find(
      (id) => player(offseason, id).contract!.endSeason < offseason.seasonNumber,
    );
    if (!expiring) return;
    const poor: Universe = {
      ...offseason,
      teams: offseason.teams.map((x) =>
        x.id === t.id
          ? { ...x, finance: { ...x.finance, lastRevenue: 100_000 }, reputation: 1 }
          : x,
      ),
    };
    expect(() => renewContract(poor, expiring, 2)).toThrow(/No cabe|números rojos/);
  });
});

describe('the clubs and the money', () => {
  it('a club in deep debt lets every expiring player go; a healthy club keeps some', () => {
    const season2: Universe = {
      ...fresh,
      seasonNumber: 2,
      players: fresh.players.map((p) =>
        p.contract ? { ...p, contract: { ...p.contract, endSeason: 1 } } : p,
      ),
    };
    const level1 = season2.competitions[0]!;
    const brokeId = level1.teamIds[0]!;
    const healthyId = level1.teamIds[1]!;
    const u = withBalance(season2, brokeId, -50_000_000);
    const result = resolveContracts(u, 2, createRng('money'));
    const renewedBy = (id: string): number =>
      result.log.filter((l) => l.type === 'renewed' && l.teamId === id).length;
    expect(renewedBy(brokeId)).toBe(0);
    expect(result.log.filter((l) => l.type === 'expired' && l.teamId === brokeId).length).toBe(
      team(u, brokeId).playerIds.length,
    );
    expect(renewedBy(healthyId)).toBeGreaterThan(0);
  });

  it('a newly relegated club starts the next season with a lower budget than before', () => {
    const relegated = played.season.competitions[0]!.relegatedTeamIds[0]!;
    const before = team(fresh, relegated);
    const after = team(played.universe, relegated);
    const wasIn = competitionOfTeam(fresh, relegated);
    const nowIn = competitionOfTeam(played.universe, relegated);
    expect(nowIn.level).toBeGreaterThan(wasIn.level);
    expect(wageBudget(after, nowIn)).toBeLessThan(wageBudget(before, wasIn));
  });
});

describe('saving the money', () => {
  it('keeps the books after saving and loading, and the next season is the same', () => {
    const t = played.universe;
    const again = startSeason(setUserTeam(t, null));
    expect(hashValue(again)).toBe(
      hashValue(startSeason(setUserTeam(JSON.parse(JSON.stringify(t)), null))),
    );
  });
});
