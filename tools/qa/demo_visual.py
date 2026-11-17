import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
results=[]
output_dir=Path(os.environ.get('BM27_SCREENSHOT_DIR','docs/screenshots'))
output_dir.mkdir(parents=True,exist_ok=True)
axe_path=os.environ.get('BM27_AXE_PATH','/tmp/bm27-axe/package/axe.min.js')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('BM27_CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage','--disable-gpu'],env={**os.environ,'XDG_CACHE_HOME':'/tmp/bm27-browser-cache'},timeout=20000)
    page=browser.new_page(viewport={'width':1280,'height':900})
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.goto(os.environ.get('BM27_WEB_URL','http://127.0.0.1:5173'),wait_until='domcontentloaded',timeout=20000)
    def audit(name):
        page.wait_for_timeout(200)
        page.add_script_tag(path=axe_path)
        report=page.evaluate('''async () => { const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}); return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})); }''')
        overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth')
        results.append({'screen':name,'overflow':overflow,'violations':report})
        print(json.dumps(results[-1],ensure_ascii=False),flush=True)
    for width,label in [(1280,'desktop'),(390,'mobile')]:
        page.set_viewport_size({'width':width,'height':900 if width==1280 else 844})
        for theme in ['dark','light']:

            if page.evaluate('document.documentElement.dataset.theme') != theme:
                page.get_by_role('button',name='☀ Modo claro' if theme == 'light' else '☾ Modo oscuro',exact=True).click()
            audit('welcome-'+label+'-'+theme)
            page.screenshot(path=f'{output_dir}/welcome-{label}-{theme}.png',full_page=True)
    page.set_viewport_size({'width':1280,'height':900})
    page.get_by_role('button',name='Generar universo',exact=True).click()
    page.get_by_test_id('summary').wait_for(timeout=60000)
    page.get_by_role('button',name='Dirigir este equipo',exact=True).click()
    page.get_by_role('navigation').get_by_role('button',name='Mi equipo',exact=True).wait_for()
    page.get_by_role('button',name='Jugar jornada',exact=True).click()
    page.get_by_role('button',name='Ver partido',exact=True).click()
    for width,label in [(1280,'desktop'),(390,'mobile')]:
        page.set_viewport_size({'width':width,'height':900 if width==1280 else 844})
        for theme in ['dark','light']:

            if page.evaluate('document.documentElement.dataset.theme') != theme:
                page.get_by_role('button',name='☀ Modo claro' if theme == 'light' else '☾ Modo oscuro',exact=True).click()
            for tab in ['Mi equipo','Tácticas','Quinteto','Mercado','Finanzas','Competición','Partido','Partidas']:
                page.get_by_role('navigation').get_by_role('button',name=tab,exact=True).click()
                page.wait_for_timeout(100)
                audit(label+'-'+theme+'-'+tab)
                if tab=='Mi equipo' and width==1280:
                    region=page.get_by_role('region',name='Plantilla y estadísticas',exact=True)
                    region.focus()
                    if region.evaluate('(e)=>e.scrollWidth>e.clientWidth'):
                        page.keyboard.press('ArrowRight')
                        page.wait_for_timeout(200)
                        assert region.evaluate('(e)=>e.scrollLeft')>0
                        region.evaluate('(e)=>{e.scrollLeft=0}')
                if tab=='Mi equipo': page.screenshot(path=f'{output_dir}/team-{label}-{theme}.png',full_page=True)
    # Verify the final selected light theme survives a page reload.
    page.reload(wait_until='domcontentloaded')
    assert page.evaluate('document.documentElement.dataset.theme')=='light'
    page.get_by_role('button',name='☾ Modo oscuro',exact=True).click()
    page.reload(wait_until='domcontentloaded')
    page.get_by_role('button',name='☀ Modo claro',exact=True).wait_for()
    assert page.evaluate('document.documentElement.dataset.theme')=='dark'
    # Keyboard focus must remain visible.
    page.keyboard.press('Tab')
    focus=page.evaluate('getComputedStyle(document.activeElement).outlineStyle')
    assert focus!='none',focus
    browser.close()
Path(os.environ.get('BM27_REPORT_PATH','/tmp/bm27-visual-browser-results.json')).write_text(json.dumps({'results':results,'errors':errors},ensure_ascii=False,indent=2))
assert not errors,errors
assert not any(r['violations'] or r['overflow'] for r in results),'See results'
print('PASS: 36 screens, WCAG A/AA axe, no page overflow, theme persistence, keyboard focus, no browser errors.')
