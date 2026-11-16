import { matchSeed, prepareTeam, sha256Hex } from '@bm27/core';
import type { MatchResult, Team, Universe } from '@bm27/schema';

/** Session-only evidence of the exact engine inputs used by a played match. */
export class ReplayProofs {
  private readonly matches = new Map<string, string>();
  private readonly teams = new WeakMap<Universe['players'], WeakMap<Team, string>>();

  clear(): void {
    this.matches.clear();
  }

  remember(source: Universe, result: MatchResult): void {
    this.matches.set(result.id, this.fingerprint(source, result));
  }

  allows(source: Universe, result: MatchResult): boolean {
    const original = this.matches.get(result.id);
    return original !== undefined && original === this.fingerprint(source, result);
  }

  private fingerprint(source: Universe, result: MatchResult): string {
    let cache = this.teams.get(source.players);
    if (!cache) {
      cache = new WeakMap();
      this.teams.set(source.players, cache);
    }
    const teamKey = (id: string): string => {
      const team = source.teams.find((t) => t.id === id);
      if (!team) throw new Error(`Unknown team ${id}`);
      let key = cache.get(team);
      if (!key) {
        const players = new Map(source.players.map((p) => [p.id, p]));
        key = sha256Hex(JSON.stringify(prepareTeam(team, players)));
        cache.set(team, key);
      }
      return key;
    };
    const competition = source.competitions.find((c) => c.id === result.competitionId);
    const ruleset = source.rulesets.find((r) => r.id === competition?.rulesetId);
    if (!ruleset) throw new Error(`Unknown ruleset for match ${result.id}`);
    return sha256Hex(
      JSON.stringify({
        seed: matchSeed(source.seed, result.id),
        home: teamKey(result.homeTeamId),
        away: teamKey(result.awayTeamId),
        ruleset,
      }),
    );
  }
}
