import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

reports=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('BM27_CHROMIUM','/usr/bin/chromium'),headless=True,
        args=['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage','--disable-gpu'],
        env={**os.environ,'XDG_CACHE_HOME':'/tmp/bm27-browser-cache'},timeout=20000)
    page=browser.new_page(viewport={'width':1280,'height':800},accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.add_init_script('''
        const RealWorker=window.Worker;
        window.Worker=class extends RealWorker {
            constructor(...args) {
                super(...args);
                this.addEventListener('message',event=>{
                    if(event.data.type==='state')window.bm27State=event.data.view;
                    if(event.data.type==='matchDetail')window.bm27Detail=event.data.detail;
                });
            }
        };
    ''')
    page.goto(os.environ.get('BM27_WEB_URL','http://127.0.0.1:5173'),wait_until='domcontentloaded')
    page.get_by_role('button',name='Nueva partida',exact=True).click()
    page.get_by_test_id('summary').wait_for()
    page.get_by_role('button',name='Dirigir este equipo',exact=True).click()
    page.get_by_role('button',name='Jugar jornada',exact=True).click()
    page.get_by_role('button',name='Ver partido',exact=True).click()
    viewer=page.get_by_test_id('replay-viewer')
    viewer.wait_for()
    expect(viewer).to_be_focused()
    detail=page.evaluate('window.bm27Detail')
    slider=viewer.get_by_role('slider',name='Secuencia de juego',exact=True)
    def cursor():return int(slider.input_value())
    def scores():return [int(viewer.get_by_test_id('replay-home-score').inner_text()),int(viewer.get_by_test_id('replay-away-score').inner_text())]
    owners={r['playerId']:side for side in ['home','away'] for r in detail['boxScore'][side]['players']}
    def expected_scores(at):
        score={'home':0,'away':0}
        for event in detail['events'][:at]:
            if event['type'] in ['shot','free_throw'] and event['made']:
                score[owners[event['playerId']]]+=event['points'] if event['type']=='shot' else 1
        return [score['home'],score['away']]
    def export_file():
        details=page.locator('details.game-tools')
        if not details.evaluate('(e)=>e.open'):details.locator('summary').click()
        with page.expect_download() as info:page.get_by_role('button',name='Guardar partida',exact=True).click()
        return Path(info.value.path()).read_text()
    def audit(name):
        page.add_script_tag(path=os.environ.get('BM27_AXE_PATH','/tmp/bm27-axe/package/axe.min.js'))
        violations=page.evaluate("""async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}))""")
        row={'screen':name,'violations':violations,'overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth')}
        reports.append(row);print(json.dumps(row),flush=True)
    original=export_file()
    assert cursor()==0 and scores()==[0,0]
    viewer.get_by_role('button',name='Siguiente periodo',exact=True).click()
    assert scores()==expected_scores(cursor())
    assert detail['events'][cursor()-1]['type']=='period_start' and detail['events'][cursor()-1]['period']==2
    viewer.get_by_role('button',name='Jugada siguiente',exact=True).click()
    assert scores()==expected_scores(cursor())
    for width,label in [(1280,'desktop'),(1920,'wide')]:
        page.set_viewport_size({'width':width,'height':800 if width==1280 else 1080})
        for theme in ['dark','light']:
            if page.evaluate('document.documentElement.dataset.theme')!=theme:
                page.get_by_text('Apariencia',exact=True).click()
                page.get_by_role('button',name='☀ Modo claro' if theme=='light' else '☾ Modo oscuro',exact=True).click()
                page.get_by_text('Apariencia',exact=True).click()
            viewer.get_by_role('button',name='Inicio',exact=True).click()
            assert cursor()==0 and scores()==[0,0]
            viewer.get_by_role('combobox',name='Velocidad',exact=True).select_option('10')
            viewer.get_by_role('button',name='Reproducir',exact=True).click()
            page.wait_for_function("Number(document.querySelector('[aria-label=\"Repetición del registro\"] input[type=range]').value)>=3")
            viewer.get_by_role('button',name='Pausar',exact=True).click()
            paused=cursor();page.wait_for_timeout(350)
            assert cursor()==paused and scores()==expected_scores(paused)
            audit(label+'-'+theme+'-playback-paused')
            viewer.get_by_role('button',name='Saltar al final',exact=True).click()
            assert scores()==[detail['boxScore']['home']['points'],detail['boxScore']['away']['points']]
            expected=[(i+1,e) for i,e in enumerate(detail['events']) if e['type']=='shot']
            markers=viewer.locator('.replay-shot')
            assert markers.count()==len(expected)
            for marker,(at,event) in zip(markers.all(),expected):
                assert int(marker.get_attribute('data-event-index'))==at
                assert float(marker.get_attribute('data-x'))==event['x'] and float(marker.get_attribute('data-y'))==event['y']
            audit(label+'-'+theme+'-complete-shot-map')
            if width==1280 and theme=='dark':
                page.evaluate('window.scrollTo(0,0)')
                page.screenshot(path='docs/screenshots/replay-desktop-dark.png',full_page=True,clip=viewer.bounding_box())
            if width==1920 and theme=='light':
                page.evaluate('window.scrollTo(0,0)')
                page.screenshot(path='docs/screenshots/replay-wide-light.png',full_page=True,clip=viewer.bounding_box())
    viewer.get_by_role('combobox',name='Equipo del mapa',exact=True).select_option(detail['boxScore']['home']['teamId'])
    viewer.get_by_role('combobox',name='Resultado del tiro',exact=True).select_option('missed')
    expected=[(i+1,e) for i,e in enumerate(detail['events']) if e['type']=='shot' and not e['made'] and owners[e['playerId']]=='home']
    markers=viewer.locator('.replay-shot')
    assert markers.count()==len(expected)>0
    markers.first.focus();page.keyboard.press('Enter')
    assert cursor()==expected[0][0] and scores()==expected_scores(cursor())
    slider.focus();slider.press('Home');assert cursor()==0
    slider.press('ArrowRight');assert cursor()==1
    slider.press('End');assert cursor()==len(detail['events'])
    audit('filters-marker-and-timeline-keyboard')
    assert export_file()==original,'Playback modified the saved universe'
    # Leaving the screen stops its timer; returning creates a paused replay.
    viewer.get_by_role('button',name='Reproducir',exact=True).click()
    page.get_by_role('navigation',name='Secciones de la partida').get_by_role('button',name='Portal',exact=True).click()
    page.get_by_role('navigation',name='Secciones de la partida').get_by_role('button',name='Partido',exact=True).click()
    expect(page.get_by_role('button',name='Reproducir',exact=True)).to_be_visible()
    assert cursor()==0 and scores()==[0,0]
    audit('return-to-paused-replay')
    browser.close()
Path('/tmp/bm27-replay-browser-results.json').write_text(json.dumps({'results':reports,'errors':errors},ensure_ascii=False,indent=2))
assert not errors,errors
assert not any(r['violations'] or r['overflow'] for r in reports),'See report'
print('PASS: 10 PC checks; pause/rate/period/keyboard controls, exact event scores and shot coordinates, map filters, unchanged save and unmount cleanup.')
