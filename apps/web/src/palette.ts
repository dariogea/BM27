/**
 * Accent palettes and generated club colours.
 *
 * Palettes only change the accent pair; backgrounds, text and status colours stay in the
 * documented theme tokens so every palette keeps the same contrast rules (see docs/diseno.md).
 * Club colours here are GENERATED from the club id, never real club colours (pillar 7).
 */
export type ThemeName = 'dark' | 'light';
export type PaletteId = 'violeta' | 'azul' | 'verde' | 'ambar' | 'rojo';

export interface AccentPair {
  accent: string;
  accentText: string;
}
export interface Palette {
  id: PaletteId;
  label: string;
  dark: AccentPair;
  light: AccentPair;
}

export const PALETTES: readonly Palette[] = [
  {
    id: 'violeta',
    label: 'Violeta',
    dark: { accent: '#f4a0ff', accentText: '#210b28' },
    light: { accent: '#83268f', accentText: '#ffffff' },
  },
  {
    id: 'azul',
    label: 'Azul',
    dark: { accent: '#7fb4ff', accentText: '#07182e' },
    light: { accent: '#1b4f9c', accentText: '#ffffff' },
  },
  {
    id: 'verde',
    label: 'Verde',
    dark: { accent: '#6fdc9f', accentText: '#06231a' },
    light: { accent: '#146a43', accentText: '#ffffff' },
  },
  {
    id: 'ambar',
    label: 'Ámbar',
    dark: { accent: '#ffc25c', accentText: '#2a1a00' },
    light: { accent: '#8a5200', accentText: '#ffffff' },
  },
  {
    id: 'rojo',
    label: 'Rojo',
    dark: { accent: '#ff8f9e', accentText: '#2e0a12' },
    light: { accent: '#a51d36', accentText: '#ffffff' },
  },
];

export const DEFAULT_PALETTE: PaletteId = 'violeta';

export function isPaletteId(value: unknown): value is PaletteId {
  return PALETTES.some((p) => p.id === value);
}

export function paletteVars(id: PaletteId, theme: ThemeName): Record<string, string> {
  const palette = PALETTES.find((p) => p.id === id) ?? PALETTES[0]!;
  const pair = palette[theme];
  return { '--accent': pair.accent, '--accent-text': pair.accentText };
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export interface GeneratedClubColours {
  /** Fill; white text on it always reaches AA contrast. */
  fill: string;
  /** Border / secondary stripe. */
  edge: string;
  generated: true;
}
/** Deterministic placeholder colours for a club id. NOT the club's real colours. */
export function generatedClubColours(clubId: string): GeneratedClubColours {
  const h = hash(clubId);
  const hue = h % 360;
  return {
    fill: hslToHex(hue, 0.55, 0.3),
    edge: hslToHex((hue + 40) % 360, 0.7, 0.62),
    generated: true,
  };
}

/** Up to two initials, ignoring short connectors. */
export function clubInitials(name: string): string {
  const words = name.split(/\s+/).filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(w));
  const letters = (words.length ? words : name.split(/\s+/)).map((w) => w[0] ?? '');
  return letters.slice(0, 2).join('').toUpperCase() || 'BM';
}
