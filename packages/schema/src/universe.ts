import { z } from 'zod';
import { CompetitionSchema } from './competition';
import { PlayerSchema } from './player';
import { RulesetSchema } from './ruleset';
import { SeasonProgressSchema, SeasonSchema } from './season';
import { TeamSchema } from './team';
import { SCHEMA_VERSION } from './version';

export const UniverseSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    /** Seed chosen by the user. All randomness derives from it. */
    seed: z.string(),
    /** Next season to be simulated (1-based). */
    seasonNumber: z.number().int().min(1),
    /** Counter used to mint ids for newly generated players. */
    nextPlayerSeq: z.number().int().min(1),
    /** Regions in geographic order; used to split teams into regional groups. */
    regions: z.array(z.string().min(1)),
    /** Average attribute quality of newly generated players, by competition level. */
    qualityByLevel: z.record(z.string(), z.number()),
    rulesets: z.array(RulesetSchema).min(1),
    competitions: z.array(CompetitionSchema).min(1),
    teams: z.array(TeamSchema).min(2),
    players: z.array(PlayerSchema),
    /** Completed seasons, oldest first. */
    history: z.array(SeasonSchema),
    /** Season being played right now, or null between seasons. */
    currentSeason: SeasonProgressSchema.nullable(),
    /** Team managed by the human player, or null to just watch. */
    userTeamId: z.string().min(1).nullable(),
  })
  .superRefine((u, ctx) => {
    const rulesetIds = new Set(u.rulesets.map((r) => r.id));
    const teamIds = new Set(u.teams.map((t) => t.id));
    if (teamIds.size !== u.teams.length) {
      ctx.addIssue({ code: 'custom', path: ['teams'], message: 'duplicate team ids' });
    }
    const playerIds = new Set<string>();
    for (const p of u.players) playerIds.add(p.id);
    if (playerIds.size !== u.players.length) {
      ctx.addIssue({ code: 'custom', path: ['players'], message: 'duplicate player ids' });
    }
    u.competitions.forEach((c, i) => {
      if (!rulesetIds.has(c.rulesetId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['competitions', i, 'rulesetId'],
          message: `unknown ruleset "${c.rulesetId}"`,
        });
      }
      for (const t of c.teamIds) {
        if (!teamIds.has(t)) {
          ctx.addIssue({
            code: 'custom',
            path: ['competitions', i, 'teamIds'],
            message: `unknown team "${t}"`,
          });
          break;
        }
      }
    });
    if (u.userTeamId !== null && !teamIds.has(u.userTeamId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['userTeamId'],
        message: `unknown team "${u.userTeamId}"`,
      });
    }
    if (u.currentSeason && u.currentSeason.seasonNumber !== u.seasonNumber) {
      ctx.addIssue({
        code: 'custom',
        path: ['currentSeason', 'seasonNumber'],
        message: 'the season in progress does not match the universe season number',
      });
    }
    u.teams.forEach((t, i) => {
      if (t.rotation) {
        const roster = new Set(t.playerIds);
        if (new Set(t.rotation).size !== t.rotation.length) {
          ctx.addIssue({
            code: 'custom',
            path: ['teams', i, 'rotation'],
            message: 'a player appears twice in the rotation',
          });
        }
        const stranger = t.rotation.find((p) => !roster.has(p));
        if (stranger) {
          ctx.addIssue({
            code: 'custom',
            path: ['teams', i, 'rotation'],
            message: `player "${stranger}" is not in this team`,
          });
        }
      }
      for (const p of t.playerIds) {
        if (!playerIds.has(p)) {
          ctx.addIssue({
            code: 'custom',
            path: ['teams', i, 'playerIds'],
            message: `unknown player "${p}"`,
          });
          break;
        }
      }
    });
  });
export type Universe = z.infer<typeof UniverseSchema>;

/** Configuration (pure data) from which a fictional universe is generated. */
export const UniverseConfigSchema = z.object({
  id: z.string().min(1),
  regions: z.array(z.string().min(1)).min(1),
  rosterSize: z.object({ min: z.number().int().min(5), max: z.number().int().min(5) }),
  levels: z
    .array(
      z.object({
        competitionId: z.string().min(1),
        name: z.string().min(1),
        level: z.number().int().min(1),
        rulesetId: z.string().min(1),
        teamCount: z.number().int().min(2),
        averageQuality: z.number().min(1).max(99),
        format: CompetitionSchema.shape.format,
        promotionSlots: z.number().int().min(0),
        relegationSlots: z.number().int().min(0),
      }),
    )
    .min(1),
});
export type UniverseConfig = z.infer<typeof UniverseConfigSchema>;

export const NamePoolSchema = z.object({
  cities: z.array(z.object({ name: z.string().min(1), region: z.string().min(1) })).min(1),
  teamNicknames: z.array(z.string().min(1)).min(1),
  firstNames: z.array(z.string().min(1)).min(1),
  lastNames: z.array(z.string().min(1)).min(1),
});
export type NamePool = z.infer<typeof NamePoolSchema>;
