import { afterEach, describe, expect, it, vi } from 'vitest';

const save = vi.fn();
const open = vi.fn();
const writeTextFile = vi.fn();
const readTextFile = vi.fn();
vi.mock('@tauri-apps/plugin-dialog', () => ({ save, open }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeTextFile, readTextFile }));

type FakeWindow = { __TAURI_INTERNALS__?: unknown };
const fake = globalThis as unknown as { window?: FakeWindow };

afterEach(() => {
  vi.clearAllMocks();
  delete fake.window;
});

describe('desktop app detection', () => {
  it('is false in a browser-like environment and true inside Tauri', async () => {
    const { isDesktop } = await import('../src/platform');
    fake.window = {};
    expect(isDesktop()).toBe(false);
    fake.window = { __TAURI_INTERNALS__: {} };
    expect(isDesktop()).toBe(true);
    delete fake.window;
    expect(isDesktop()).toBe(false);
  });
});

describe('saving and opening files in the desktop app', () => {
  it('writes the save to the file the player picks', async () => {
    const { saveTextFile } = await import('../src/platform');
    fake.window = { __TAURI_INTERNALS__: {} };
    save.mockResolvedValue('C:\\Partidas\\bm27.json');
    const result = await saveTextFile('bm27-demo.json', '{"hola":1}');
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: 'bm27-demo.json' }));
    expect(writeTextFile).toHaveBeenCalledWith('C:\\Partidas\\bm27.json', '{"hola":1}');
    expect(result).toEqual({ kind: 'saved', where: 'C:\\Partidas\\bm27.json' });
  });

  it('writes nothing if the player cancels the dialog', async () => {
    const { saveTextFile } = await import('../src/platform');
    fake.window = { __TAURI_INTERNALS__: {} };
    save.mockResolvedValue(null);
    expect(await saveTextFile('x.json', 'texto')).toEqual({ kind: 'cancelled' });
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('reads the file the player picks, and returns null on cancel', async () => {
    const { pickTextFile } = await import('../src/platform');
    open.mockResolvedValueOnce('C:\\Partidas\\bm27.json');
    readTextFile.mockResolvedValueOnce('{"partida":true}');
    expect(await pickTextFile()).toBe('{"partida":true}');
    expect(readTextFile).toHaveBeenCalledWith('C:\\Partidas\\bm27.json');
    open.mockResolvedValueOnce(null);
    expect(await pickTextFile()).toBeNull();
  });
});

it('uses the CSV native filter and writes exactly the exported content', async () => {
  const { saveTextFile } = await import('../src/platform');
  fake.window = { __TAURI_INTERNALS__: {} };
  save.mockResolvedValue('/selected/leaders.csv');
  const result = await saveTextFile('leaders.csv', 'contents', 'csv');
  expect(save).toHaveBeenCalledWith({
    defaultPath: 'leaders.csv',
    filters: [{ name: 'Tabla CSV de BM27', extensions: ['csv'] }],
  });
  expect(writeTextFile).toHaveBeenCalledWith('/selected/leaders.csv', 'contents');
  expect(result).toEqual({ kind: 'saved', where: '/selected/leaders.csv' });
});

it('preserves the JSON save behavior for existing callers', async () => {
  const { saveTextFile } = await import('../src/platform');
  fake.window = { __TAURI_INTERNALS__: {} };
  save.mockResolvedValue('/selected/game.json');
  await saveTextFile('game.json', '{"save":true}');
  expect(save).toHaveBeenCalledWith({
    defaultPath: 'game.json',
    filters: [{ name: 'Partida de BM27', extensions: ['json'] }],
  });
  expect(writeTextFile).toHaveBeenCalledWith('/selected/game.json', '{"save":true}');
});

it('does not write a cancelled export and passes native write failures to the caller', async () => {
  const { saveTextFile } = await import('../src/platform');
  fake.window = { __TAURI_INTERNALS__: {} };
  save.mockResolvedValue(null);
  expect(await saveTextFile('leaders.csv', 'contents', 'csv')).toEqual({ kind: 'cancelled' });
  expect(writeTextFile).not.toHaveBeenCalled();
  save.mockResolvedValue('/selected/leaders.csv');
  writeTextFile.mockRejectedValue(new Error('disk full'));
  await expect(saveTextFile('leaders.csv', 'contents', 'csv')).rejects.toThrow('disk full');
});
