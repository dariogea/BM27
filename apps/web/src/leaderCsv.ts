import { LEADER_METRICS, type LeagueRecordsPayload } from './leagueRecordsTypes';

const cell = (value: string | number): string => {
  if (typeof value === 'number') return String(value).replace('.', ',');
  const text = /^\s*[=+@-]/u.test(value) ? `'${value}` : value;
  return `"${text.replaceAll('"', '""')}"`;
};

/** Export exactly the displayed rows, with the filters and units needed to interpret them. */
export function leadersCsv(data: LeagueRecordsPayload): string {
  const percentage = data.metric.endsWith('Percent');
  const unit = percentage
    ? '%'
    : data.mode === 'per40'
      ? 'por 40 min'
      : data.mode === 'average'
        ? 'por partido'
        : 'total';
  const baseUnit = percentage
    ? 'intentos'
    : data.mode === 'per40'
      ? 'segundos'
      : data.mode === 'average'
        ? 'partidos'
        : 'unidad';
  const calculation = percentage
    ? 'Porcentaje de aciertos'
    : {
        average: 'Media por partido',
        per40: 'Por 40 minutos',
        total: 'Total acumulado',
      }[data.mode];
  const factor = percentage ? 100 : data.mode === 'per40' ? 2400 : 1;
  const rows: (string | number)[][] = [
    [
      'Competición',
      'Temporada',
      'Estado',
      'Métrica',
      'Cálculo',
      'Unidad',
      'Mínimo de partidos',
      'Mínimo de minutos',
      'Mínimo de intentos',
      'Posición',
      'Jugador',
      'Club',
      'Partidos',
      'Valor',
      'Numerador',
      'Denominador',
      'Unidad de la base',
      'Factor de escala',
    ],
  ];
  for (const row of data.rows) {
    rows.push([
      data.competitionName,
      data.season,
      data.completed ? 'Cerrada' : 'En curso',
      LEADER_METRICS[data.metric],
      calculation,
      unit,
      data.minGames,
      data.minMinutes ?? 0,
      percentage ? data.minAttempts : 0,
      row.rank,
      row.name,
      row.teamName,
      row.games,
      row.value,
      row.numerator,
      row.denominator,
      baseUnit,
      factor,
    ]);
  }
  return '\uFEFF' + rows.map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n';
}
