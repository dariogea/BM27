/**
 * Version of the data contract. Bump on any breaking change and add a migration
 * in `migrations.ts`.
 *
 * History:
 *   0 — T-001: first contract.
 *   1 — T-002: teams gain `tactics`.
 *   2 — T-003: teams gain `rotation`; universe gains `userTeamId` and `currentSeason`.
 *   3 — T-004: players gain `potential`.
 *   4 — T-005: players gain `contract`; competitions gain salary cap and roster limits;
 *       universe gains `transactions`.
 *   5 — T-006: teams gain `reputation` and `finance`; competitions gain `economy`; seasons gain
 *       `finance`; transactions gain `cost`.
 *   6 — T-028: players gain `injury`; rulesets gain timeouts and `technicalFoulsForEjection`;
 *       match events gain `jump_ball`, `timeout` and `injury`, and fouls gain the kinds `technical`
 *       and `unsportsmanlike`.
 *   7 — #21: universe gains persisted custom namePool and dataPackId; versioned JSON data packs.
 *   8 — #79: stable explicit club definitions and persisted identity/source claims.
 */
export const SCHEMA_VERSION = 8 as const;
