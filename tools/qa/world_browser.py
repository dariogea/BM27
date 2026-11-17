import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

reports = []
output = Path(os.environ.get('BM27_SCREENSHOT_DIR', 'docs/screenshots'))
output.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('BM27_CHROMIUM', '/usr/bin/chromium'), headless=True,
        args=['--no-sandbox', '--no-zygote', '--single-process', '--disable-dev-shm-usage', '--disable-gpu'],
        env={**os.environ, 'XDG_CACHE_HOME': '/tmp/bm27-browser-cache'}, timeout=20000)
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script("""
        const RealWorker = window.Worker;
        window.Worker = class extends RealWorker {
            constructor(...args) {
                super(...args);
                this.addEventListener('message', (event) => {
                    if (event.data.type === 'state') window.bm27State = event.data.view;
                    if (event.data.type === 'world') window.bm27World = event.data.result;
                });
            }
        };
    """)
    page.goto(os.environ.get('BM27_WEB_URL', 'http://127.0.0.1:5173'), wait_until='domcontentloaded')
    page.get_by_role('button', name='Generar universo', exact=True).click()
    page.get_by_test_id('summary').wait_for()
    page.get_by_role('button', name='Dirigir este equipo', exact=True).click()
    page.get_by_role('button', name='Jugar jornada', exact=True).click()
    page.get_by_role('button', name='Ver partido', exact=True).wait_for()
    expected = page.evaluate('''() => {
        const v = window.bm27State;
        const played=v.myTeam.squad.find(row=>row.stats && row.stats.games>0).player;
        return {own: v.myTeam.name, ownPlayer: `${played.firstName} ${played.lastName}`, rival: v.teamNames[v.competitions[0].teamIds.find(id => id !== v.userTeamId)]};
    }''')
    page.get_by_role('navigation', name='Secciones de la partida').get_by_role('button', name='Mundo', exact=True).click()
    world = page.get_by_test_id('world-browser')
    def ready():
        expect(world.get_by_role('button', name='Buscar', exact=True)).to_be_enabled(timeout=20000)
    def search(entity, name=''):
        world.get_by_role('combobox', name='Buscar en', exact=True).select_option(entity)
        world.get_by_label('Nombre', exact=True).fill(name)
        world.get_by_role('button', name='Buscar', exact=True).click()
        ready()
    def open_club(name):
        search('clubs', name)
        world.get_by_role('button', name=name, exact=True).click()
        ready()
        page.get_by_test_id('club-profile').wait_for()
        expect(page.get_by_test_id('club-profile')).to_be_focused()
    def audit(label):
        page.wait_for_timeout(200)
        page.add_script_tag(path=os.environ.get('BM27_AXE_PATH', '/tmp/bm27-axe/package/axe.min.js'))
        violations = page.evaluate("""async () => (await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v => ({id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target)}))""")
        report = {'screen': label, 'violations': violations, 'overflow': page.evaluate('document.documentElement.scrollWidth > innerWidth')}
        reports.append(report)
        print(json.dumps(report, ensure_ascii=False), flush=True)
    for width, label in [(1280, 'desktop'), (1920, 'wide')]:
        page.set_viewport_size({'width': width, 'height': 800 if width == 1280 else 1080})
        for theme in ['dark', 'light']:
            if page.evaluate('document.documentElement.dataset.theme') != theme:
                page.get_by_text('Apariencia', exact=True).click()
                page.get_by_role('button', name='☀ Modo claro' if theme == 'light' else '☾ Modo oscuro', exact=True).click()
                page.get_by_text('Apariencia', exact=True).click()
            search('players')
            first = page.evaluate('window.bm27World')
            assert len(first['rows']) == 40
            world.get_by_role('button', name='Página siguiente', exact=True).click()
            ready()
            second = page.evaluate('window.bm27World')
            assert not {r['id'] for r in first['rows']} & {r['id'] for r in second['rows']}
            audit(label+'-'+theme+'-search')
            open_club(expected['rival'])
            rival = page.evaluate('window.bm27World')
            assert len(rival['players']) >= 8
            audit(label+'-'+theme+'-club')
            if width == 1920 and theme == 'light':
                page.evaluate('window.scrollTo(0, 0)')
                page.screenshot(path=str(output/'world-club-wide-light.png'), full_page=True)
            name = rival['players'][0]['name']
            page.get_by_test_id('club-profile').get_by_role('button', name=name, exact=True).click()
            ready()
            page.get_by_test_id('player-profile').wait_for()
            expect(page.get_by_test_id('player-profile')).to_be_focused()
            expect(page.get_by_test_id('player-profile').get_by_text('No revelado', exact=True)).to_be_visible()
            assert page.evaluate('window.bm27World.potential') is None
            assert page.get_by_test_id('player-profile').locator('meter').count() == 20
            audit(label+'-'+theme+'-rival-player')
            if width == 1280 and theme == 'dark':
                page.evaluate('window.scrollTo(0, 0)')
                page.screenshot(path=str(output/'world-player-desktop-dark.png'), full_page=True)
            world.get_by_role('button', name='← Volver a la consulta anterior', exact=True).click()
            page.get_by_test_id('club-profile').wait_for()
            open_club(expected['own'])
            own = page.evaluate('window.bm27World')
            page.get_by_test_id('club-profile').get_by_role('button', name=expected['ownPlayer'], exact=True).click()
            ready()
            own_player = page.evaluate('window.bm27World')
            assert own_player['potential'] is not None
            expect(page.get_by_test_id('player-profile').get_by_text('No revelado', exact=True)).to_have_count(0)
            assert len(own_player['seasons']) > 0
            audit(label+'-'+theme+'-own-player')
    search('players', 'zzzz-player-not-existing')
    expect(world.get_by_text('No hay resultados con esos filtros.', exact=True)).to_be_visible()
    assert page.evaluate('window.bm27World.total') == 0
    assert not errors, errors
    assert not any(r['violations'] or r['overflow'] for r in reports), reports
    browser.close()
Path('/tmp/bm27-world-browser-results.json').write_text(json.dumps({'reports': reports, 'errors': errors}, indent=2))
print('PASS: 16 PC screens, real queries, pagination, profiles, hidden rival potential, back navigation and zero results.')
