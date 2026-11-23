import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ save: vi.fn(), writeTextFile: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: mocks.save }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeTextFile: mocks.writeTextFile }));
import { saveTextFile } from '../src/platform';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', { __TAURI_INTERNALS__: {} });
});
afterEach(() => vi.unstubAllGlobals());

it('uses the CSV native filter and writes exactly the exported content', async () => {
  mocks.save.mockResolvedValue('/selected/leaders.csv');
  const result = await saveTextFile('leaders.csv', 'contents', 'csv');
  expect(mocks.save).toHaveBeenCalledWith({
    defaultPath: 'leaders.csv',
    filters: [{ name: 'Tabla CSV de BM27', extensions: ['csv'] }],
  });
  expect(mocks.writeTextFile).toHaveBeenCalledWith('/selected/leaders.csv', 'contents');
  expect(result).toEqual({ kind: 'saved', where: '/selected/leaders.csv' });
});

it('preserves the JSON save behavior for existing callers', async () => {
  mocks.save.mockResolvedValue('/selected/game.json');
  await saveTextFile('game.json', '{"save":true}');
  expect(mocks.save).toHaveBeenCalledWith({
    defaultPath: 'game.json',
    filters: [{ name: 'Partida de BM27', extensions: ['json'] }],
  });
  expect(mocks.writeTextFile).toHaveBeenCalledWith('/selected/game.json', '{"save":true}');
});

it('does not write a cancelled export and passes native write failures to the caller', async () => {
  mocks.save.mockResolvedValue(null);
  expect(await saveTextFile('leaders.csv', 'contents', 'csv')).toEqual({ kind: 'cancelled' });
  expect(mocks.writeTextFile).not.toHaveBeenCalled();
  mocks.save.mockResolvedValue('/selected/leaders.csv');
  mocks.writeTextFile.mockRejectedValue(new Error('disk full'));
  await expect(saveTextFile('leaders.csv', 'contents', 'csv')).rejects.toThrow('disk full');
});
