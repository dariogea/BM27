import { expect, it } from 'vitest';
import { leadersCsv } from '../src/leaderCsv';
import type { LeagueRecordsPayload } from '../src/leagueRecordsTypes';

const data: LeagueRecordsPayload = {
  kind: 'records',
  competitionId: 'c',
  competitionName: 'Liga de prueba',
  season: 2,
  completed: false,
  seasons: [2, 1],
  metric: 'points',
  mode: 'per40',
  total: 100,
  minGames: 3,
  minMinutes: 50,
  minAttempts: 0,
  honours: [],
  rows: [
    {
      rank: 1,
      playerId: 'p',
      name: 'Ana; "Luz"\nSur',
      teamId: 't',
      teamName: '=1+1',
      games: 4,
      numerator: 61,
      denominator: 4800,
      value: 30.5,
    },
  ],
};

it('exports only the visible rows, preserves exact rate units and escapes imported names', () => {
  const before = JSON.stringify(data);
  const csv = leadersCsv(data);
  expect(csv.startsWith('\uFEFF')).toBe(true);
  expect(csv).toContain('"Ana; ""Luz""\nSur"');
  expect(csv).toContain('"\'=1+1"');
  expect(csv).toContain(';30,5;61;4800;"segundos";2400');
  expect(csv).toContain(
    '"Liga de prueba";2;"En curso";"Puntos";"Por 40 minutos";"por 40 min";3;50;0;',
  );
  expect(csv).not.toContain(';100;');
  expect(JSON.stringify(data)).toBe(before);
});

it('keeps percentage units, the actual shooting base and a header for an empty table', () => {
  const percentage = leadersCsv({
    ...data,
    metric: 'threePointPercent',
    minAttempts: 10,
    rows: [{ ...data.rows[0]!, numerator: 6, denominator: 12, value: 50 }],
  });
  expect(percentage).toContain('"% triples";"Porcentaje de aciertos";"%"');
  expect(percentage).toContain(';50;6;12;"intentos";100');
  expect(
    leadersCsv({ ...data, rows: [] })
      .trim()
      .split('\r\n'),
  ).toHaveLength(1);
});
