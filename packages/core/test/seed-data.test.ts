import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Seed {
  status: string;
  competitions: { id: string; level: number; confirmedTeams: number }[];
  teams: { id: string; competitionId: string; group?: string; publicName: string }[];
  rules: { id: string; competitionId: string; key: string }[];
  sources: { id: string }[];
}

const seed: Seed = JSON.parse(
  readFileSync(
    new URL('../../../data/reference/es/season-2026-27/seed.json', import.meta.url),
    'utf8',
  ),
);

describe('seed data 2026-27 (unverified reference)', () => {
  it('is marked as an unverified seed, not as official data', () => {
    expect(seed.status).toBe('seed-unverified');
  });

  it('has the four levels with the confirmed number of teams', () => {
    const byLevel = Object.fromEntries(seed.competitions.map((c) => [c.level, c.confirmedTeams]));
    expect(byLevel).toEqual({ 1: 18, 2: 18, 3: 28, 4: 138 });
    for (const competition of seed.competitions) {
      const teams = seed.teams.filter((t) => t.competitionId === competition.id);
      expect(teams.length, competition.id).toBe(competition.confirmedTeams);
    }
    expect(seed.teams).toHaveLength(202);
  });

  it('keeps the published groups and conferences', () => {
    const count = (competitionId: string) => {
      const groups = new Map<string, number>();
      for (const t of seed.teams.filter((x) => x.competitionId === competitionId)) {
        groups.set(t.group ?? '-', (groups.get(t.group ?? '-') ?? 0) + 1);
      }
      return Object.fromEntries([...groups].sort());
    };
    expect(count('P2')).toEqual({ A: 14, B: 14 });
    expect(count('P3')).toEqual({ A: 28, B: 28, C: 28, D: 26, E: 28 });
  });

  it('has unique identifiers and names, and every rule belongs to a known competition', () => {
    expect(new Set(seed.teams.map((t) => t.id)).size).toBe(seed.teams.length);
    expect(new Set(seed.teams.map((t) => t.publicName)).size).toBe(seed.teams.length);
    expect(new Set(seed.sources.map((s) => s.id)).size).toBe(seed.sources.length);
    const known = new Set(seed.competitions.map((c) => c.id));
    for (const rule of seed.rules) expect(known.has(rule.competitionId), rule.id).toBe(true);
  });

  it('does not contain any person (players and officials stay out until rights are reviewed)', () => {
    expect(Object.keys(seed)).not.toContain('people');
    expect(Object.keys(seed)).not.toContain('players');
  });
});
