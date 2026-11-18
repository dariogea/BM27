import { PALETTES, type PaletteId } from './palette';
import type { GameView } from './protocol';
import { requiresTeam, TABS, type Tab } from './navigation';

const SECTIONS: [Tab, string][] = [
  ['portal', 'Portal'],
  ['team', 'Plantilla'],
  ['tactics', 'Táctica'],
  ['market', 'Captación'],
  ['finance', 'Club'],
  ['competition', 'Competiciones'],
  ['world', 'Mundo'],
];

export function ManagerHeader(props: {
  view: GameView | null;
  active: Tab;
  busy: boolean;
  theme: 'dark' | 'light';
  compact: boolean;
  palette: PaletteId;
  onPalette: (palette: PaletteId) => void;
  onTheme: () => void;
  onCompact: (compact: boolean) => void;
  onNavigate: (tab: Tab) => void;
  onWatch: () => void;
  onAdvance: () => void;
}) {
  const { view, active } = props;
  const group = active === 'lineup' ? 'team' : active === 'match' ? 'competition' : active;
  return (
    <header className={view ? 'manager-header' : 'manager-header title-header'}>
      <div className="manager-topbar">
        <a className="manager-brand" href="#workspace" aria-label="BM27, ir al contenido">
          <span className="basketball-mark" aria-hidden="true">
            B
          </span>
          <span>
            BM<span className="brand-year">27</span>
          </span>
        </a>
        <nav className="primary-nav" aria-label="Navegación principal" tabIndex={0}>
          {SECTIONS.map(([id, label]) => (
            <button
              key={id}
              className={group === id ? 'selected' : ''}
              aria-pressed={group === id}
              disabled={!view || (requiresTeam(id) && !view.myTeam)}
              onClick={() => props.onNavigate(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="header-utilities">
          <details className="appearance-menu">
            <summary>Apariencia</summary>
            <div className="appearance-panel">
              <strong>Apariencia del juego</strong>
              <button onClick={props.onTheme}>
                {props.theme === 'dark' ? '☀ Modo claro' : '☾ Modo oscuro'}
              </button>
              <div role="group" aria-label="Paleta de color" className="palette-choice">
                {PALETTES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={props.palette === p.id}
                    onClick={() => props.onPalette(p.id)}
                  >
                    <span
                      className="palette-swatch"
                      aria-hidden="true"
                      style={{ background: p[props.theme].accent }}
                    />
                    {p.label}
                  </button>
                ))}
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={props.compact}
                  onChange={(e) => props.onCompact(e.target.checked)}
                />{' '}
                Tablas compactas
              </label>
            </div>
          </details>
          <div className="game-clock">
            <strong>{view ? `Temporada ${view.seasonNumber}` : 'Basketball Manager 2027'}</strong>
            <span>
              {view?.seasonInProgress ? `Jornada ${view.step}` : 'Preparación de temporada'}
            </span>
          </div>
          {view?.myTeam && (
            <button
              type="button"
              className="watch-match-button"
              onClick={props.onWatch}
              disabled={props.busy}
            >
              Jugar y ver
            </button>
          )}
          <button
            className="continue-button"
            disabled={props.busy || !view}
            onClick={props.onAdvance}
          >
            {props.busy ? 'Procesando…' : 'Jugar jornada'} <span aria-hidden="true">»</span>
          </button>
        </div>
      </div>
      <div className="manager-subbar">
        <span className="workspace-label">{view?.myTeam?.name ?? 'Sin club'}</span>
        <nav className="secondary-nav" aria-label="Secciones de la partida">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              className={active === id ? 'active' : ''}
              aria-pressed={active === id}
              disabled={id !== 'saves' && (!view || (requiresTeam(id) && !view.myTeam))}
              onClick={() => props.onNavigate(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
