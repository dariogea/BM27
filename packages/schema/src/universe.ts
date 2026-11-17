import { z } from 'zod';
import { CompetitionSchema, EconomySchema } from './competition';
import { PlayerSchema } from './player';
import { RulesetSchema } from './ruleset';
import { SeasonProgressSchema, SeasonSchema, TransactionSchema } from './season';
import { TeamSchema } from './team';
import { SCHEMA_VERSION } from './version';
import { NamePoolSchema } from './names';
export { NamePoolSchema, type NamePool } from './names';

export const UniverseSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    /** Seed chosen by the user. All randomness derives from it. */
    seed: z.string(),
    /** Identity of the external data pack, or null for the built-in generator. */
    dataPackId: z.string().min(1).nullable(),
    /** Custom names must survive saving and later youth generation. Null selects built-in names. */
    namePool: NamePoolSchema.nullable(),
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
    /** Moves in the transfer market during the last few seasons, oldest first. */
    transactions: z.array(TransactionSchema),
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
    // Contracts and club membership must agree.
    const teamOfPlayer = new Map<string, string>();
    for (const t of u.teams) for (const pid of t.playerIds) teamOfPlayer.set(pid, t.id);
    u.players.forEach((p, i) => {
      const hasClub = p.teamId !== null;
      if (p.retired && (hasClub || p.contract !== null)) {
        ctx.addIssue({
          code: 'custom',
          path: ['players', i],
          message: `retired player "${p.id}" must have no club and no contract`,
        });
      } else if (hasClub !== (p.contract !== null)) {
        ctx.addIssue({
          code: 'custom',
          path: ['players', i, 'contract'],
          message: `player "${p.id}" must have a contract exactly when he has a club`,
        });
      }
      if ((teamOfPlayer.get(p.id) ?? null) !== p.teamId) {
        ctx.addIssue({
          code: 'custom',
          path: ['players', i, 'teamId'],
          message: `player "${p.id}" says he plays for ${p.teamId ?? 'nobody'}, but the team lists disagree`,
        });
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
        salaryCap: z.number().int().min(0),
        minSalary: z.number().int().min(0),
        economy: EconomySchema,
      }),
    )
    .min(1),
});
export type UniverseConfig = z.infer<typeof UniverseConfigSchema>;
