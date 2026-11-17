export type Tab =
  | 'portal'
  | 'team'
  | 'tactics'
  | 'lineup'
  | 'market'
  | 'finance'
  | 'competition'
  | 'match'
  | 'saves';

export const TABS: [Tab, string][] = [
  ['portal', 'Portal'],
  ['team', 'Mi equipo'],
  ['tactics', 'Tácticas'],
  ['lineup', 'Quinteto'],
  ['market', 'Mercado'],
  ['finance', 'Finanzas'],
  ['competition', 'Competición'],
  ['match', 'Partido'],
  ['saves', 'Partidas'],
];

export const requiresTeam = (tab: Tab): boolean =>
  tab === 'team' || tab === 'tactics' || tab === 'lineup' || tab === 'market' || tab === 'finance';
