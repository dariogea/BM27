const cell = (value: string | number): string => {
  if (typeof value === 'number') return String(value).replace('.', ',');
  const text = /^\s*[=+@-]/u.test(value) ? `'${value}` : value;
  return `"${text.replaceAll('"', '""')}"`;
};

export function spreadsheetCsv(rows: readonly (readonly (string | number)[])[]): string {
  return '\uFEFF' + rows.map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n';
}
