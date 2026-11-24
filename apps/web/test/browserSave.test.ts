import { describe, expect, it, vi } from 'vitest';
import { exportSave, generateUniverseFromDataPack, importSave, sha256Hex } from '@bm27/core';
import sample from '../../../data/packs/example-eight-clubs.json';
import { exportBrowserSave, importBrowserSave } from '../src/browserSave';

const universe = generateUniverseFromDataPack(sample, 'guardado-ñ-🏀');
const standard = exportSave(universe);

describe('browser save checksums', () => {
  it('produces the identical portable file with native SHA-256', async () => {
    const digest = vi.spyOn(globalThis.crypto.subtle, 'digest');
    try {
      const browserFile = await exportBrowserSave(universe);
      expect(browserFile).toBe(standard);
      expect(importSave(browserFile)).toEqual(universe);
      expect(await importBrowserSave(standard)).toEqual(universe);
      expect(digest).toHaveBeenCalledTimes(2);
    } finally {
      digest.mockRestore();
    }
  });

  it('reads older saves with the same migrations and rejects a changed payload', async () => {
    const legacy = {
      ...universe,
      schemaVersion: 7,
      teams: universe.teams.map(({ identity: _identity, ...team }) => team),
    };
    const oldFile = JSON.stringify({
      format: 'bm27-save',
      schemaVersion: 7,
      checksum: `sha256:${sha256Hex(JSON.stringify(legacy))}`,
      payload: legacy,
    });
    expect(await importBrowserSave(oldFile)).toEqual(importSave(oldFile));
    await expect(importBrowserSave(oldFile.replace('guardado-ñ-', 'modificado-'))).rejects.toThrow(
      /checksum/,
    );
  });

  it('has the same results when native hashing is unavailable', async () => {
    vi.stubGlobal('crypto', undefined);
    try {
      expect(await exportBrowserSave(universe)).toBe(standard);
      expect(await importBrowserSave(standard)).toEqual(universe);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
