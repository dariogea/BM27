import { describe, expect, it } from 'vitest';
import {
  PALETTES,
  clubInitials,
  contrast,
  generatedClubColours,
  isPaletteId,
  paletteVars,
} from '../src/palette';

const SURFACES = { dark: '#12151f', light: '#ffffff' } as const;

describe('palettes', () => {
  it('every accent keeps AA contrast on the surface and for its own text', () => {
    for (const palette of PALETTES) {
      for (const theme of ['dark', 'light'] as const) {
        const pair = palette[theme];
        expect(
          contrast(pair.accent, SURFACES[theme]),
          `${palette.id}/${theme} surface`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(pair.accentText, pair.accent),
          `${palette.id}/${theme} text`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('has unique ids and a validator', () => {
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length);
    expect(isPaletteId('azul')).toBe(true);
    expect(isPaletteId('rosa')).toBe(false);
    expect(paletteVars('azul', 'light')['--accent']).toBe('#1b4f9c');
  });
});

describe('generated club colours', () => {
  it('are deterministic, flagged as generated and readable with white text', () => {
    expect(generatedClubColours('ACB-X-001')).toEqual(generatedClubColours('ACB-X-001'));
    for (let i = 0; i < 300; i++) {
      const c = generatedClubColours(`club-${i}`);
      expect(c.generated).toBe(true);
      expect(contrast('#ffffff', c.fill)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('builds initials', () => {
    expect(clubInitials('Real Madrid')).toBe('RM');
    expect(clubInitials('Club de Baloncesto Sevilla')).toBe('CB');
    expect(clubInitials('')).toBe('BM');
  });
});
