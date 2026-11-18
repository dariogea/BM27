import type { MatchResult } from '@bm27/schema';
import { describe, expect, it } from 'vitest';
import { formOf, sortStandings, winShare, type StandingRow } from '../src/competitionData';

const row = (
  position: number,
  teamId: string,
  wins: number,
  losses: number,
  pf: number,
  pa: number,
): StandingRow =>
  ({
    position,
    teamId,
    played: wins + losses,
    wins,
    losses,
    pointsFor: pf,
    pointsAgainst: pa,
  }) as StandingRow;

const rows = [
  row(1, 'b', 5, 1, 480, 400),
  row(2, 'a', 5, 1, 470, 410),
  row(3, 'c', 2, 4, 400, 450),
  row(4, 'd', 0, 0, 0, 0),
];
const name = (id: string): string =>
  ({ a: 'Águilas', b: 'Bisontes', c: 'Cóndores', d: 'Delfines' })[id] ?? id;

describe('sortStandings', () => {
  it('keeps the league order by default and does not modify its input', () => {
    const copy = [...rows];
    expect(sortStandings(rows, 'position', false, name).map((r) => r.teamId)).toEqual([
      'b',
      'a',
      'c',
      'd',
    ]);
    expect(rows).toEqual(copy);
  });

  it('sorts numeric columns both ways, breaking ties with the league position', () => {
    // wins: b and a tie on 5, so b (position 1) goes first
    expect(sortStandings(rows, 'wins', true, name).map((r) => r.teamId)).toEqual([
      'b',
      'a',
      'c',
      'd',
    ]);
    expect(sortStandings(rows, 'wins', false, name).map((r) => r.teamId)).toEqual([
      'd',
      'c',
      'b',
      'a',
    ]);
    expect(sortStandings(rows, 'difference', true, name).map((r) => r.teamId)).toEqual([
      'b',
      'a',
      'd',
      'c',
    ]);
    expect(sortStandings(rows, 'pointsAgainst', false, name).map((r) => r.teamId)).toEqual([
      'd',
      'b',
      'a',
      'c',
    ]);
  });

  it('sorts team names alphabetically in Spanish', () => {
    expect(sortStandings(rows, 'name', false, name).map((r) => name(r.teamId))).toEqual([
      'Águilas',
      'Bisontes',
      'Cóndores',
      'Delfines',
    ]);
  });

  it('computes the share of games won, 0 before any game', () => {
    expect(winShare(rows[0]!)).toBeCloseTo(5 / 6);
    expect(winShare(rows[3]!)).toBe(0);
    expect(sortStandings(rows, 'percentage', true, name)[0]!.teamId).toBe('b');
  });
});

const game = (
  id: string,
  stage: 'regular' | 'playoff',
  round: number,
  home: string,
  away: string,
  hs: number,
  as: number,
): MatchResult => ({
  id,
  seasonNumber: 1,
  competitionId: 'c',
  stage,
  round,
  homeTeamId: home,
  awayTeamId: away,
  homeScore: hs,
  awayScore: as,
  overtimePeriods: 0,
});

describe('formOf', () => {
  const matches = [
    game('m3', 'regular', 3, 'x', 'a', 70, 80), // a wins away
    game('m1', 'regular', 1, 'a', 'x', 60, 70), // a loses at home
    game('m2', 'regular', 2, 'a', 'y', 90, 85), // a wins
    game('m4', 'regular', 4, 'a', 'z', 50, 55), // a loses
    game('p1', 'playoff', 1, 'a', 'y', 99, 80), // a wins (playoff, after the regular season)
    game('o1', 'regular', 1, 'y', 'z', 10, 20), // not a's
  ];

  it('lists the last results oldest first, regular season before playoffs', () => {
    expect(formOf(matches, 'a')).toEqual(['L', 'W', 'W', 'L', 'W']);
  });

  it('keeps only the last N and handles teams with no games', () => {
    expect(formOf(matches, 'a', 2)).toEqual(['L', 'W']);
    expect(formOf(matches, 'nobody')).toEqual([]);
  });

  it('is decided by the scoreboard of the right side', () => {
    expect(formOf([game('m', 'regular', 1, 'a', 'b', 70, 80)], 'b')).toEqual(['W']);
    expect(formOf([game('m', 'regular', 1, 'a', 'b', 70, 80)], 'a')).toEqual(['L']);
  });

  it('keeps the playing order of a long series (ids are text: game 10 sorts before game 2)', () => {
    // An 11-game series in the same round, delivered in the order played; the team wins only 7–11.
    const series = Array.from({ length: 11 }, (_, i) =>
      game(`s-p1-1-${i + 1}`, 'playoff', 1, 'a', 'b', i + 1 >= 7 ? 90 : 60, 80),
    );
    expect(formOf(series, 'a')).toEqual(['W', 'W', 'W', 'W', 'W']);
    expect(formOf(series, 'a', 11)).toEqual([...'LLLLLLWWWWW']);
  });
});
