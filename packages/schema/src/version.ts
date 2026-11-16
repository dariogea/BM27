/**
 * Version of the data contract. Bump on any breaking change and add a migration
 * in `migrations.ts`.
 *
 * History:
 *   0 — T-001: first contract.
 *   1 — T-002: teams gain `tactics`.
 *   2 — T-003: teams gain `rotation`; universe gains `userTeamId` and `currentSeason`.
 */
export const SCHEMA_VERSION = 2 as const;
