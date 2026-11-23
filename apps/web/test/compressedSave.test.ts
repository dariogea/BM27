import { expect, it } from 'vitest';
import { compressSave, readSaveFile } from '../src/compressedSave';

it('loads plain and compressed saves with the same UTF-8 content', async () => {
  const save = JSON.stringify({ club: 'Peña Águilas', scores: Array(1000).fill(82) });
  const compressed = await compressSave(save);
  expect(compressed.size).toBeLessThan(new Blob([save]).size);
  expect(await readSaveFile(compressed)).toBe(save);
  expect(await readSaveFile(new Blob([save]))).toBe(save);
});

it('rejects a truncated gzip save', async () => {
  const compressed = await compressSave('{"club":"BM27"}');
  await expect(readSaveFile(compressed.slice(0, -5))).rejects.toThrow('dañado');
});
