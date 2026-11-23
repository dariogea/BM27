/**
 * Differences between running in a browser and running inside the BM27 desktop app (Tauri).
 *
 * In the desktop app, saves are real files chosen with the operating system's dialogs. In a
 * browser, a save is downloaded and loading uses a hidden file input. The Tauri modules are
 * imported on demand, so the browser build never loads them.
 */

/** True when the page runs inside the desktop app. */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export type SaveResult = { kind: 'saved'; where: string } | { kind: 'cancelled' };

const FILTERS = [{ name: 'Partida de BM27', extensions: ['json'] }];

/** Saves `text` as a file. In the desktop app the player chooses where; in a browser it downloads. */
export async function saveTextFile(
  fileName: string,
  text: string,
  format: 'json' | 'csv' = 'json',
): Promise<SaveResult> {
  if (isDesktop()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const path = await save({
      defaultPath: fileName,
      filters: format === 'csv' ? [{ name: 'Tabla CSV de BM27', extensions: ['csv'] }] : FILTERS,
    });
    if (!path) return { kind: 'cancelled' };
    await writeTextFile(path, text);
    return { kind: 'saved', where: path };
  }
  const url = URL.createObjectURL(
    new Blob([text], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return { kind: 'saved', where: fileName };
}

/**
 * Lets the player pick a save file in the desktop app and returns its text, or null if they
 * cancel. Only for the desktop app: a browser uses a file input instead.
 */
export async function pickTextFile(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const path = await open({ multiple: false, directory: false, filters: FILTERS });
  if (typeof path !== 'string') return null;
  return readTextFile(path);
}
