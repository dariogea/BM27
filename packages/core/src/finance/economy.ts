import type {
  Competition,
  Economy,
  Player,
  Season,
  Team,
  TeamFinanceRecord,
  Universe,
} from '@bm27/schema';

/**
 * CLUB FINANCES (T-006).
 *
 * Revenue per season = television + sponsors + tickets. Sponsors and crowds
 * grow with the club's reputation (0–100); reputation drifts every season
 * towards what the club's league and final position deserve, so success pays
 * but cannot snowball: the pull towards the level's typical reputation is
 * stronger than the bonus for finishing high.
 *
 * Costs = salaries + fixed costs. The balance carries over from season to
 * season. A club will only commit to salaries up to a share of its revenue
 * (its wage budget).
 *
 * The numbers are inventions calibrated so that an average club of each level
 * makes a small profit (see docs/benchmarks/T-006-estabilidad.md). They are
 * not fitted to real accounts.
 */
export const FINANCE = {
  /** Sponsors scale between these multiples of the base as reputation goes 0 → 100. */
  sponsorRange: [0.6, 1.4],
  /** Crowds scale between these multiples of the average as reputation goes 0 → 100. */
  attendanceRange: [0.55, 1.45],
  /** Home playoff games sell better. */
  playoffGateBonus: 1.15,
  /** Reputation moves this share of the way towards its target every season. */
  reputationPull: 0.25,
  /** Points above/below the level's typical reputation for finishing first/last. */
  positionSwing: 28,
  championBonus: 4,
  /** A club may go this share of its revenue into debt before it must stop spending. */
  overdraftShare: 0.25,
  /** Share of the remaining contract paid when a player is released. */
  severanceShare: 0.5,
  /** Opening cash, as a share of the first season's revenue. */
  openingBalanceShare: 0.06,
} as const;

const F = FINANCE;

const lerp = (range: readonly [number, number], t: number): number =>
  range[0] + (range[1] - range[0]) * t;

/** Number of home games a club plays in the regular season of a competition. */
export function regularHomeGames(competition: Competition): number {
  const groups = Math.max(1, competition.format.groupCount);
  const size = competition.teamIds.length / groups;
  return Math.round(((size - 1) * competition.format.roundRobinLegs) / 2);
}

export interface RevenueBreakdown {
  tv: number;
  sponsors: number;
  tickets: number;
  averageCrowd: number;
  total: number;
}

/** Revenue of a club in a competition for a given reputation and number of home games. */
export function revenueOf(
  economy: Economy,
  reputation: number,
  regularGames: number,
  playoffGames = 0,
): RevenueBreakdown {
  const t = Math.max(0, Math.min(100, reputation)) / 100;
  const crowd = economy.averageAttendance * lerp(F.attendanceRange, t);
  const tickets = economy.ticketPrice * crowd * (regularGames + playoffGames * F.playoffGateBonus);
  const sponsors = economy.sponsorRevenue * lerp(F.sponsorRange, t);
  return {
    tv: Math.round(economy.tvRevenue),
    sponsors: Math.round(sponsors),
    tickets: Math.round(tickets),
    averageCrowd: Math.round(crowd),
    total: Math.round(economy.tvRevenue + sponsors + tickets),
  };
}

/** What a club of this reputation is expected to earn in a competition. */
export function expectedRevenue(competition: Competition, reputation: number): number {
  return revenueOf(competition.economy, reputation, regularHomeGames(competition)).total;
}

/**
 * Most a club will commit to salaries next season: its wage share of a blend of
 * last season's revenue and what its reputation earns in its current league
 * (so a newly promoted club is not stuck with the budget of a lower league),
 * never above the league's salary cap.
 */
export function wageBudget(team: Team, competition: Competition): number {
  const projected =
    0.5 * team.finance.lastRevenue + 0.5 * expectedRevenue(competition, team.reputation);
  const budget = Math.round((projected * competition.economy.wageShare) / 1000) * 1000;
  return Math.max(
    competition.rosterMin * competition.minSalary,
    Math.min(competition.salaryCap, budget),
  );
}

/** How deep into debt a club may go before it has to stop spending. */
export function overdraftLimit(team: Team): number {
  return Math.round(team.finance.lastRevenue * F.overdraftShare);
}

/** True if the club is so deep in debt that it cannot take on new salaries. */
export function isFinanciallyRestricted(team: Team): boolean {
  return team.finance.balance < -overdraftLimit(team);
}

/** The most salaries a club can have under contract right now (cap, budget and debt together). */
export function effectiveSalaryLimit(team: Team, competition: Competition): number {
  if (isFinanciallyRestricted(team)) return 0;
  return wageBudget(team, competition);
}

/** What releasing a player costs: part of the salary of the seasons left on his contract. */
export function severanceCost(player: Player, seasonNumber: number): number {
  if (!player.contract) return 0;
  const seasonsLeft = Math.max(0, player.contract.endSeason - seasonNumber + 1);
  return Math.round((player.contract.salary * seasonsLeft * F.severanceShare) / 1000) * 1000;
}

export interface SeasonSettlement {
  teams: Team[];
  records: TeamFinanceRecord[];
}

/**
 * Closes the books of a finished season: every club that played gets its
 * income and costs, its balance and reputation are updated, and a record is
 * kept. Call it with the universe as it was during that season.
 */
export function settleSeason(universe: Universe, season: Season): SeasonSettlement {
  const competitions = new Map(universe.competitions.map((c) => [c.id, c]));
  const players = new Map(universe.players.map((p) => [p.id, p]));
  const teams = new Map(universe.teams.map((t) => [t.id, t]));
  const records: TeamFinanceRecord[] = [];

  for (const result of season.competitions) {
    const competition = competitions.get(result.competitionId);
    if (!competition) continue;
    const homeGames = new Map<string, number>();
    const playoffHome = new Map<string, number>();
    for (const m of result.matches) {
      const book = m.stage === 'playoff' ? playoffHome : homeGames;
      book.set(m.homeTeamId, (book.get(m.homeTeamId) ?? 0) + 1);
    }
    const ranking = result.finalRanking;
    ranking.forEach((teamId, index) => {
      const team = teams.get(teamId);
      if (!team) return;
      const regular = homeGames.get(teamId) ?? 0;
      const playoff = playoffHome.get(teamId) ?? 0;
      const revenue = revenueOf(competition.economy, team.reputation, regular, playoff);
      const wages = team.playerIds.reduce(
        (sum, id) => sum + (players.get(id)?.contract?.salary ?? 0),
        0,
      );
      const fixedCosts = competition.economy.fixedCosts;
      const resultMoney = revenue.total - wages - fixedCosts;
      const balance = team.finance.balance + resultMoney;

      // Reputation drifts towards what the league and the final position deserve.
      const percentile = ranking.length > 1 ? index / (ranking.length - 1) : 0.5;
      const target =
        competition.economy.baseReputation +
        F.positionSwing * (0.5 - percentile) +
        (index === 0 ? F.championBonus : 0);
      const reputation = Math.round(
        Math.max(0, Math.min(100, team.reputation + F.reputationPull * (target - team.reputation))),
      );

      teams.set(teamId, {
        ...team,
        reputation,
        finance: { balance, lastRevenue: revenue.total },
      });
      records.push({
        teamId,
        competitionId: competition.id,
        tv: revenue.tv,
        sponsors: revenue.sponsors,
        tickets: revenue.tickets,
        homeGames: regular + playoff,
        averageCrowd: revenue.averageCrowd,
        wages,
        fixedCosts,
        result: resultMoney,
        balanceEnd: balance,
        reputationEnd: reputation,
      });
    });
  }
  return { teams: universe.teams.map((t) => teams.get(t.id) ?? t), records };
}
