import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

sample_path=Path('data/packs/example-eight-defined-clubs.json').resolve()
sample=json.loads(sample_path.read_text())
club=sample['clubs'][0]
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
                    if(event.data.type==='dataPack')window.bm27Pack=event.data.summary;
                    if(event.data.type==='world')window.bm27World=event.data.result;
                });
            }
        };
    ''')
    page.goto(os.environ.get('BM27_WEB_URL','http://127.0.0.1:5173'),wait_until='domcontentloaded')
    def tools_open():
        details=page.locator('details.game-tools')
        if not details.evaluate('(e)=>e.open'):details.locator('summary').click()
    def export_file():
        tools_open()
        with page.expect_download() as info:page.get_by_role('button',name='Guardar partida',exact=True).click()
        return Path(info.value.path()).read_text()
    def generate(count,origin):
        tools_open();page.once('dialog',lambda dialog:dialog.accept())
        page.get_by_role('button',name='Generar universo',exact=True).click()
        page.wait_for_function('([count,origin])=>window.bm27State?.teamCount===count && window.bm27State?.clubData===origin',arg=[count,origin])
    def nav(name):page.get_by_role('navigation',name='Secciones de la partida').get_by_role('button',name=name,exact=True).click()
    def profile(name):
        nav('Mundo');world=page.get_by_test_id('world-browser')
        world.get_by_role('combobox',name='Buscar en',exact=True).select_option('clubs')
        world.get_by_label('Nombre',exact=True).fill(name)
        world.get_by_role('button',name='Buscar',exact=True).click()
        world.get_by_role('button',name=name,exact=True).click()
        page.get_by_test_id('club-profile').wait_for()
        expect(page.get_by_test_id('club-profile')).to_be_focused()
        return page.get_by_role('region',name='Identidad y procedencia del club',exact=True)
    def audit(name):
        page.add_script_tag(path=os.environ.get('BM27_AXE_PATH','/tmp/bm27-axe/package/axe.min.js'))
        violations=page.evaluate("""async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}))""")
        row={'screen':name,'violations':violations,'overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth')}
        reports.append(row);print(json.dumps(row),flush=True)
    page.get_by_role('button',name='Generar universo',exact=True).click()
    page.wait_for_function('window.bm27State?.teamCount===202')
    original=export_file()
    page.get_by_test_id('data-pack-file').set_input_files(str(sample_path))
    page.wait_for_function('window.bm27Pack?.definedClubs===8')
    expect(page.get_by_text('8 clubes definidos individualmente. Jugadores generados.',exact=True)).to_be_visible()
    assert page.evaluate('window.bm27State.clubData')=='generated'
    audit('defined-pack-preview-keeps-current-world')
    broken=json.loads(sample_path.read_text());broken['clubs'][1]['id']=broken['clubs'][0]['id']
    page.get_by_test_id('data-pack-file').set_input_files({'name':'duplicate-club.json','mimeType':'application/json','buffer':json.dumps(broken).encode()})
    expect(page.get_by_role('alert')).to_contain_text('clubs[1]')
    assert export_file()==original
    assert page.evaluate('window.bm27Pack.definedClubs')==8
    audit('invalid-identities-preserve-selection-and-world')
    generate(8,'defined')
    assert page.evaluate('(id)=>window.bm27State.teamNames[id]',club['id'])==club['name']
    expect(page.locator('.data-note')).to_contain_text('Clubes definidos por un paquete y jugadores generados')
    page.get_by_role('combobox',name='Equipo',exact=True).select_option(club['id'])
    page.get_by_role('button',name='Dirigir este equipo',exact=True).click()
    page.get_by_role('button',name='Jugar jornada',exact=True).click()
    page.get_by_role('button',name='Ver partido',exact=True).click()
    page.get_by_test_id('replay-viewer').wait_for()
    for width,label in [(1280,'desktop'),(1920,'wide')]:
        page.set_viewport_size({'width':width,'height':800 if width==1280 else 1080})
        for theme in ['dark','light']:
            if page.evaluate('document.documentElement.dataset.theme')!=theme:
                page.get_by_text('Apariencia',exact=True).click()
                page.get_by_role('button',name='☀ Modo claro' if theme=='light' else '☾ Modo oscuro',exact=True).click()
                page.get_by_text('Apariencia',exact=True).click()
            source=profile(club['name'])
            expect(source).to_contain_text(club['identity']['referenceName'])
            expect(source).to_contain_text('Referencia sin contrastar')
            expect(source.get_by_role('link',name='Consultar fuente declarada',exact=True)).to_have_attribute('href',club['identity']['source']['url'])
            assert page.evaluate('window.bm27World.identity.source.verification')=='unverified'
            audit(label+'-'+theme+'-source-claim')
            if width==1280 and theme=='dark':
                page.evaluate('window.scrollTo(0,0)')
                component=page.get_by_test_id('club-profile')
                page.screenshot(path='docs/screenshots/club-identity-desktop-dark.png',full_page=True,clip=component.bounding_box())
            nav('Portal');audit(label+'-'+theme+'-defined-portal')
            nav('Partido');page.get_by_test_id('replay-viewer').wait_for();audit(label+'-'+theme+'-defined-match')
    saved=export_file();saved_data=json.loads(saved)['payload']
    assert saved_data['teams'][0]['identity']==club['identity'] and saved_data['schemaVersion']==8
    page.reload(wait_until='domcontentloaded')
    page.get_by_test_id('load-file').set_input_files({'name':'defined-save.json','mimeType':'application/json','buffer':saved.encode()})
    page.wait_for_function('window.bm27State?.clubData==="defined"')
    reexport=export_file()
    Path('/tmp/bm27-clubs-browser-save-before.json').write_text(saved)
    Path('/tmp/bm27-clubs-browser-save-after.json').write_text(reexport)
    assert json.loads(reexport)['payload']==saved_data, 'Save round-trip changed the game data'
    source=profile(club['name']);expect(source).to_contain_text(club['identity']['referenceName'])
    # Recreate with a different alias but exactly the same external club ID and reference.
    changed=json.loads(sample_path.read_text());changed['clubs'][0]['name']='Valle Norte Patrocinador'
    tools_open();page.get_by_test_id('data-pack-file').set_input_files({'name':'new-alias.json','mimeType':'application/json','buffer':json.dumps(changed).encode()})
    page.wait_for_function('window.bm27Pack?.definedClubs===8')
    generate(8,'defined')
    page.wait_for_function('([id,name])=>window.bm27State.teamNames[id]===name',arg=[club['id'],changed['clubs'][0]['name']])
    source=profile(changed['clubs'][0]['name']);expect(source).to_contain_text(club['identity']['referenceName'])
    audit('save-reload-and-stable-alias')
    old=json.loads(Path('data/packs/example-eight-clubs.json').read_text());old['schemaVersion']=7
    tools_open();page.get_by_test_id('data-pack-file').set_input_files({'name':'old-contract-7.json','mimeType':'application/json','buffer':json.dumps(old).encode()})
    page.wait_for_function('window.bm27Pack?.definedClubs===0')
    generate(8,'generated')
    expect(page.locator('.data-note')).to_contain_text('clubes y jugadores generados')
    assert 'Clubes definidos por un paquete' not in page.locator('.data-note').inner_text()
    audit('legacy-pack-keeps-generated-data-label')
    browser.close()
Path('/tmp/bm27-clubs-browser-results.json').write_text(json.dumps({'results':reports,'errors':errors},ensure_ascii=False,indent=2))
assert not errors,errors
assert not any(r['violations'] or r['overflow'] for r in reports),'See report'
print('PASS: 16 PC checks; stable clubs/source claims, invalid-input isolation, real match, save/reload, alias update and contract-7 pack compatibility.')
