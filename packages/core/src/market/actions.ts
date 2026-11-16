import type { Competition, Player, Team, Transaction, Universe } from '@bm27/schema';
import {
  FINANCE,
  effectiveSalaryLimit,
  isFinanciallyRestricted,
  overdraftLimit,
  severanceCost,
} from '../finance/economy';
import {
  askingSalary,
  competitionOfTeam,
  isExpired,
  isMarketOpen,
  patchUniverse,
  teamPayroll,
  withPlayer,
  withoutPlayer,
} from './market';
import { MARKET, suggestedYears } from './value';

/**
 * Decisions of the human manager in the transfer market. Every function is
 * pure (returns a new universe) and throws an error with a readable message
 * when the move is not allowed. Moves are allowed only between seasons.
 */

function context(universe: Universe): { team: Team; player: (id: string) => Player } {
  if (!universe.userTeamId) throw new Error('Primero elige un equipo.');
  if (!isMarketOpen(universe)) {
    throw new Error(
      'El mercado está cerrado: solo se puede fichar, renovar o liberar entre temporadas.',
    );
  }
  const team = universe.teams.find((t) => t.id === universe.userTeamId) as Team;
  const byId = new Map(universe.players.map((p) => [p.id, p]));
  return {
    team,
    player: (id) => {
      const found = byId.get(id);
      if (!found) throw new Error(`Jugador "${id}" no encontrado.`);
      return found;
    },
  };
}

/** The error for a signing or renewal that does not fit the club's salary limit. */
function overBudget(team: Team, competition: Competition, salary: number, payroll: number): Error {
  const euro = (n: number): string => `${Math.round(n).toLocaleString('es-ES')} €`;
  if (isFinanciallyRestricted(team)) {
    return new Error(
      `Tu club está en números rojos (${euro(team.finance.balance)}, más allá del descubierto permitido de ${euro(overdraftLimit(team))}) y no puede asumir nuevos salarios.`,
    );
  }
  const limit = effectiveSalaryLimit(team, competition);
  const why =
    limit < competition.salaryCap
      ? `tu presupuesto salarial es de ${euro(limit)} (el ${Math.round(100 * competition.economy.wageShare)} % de tus ingresos; el tope de la liga es ${euro(competition.salaryCap)})`
      : `el tope salarial de la liga es de ${euro(limit)}`;
  return new Error(
    `No cabe: pide ${euro(salary)} y ${why}; te quedan ${euro(Math.max(0, limit - payroll))} de margen.`,
  );
}

function checkYears(years: number): void {
  if (!Number.isInteger(years) || years < 1 || years > MARKET.maxYears) {
    throw new Error(`Un contrato dura entre 1 y ${MARKET.maxYears} temporadas.`);
  }
}

function transaction(
  universe: Universe,
  type: Transaction['type'],
  player: Player,
  teamId: string,
  salary: number | null,
  endSeason: number | null,
  cost: number | null = null,
): Transaction {
  return {
    seasonNumber: universe.seasonNumber,
    type,
    playerId: player.id,
    teamId,
    salary,
    endSeason,
    cost,
  };
}

/** Salary the user's club pays to sign a free agent, and the largest payroll still allowed. */
export function offerFor(universe: Universe, playerId: string): { salary: number; room: number } {
  const { team, player } = context(universe);
  const competition = competitionOfTeam(universe, team.id);
  return {
    salary: askingSalary(player(playerId), competition),
    room: effectiveSalaryLimit(team, competition) - teamPayroll(universe, team.id),
  };
}

/** Signs a free agent for `years` seasons at his asking salary. */
export function signFreeAgent(universe: Universe, playerId: string, years: number): Universe {
  const { team, player } = context(universe);
  checkYears(years);
  const target = player(playerId);
  if (target.teamId !== null || target.retired)
    throw new Error(`${target.firstName} ${target.lastName} no es agente libre.`);
  const competition = competitionOfTeam(universe, team.id);
  const staying = team.playerIds.length;
  if (staying >= competition.rosterMax) {
    throw new Error(
      `Tu plantilla ya tiene el máximo de ${competition.rosterMax} jugadores. Libera a alguno antes.`,
    );
  }
  const salary = askingSalary(target, competition);
  const payroll = teamPayroll(universe, team.id) - expiringSalaries(universe, team);
  if (
    payroll + salary > effectiveSalaryLimit(team, competition) &&
    salary > competition.minSalary
  ) {
    throw overBudget(team, competition, salary, payroll);
  }
  const endSeason = universe.seasonNumber + years - 1;
  return patchUniverse(universe, {
    players: new Map([
      [target.id, { ...target, teamId: team.id, contract: { salary, endSeason } }],
    ]),
    teams: new Map([[team.id, withPlayer(team, target.id)]]),
    log: [transaction(universe, 'signed', target, team.id, salary, endSeason)],
  });
}

/** Salaries that stop counting because the contract is already over. */
function expiringSalaries(universe: Universe, team: Team): number {
  const byId = new Map(universe.players.map((p) => [p.id, p]));
  return team.playerIds.reduce((sum, id) => {
    const p = byId.get(id) as Player;
    return sum + (isExpired(universe, p) ? (p.contract?.salary ?? 0) : 0);
  }, 0);
}

/** Renews (or extends) the contract of one of the user's players at his asking salary. */
export function renewContract(universe: Universe, playerId: string, years: number): Universe {
  const { team, player } = context(universe);
  checkYears(years);
  const target = player(playerId);
  if (target.teamId !== team.id || !target.contract) {
    throw new Error(`${target.firstName} ${target.lastName} no es de tu equipo.`);
  }
  if (target.contract.endSeason > universe.seasonNumber) {
    throw new Error(
      `${target.firstName} ${target.lastName} tiene contrato hasta la temporada ${target.contract.endSeason}: solo se renueva a quien tiene un año de contrato o menos.`,
    );
  }
  const competition = competitionOfTeam(universe, team.id);
  const salary = askingSalary(target, competition, true);
  const others =
    teamPayroll(universe, team.id) -
    target.contract.salary -
    expiringSalaries(universe, team) +
    (isExpired(universe, target) ? target.contract.salary : 0);
  if (others + salary > effectiveSalaryLimit(team, competition) && salary > competition.minSalary) {
    throw overBudget(team, competition, salary, others);
  }
  const endSeason = universe.seasonNumber + years - 1;
  return patchUniverse(universe, {
    players: new Map([[target.id, { ...target, contract: { salary, endSeason } }]]),
    log: [transaction(universe, 'renewed', target, team.id, salary, endSeason)],
  });
}

/**
 * Releases a player to the free-agent pool. The club pays severance: a share
 * of the salary of the seasons left on his contract (nothing if the contract
 * has already run out). The club needs the cash: it cannot go beyond its
 * permitted overdraft to pay it.
 */
export function releasePlayer(universe: Universe, playerId: string): Universe {
  const { team, player } = context(universe);
  const target = player(playerId);
  if (target.teamId !== team.id)
    throw new Error(`${target.firstName} ${target.lastName} no es de tu equipo.`);
  if (team.playerIds.length <= 5)
    throw new Error('Una plantilla no puede quedarse con menos de 5 jugadores.');
  const cost = isExpired(universe, target) ? 0 : severanceCost(target, universe.seasonNumber);
  if (team.finance.balance - cost < -overdraftLimit(team)) {
    throw new Error(
      `No puedes pagar la indemnización de ${cost.toLocaleString('es-ES')} € (el ${Math.round(100 * FINANCE.severanceShare)} % del salario de los años que le quedan): tu caja es de ${team.finance.balance.toLocaleString('es-ES')} € y el descubierto permitido llega a ${(-overdraftLimit(team)).toLocaleString('es-ES')} €.`,
    );
  }
  return patchUniverse(universe, {
    players: new Map([[target.id, { ...target, teamId: null, contract: null }]]),
    teams: new Map([
      [
        team.id,
        {
          ...withoutPlayer(team, target.id),
          finance: { ...team.finance, balance: team.finance.balance - cost },
        },
      ],
    ]),
    log: [transaction(universe, 'released', target, team.id, null, null, cost)],
  });
}

/** Years a club would normally offer this player (used as the default in the UI). */
export function defaultYears(player: Pick<Player, 'age'>): number {
  return suggestedYears(player.age);
}
