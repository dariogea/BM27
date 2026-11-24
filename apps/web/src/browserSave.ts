import { exportSaveWithDigest, importSaveWithDigest, sha256Hex } from '@bm27/core';
import type { Universe } from '@bm27/schema';

async function saveDigest(payload: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return sha256Hex(payload);
  const bytes = new TextEncoder().encode(payload);
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function exportBrowserSave(universe: Universe): Promise<string> {
  return exportSaveWithDigest(universe, saveDigest);
}

export function importBrowserSave(json: string): Promise<Universe> {
  return importSaveWithDigest(json, saveDigest);
}
