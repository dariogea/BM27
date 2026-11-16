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
 */
export const SCHEMA_VERSION = 4 as const;
