import { useCallback, useEffect, useState } from 'react';
import { isDesktop } from './platform';
import { DEFAULT_RELEASES_REPO, checkForUpdate, type UpdateResult } from './update';

const TOKEN_KEY = 'bm27.githubToken';
const REPO_KEY = 'bm27.releasesRepo';

declare const __APP_VERSION__: string;

/** Version of the running app (set at build time from `apps/desktop/package.json`). */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

function read(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function write(key: string, value: string): void {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* storage may be blocked: the setting simply is not remembered */
  }
}

const REASONS: Record<Extract<UpdateResult, { kind: 'unavailable' }>['reason'], string> = {
  'private-or-missing':
    'No se puede leer el repositorio sin permiso (es privado). Pega abajo un token de GitHub de solo lectura.',
  'rate-limited': 'GitHub ha limitado las consultas. Se reintentará al abrir el juego otra vez.',
  offline: 'Sin conexión con GitHub.',
  'bad-answer': 'GitHub respondió algo inesperado.',
  'bad-version': 'Esta compilación no tiene un número de versión conocido.',
};

/**
 * Launcher strip of the desktop app: shows the running version and, when the app starts, checks
 * GitHub for a newer Release. It only informs and links to the Release page (the installer is
 * not signed, so nothing is downloaded or run behind the player's back).
 */
export function UpdateBanner() {
  const desktop = isDesktop();
  const [result, setResult] = useState<UpdateResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [token, setToken] = useState(() => read(TOKEN_KEY));
  const [repo, setRepo] = useState(() => read(REPO_KEY) || DEFAULT_RELEASES_REPO);
  const [copied, setCopied] = useState(false);

  const check = useCallback(async (): Promise<void> => {
    setChecking(true);
    setCopied(false);
    setResult(await checkForUpdate({ current: APP_VERSION, repo, token }));
    setChecking(false);
  }, [repo, token]);

  // The launcher check: once, when the app starts.
  useEffect(() => {
    if (desktop) void check();
  }, []);

  if (!desktop) return null;

  const available = result?.kind === 'available' ? result : null;
  const link = available ? available.release.url || available.release.installerUrl || '' : '';

  return (
    <section className="update-banner" aria-label="Actualizaciones">
      <div className="update-line" role="status">
        <strong>BM27 {APP_VERSION}</strong>
        {checking && <span> · Buscando actualizaciones…</span>}
        {!checking && result?.kind === 'up-to-date' && <span> · Estás en la última versión.</span>}
        {!checking && available && (
          <span className="update-new">
            {' '}
            · Hay una versión nueva: <strong>{available.release.name}</strong>
            {available.release.prerelease ? ' (preliminar)' : ''}
          </span>
        )}
        {!checking && result?.kind === 'unavailable' && <span> · {REASONS[result.reason]}</span>}
        <button className="text-action" disabled={checking} onClick={() => void check()}>
          Buscar ahora
        </button>
        {available && link && (
          <button
            className="text-action"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? 'Enlace copiado' : 'Copiar enlace de descarga'}
          </button>
        )}
      </div>
      {available && (
        <p className="note">
          Pega el enlace en tu navegador (con tu sesión de GitHub abierta), descarga el instalador y
          ejecútalo: la partida guardada se conserva.
        </p>
      )}
      <details className="update-settings">
        <summary>Ajustes de actualización</summary>
        <div className="bar">
          <label>
            Repositorio de versiones{' '}
            <input
              value={repo}
              aria-label="Repositorio de versiones"
              onChange={(e) => {
                setRepo(e.target.value);
                write(REPO_KEY, e.target.value === DEFAULT_RELEASES_REPO ? '' : e.target.value);
              }}
            />
          </label>
          <label>
            Token de GitHub (opcional){' '}
            <input
              type="password"
              value={token}
              aria-label="Token de GitHub"
              autoComplete="off"
              onChange={(e) => {
                setToken(e.target.value);
                write(TOKEN_KEY, e.target.value);
              }}
            />
          </label>
        </div>
        <p className="note">
          El token solo se guarda en este ordenador y solo se envía a GitHub para leer las
          versiones. Hace falta mientras el repositorio sea privado: créalo en GitHub como token de
          acceso de solo lectura (permiso «Contents: Read-only») limitado a este repositorio.
        </p>
      </details>
    </section>
  );
}
