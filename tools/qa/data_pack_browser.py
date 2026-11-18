import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

sample_path = Path('data/packs/example-eight-clubs.json').resolve()
sample = json.loads(sample_path.read_text())
reports = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('BM27_CHROMIUM','/usr/bin/chromium'),headless=True,
        args=['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage','--disable-gpu'],
        env={**os.environ,'XDG_CACHE_HOME':'/tmp/bm27-browser-cache'},timeout=20000)
    page=browser.new_page(viewport={'width':1280,'height':800},accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.add_init_script("""
        const RealWorker=window.Worker;
        window.Worker=class extends RealWorker {
            constructor(...args) {
                super(...args);
                this.addEventListener('message',event=>{
                    if(event.data.type==='state')window.bm27State=event.data.view;
                    if(event.data.type==='dataPack')window.bm27Pack=event.data.summary;
                    if(event.data.type==='matchDetail')window.bm27Detail=event.data.detail;
                });
            }
        };
    """)
    page.goto(os.environ.get('BM27_WEB_URL','http://127.0.0.1:5173'),wait_until='domcontentloaded')
    def tools_open():
        details=page.locator('details.game-tools')
        if not details.evaluate('(element)=>element.open'):
            details.locator('summary').click()
    def state_count(count):
        page.wait_for_function('(count)=>window.bm27State?.teamCount===count',arg=count)
    def export_file():
        tools_open()
        with page.expect_download() as info:
            page.get_by_role('button',name='Guardar partida',exact=True).click()
        return Path(info.value.path()).read_text()
    def audit(name):
        page.wait_for_timeout(200)
        page.add_script_tag(path=os.environ.get('BM27_AXE_PATH','/tmp/bm27-axe/package/axe.min.js'))
        violations=page.evaluate("""async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}))""")
        result={'screen':name,'violations':violations,'overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth')}
        reports.append(result);print(json.dumps(result),flush=True)
    page.get_by_role('button',name='Nueva partida',exact=True).click()
    state_count(202)
    original=export_file()
    page.get_by_test_id('data-pack-file').set_input_files(str(sample_path))
    page.wait_for_function('window.bm27Pack?.id==="example-eight-clubs"')
    assert page.evaluate('window.bm27State.teamCount')==202
    audit('validated-pack-preview')
    broken=json.loads(sample_path.read_text());broken['rulesets'][0]['periodMinutes']=-1
    page.get_by_test_id('data-pack-file').set_input_files({'name':'broken.json','mimeType':'application/json','buffer':json.dumps(broken).encode()})
    expect(page.get_by_role('alert').filter(has_text='periodMinutes')).to_be_visible()
    assert export_file()==original
    assert page.evaluate('window.bm27Pack.id')==sample['id']
    audit('invalid-pack-keeps-world-and-selection')
    page.once('dialog',lambda dialog:dialog.accept())
    page.get_by_role('button',name='Nueva partida',exact=True).click()
    state_count(8)
    page.get_by_role('button',name='Dirigir este equipo',exact=True).click()
    page.get_by_role('button',name='Jugar jornada',exact=True).click()
    page.get_by_role('button',name='Ver partido',exact=True).click()
    page.wait_for_function('Boolean(window.bm27Detail)')
    starts=page.evaluate('window.bm27Detail.events.filter(e=>e.type==="period_start").slice(0,2).map(e=>e.periodSeconds)')
    assert starts==[900,900],starts
    for width,label in [(1280,'desktop'),(1920,'wide')]:
        page.set_viewport_size({'width':width,'height':800 if width==1280 else 1080})
        for theme in ['dark','light']:
            if page.evaluate('document.documentElement.dataset.theme')!=theme:
                page.get_by_text('Apariencia',exact=True).click()
                page.get_by_role('button',name='☀ Modo claro' if theme=='light' else '☾ Modo oscuro',exact=True).click()
                page.get_by_text('Apariencia',exact=True).click()
            for tab in ['Portal','Partido']:
                page.get_by_role('navigation',name='Secciones de la partida').get_by_role('button',name=tab,exact=True).click()
                audit(label+'-'+theme+'-'+tab)
                if width==1280 and theme=='dark' and tab=='Portal':
                    page.evaluate('window.scrollTo(0,0)')
                    page.screenshot(path='docs/screenshots/data-pack-example-desktop-dark.png',full_page=True)
    saved=export_file();payload=json.loads(saved)['payload']
    assert payload['dataPackId']==sample['id'] and payload['namePool']==sample['names']
    page.reload(wait_until='domcontentloaded')
    page.get_by_test_id('load-file').set_input_files({'name':'custom-save.json','mimeType':'application/json','buffer':saved.encode()})
    state_count(8)
    assert json.loads(export_file())['payload']['namePool']==sample['names']
    page.get_by_test_id('data-pack-file').set_input_files(str(sample_path))
    page.wait_for_function('window.bm27Pack?.id==="example-eight-clubs"')
    page.get_by_role('button',name='Usar datos predeterminados',exact=True).click()
    page.wait_for_function('window.bm27Pack===null')
    assert page.evaluate('window.bm27State.teamCount')==8
    page.once('dialog',lambda dialog:dialog.dismiss())
    page.get_by_role('button',name='Nueva partida',exact=True).click()
    assert page.evaluate('window.bm27State.teamCount')==8
    page.once('dialog',lambda dialog:dialog.accept())
    page.get_by_role('button',name='Nueva partida',exact=True).click()
    state_count(202)
    tools_open()
    page.get_by_test_id('data-pack-file').set_input_files({'name':'large.json','mimeType':'application/json','buffer':b' '*(2*1024*1024+1)})
    expect(page.get_by_role('alert').filter(has_text='2 MiB')).to_be_visible()
    assert page.evaluate('window.bm27State.teamCount')==202
    assert not errors,errors
    assert not any(r['violations'] or r['overflow'] for r in reports),reports
    browser.close()
Path('/tmp/bm27-pack-browser-results.json').write_text(json.dumps({'reports':reports,'errors':errors},indent=2))
print('PASS: 10 PC checks, real pack selection, errors preserving world, 8-team custom rules, save/download/reload, cancellation and default reset.')
