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
    page.add_init_script("""
        const RealWorker = window.Worker;
        window.Worker = class extends RealWorker {
            constructor(...args) {
                super(...args);
                this.addEventListener('message', (event) => {
                    if (event.data.type === 'state') window.bm27ObservedState = event.data.view;
                });
            }
        };
    """)
    page.goto(os.environ.get('BM27_WEB_URL','http://127.0.0.1:5173'),wait_until='domcontentloaded',timeout=20000)
    def audit(name):
        visible = page.locator("body").inner_text()
        for stale in ("EN DESARROLLO", "BM27 · Demo", "docs/tacticas.md", "Coordenadas del motor"):
            assert stale not in visible, (name, stale)
        page.wait_for_timeout(200)
        page.add_script_tag(path=axe_path)
        report=page.evaluate('''async () => { const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}); return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})); }''')
        overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth')
        results.append({'screen':name,'overflow':overflow,'violations':report})
        print(json.dumps(results[-1],ensure_ascii=False),flush=True)
    for width,label in [(1280,'desktop'),(1920,'wide')]:
        page.set_viewport_size({'width':width,'height':800 if width==1280 else 1080})
        for theme in ['dark','light']:

            if page.evaluate('document.documentElement.dataset.theme') != theme:
                page.get_by_text('Apariencia',exact=True).click()
                page.get_by_role('button',name='☀ Modo claro' if theme == 'light' else '☾ Modo oscuro',exact=True).click()
                page.get_by_text('Apariencia',exact=True).click()
            audit('welcome-'+label+'-'+theme)
            page.screenshot(path=f'{output_dir}/welcome-{label}-{theme}.png',full_page=True)
    page.set_viewport_size({'width':1280,'height':900})
    page.get_by_role('button',name='Mis partidas',exact=True).click()
    page.get_by_role('heading',name='Partidas de este dispositivo').wait_for()
    page.get_by_role('button',name='Menú principal',exact=False).click()
    page.get_by_role('heading',name='Basketball Manager 2027').wait_for()
    page.get_by_role('button',name='Nueva partida',exact=True).click()
    page.get_by_test_id('summary').wait_for(timeout=60000)
    def preseason_audits(stage):
        for width,label in [(1280,'desktop'),(1920,'wide')]:
            page.set_viewport_size({'width':width,'height':800 if width==1280 else 1080})
            for theme in ['dark','light']:
                if page.evaluate('document.documentElement.dataset.theme') != theme:
                    page.get_by_text('Apariencia',exact=True).click()
                    page.get_by_role('button',name='☀ Modo claro' if theme=='light' else '☾ Modo oscuro',exact=True).click()
                    page.get_by_text('Apariencia',exact=True).click()
                audit(stage+'-'+label+'-'+theme)
        page.set_viewport_size({'width':1280,'height':900})
    preseason_audits('portal-without-team')
    page.get_by_role('button',name='Dirigir este equipo',exact=True).click()
    page.get_by_role('navigation',name='Secciones de la partida').get_by_role('button',name='Mi equipo',exact=True).wait_for()
    preseason_audits('portal-before-first-round')
    page.get_by_role('button',name='Jugar jornada',exact=True).click()
    page.get_by_role('button',name='Ver partido',exact=True).wait_for()
    expected=page.evaluate("""() => {
        const v=window.bm27ObservedState;
        const table=v.tables.find(t=>t.competitionId===v.myTeam.competitionId);
        const row=table.groups.flatMap(g=>g.standings).find(r=>r.teamId===v.userTeamId);
        const eur=n=>`${Math.round(n).toLocaleString('es-ES')} €`;
        return {balance:eur(v.finance.balance),limit:eur(v.market.salaryLimit),payroll:eur(v.market.payroll),position:row.position,played:row.played,wins:row.wins,losses:row.losses,team:v.myTeam.name};
    }""")
    portal=page.get_by_test_id('manager-portal')
    rival_expected=page.evaluate("""() => {
        const view=window.bm27ObservedState;
        const id=view.myTeam.nextMatch.opponentId;
        const matches=view.tables.find(t=>t.competitionId===view.myTeam.competitionId && t.seasonNumber===view.seasonNumber)
            .matches.filter(m=>m.homeTeamId===id||m.awayTeamId===id);
        const scores=matches.map(m=>m.homeTeamId===id ? [m.homeScore,m.awayScore] : [m.awayScore,m.homeScore]);
        const wins=scores.filter(([a,b])=>a>b).length;
        const mean=i=>(scores.reduce((n,s)=>n+s[i],0)/scores.length).toLocaleString('es',{minimumFractionDigits:1,maximumFractionDigits:1});
        return {
            names: [view.teamNames[id]],
            stats: [`${wins} V · ${scores.length-wins} D`,mean(0),mean(1)],
            form: scores.slice(-5).map(([a,b])=>a>b?'V':'D')
        };
    }""")
    rival=page.get_by_role('group',name='Rendimiento del próximo rival')
    assert page.locator('button.opponent-name').all_text_contents()==rival_expected['names']
    assert rival.locator('dd').all_text_contents()==rival_expected['stats']
    assert rival.get_by_role('listitem').all_text_contents()==rival_expected['form']
    competition=page.get_by_role('combobox',name='Competición del portal')
    competition.select_option(index=1)
    assert rival.locator('dd').all_text_contents()==rival_expected['stats']
    competition.select_option(index=0)
    for amount in ['balance','limit','payroll']:
        assert portal.get_by_text(expected[amount],exact=True).count()>0,expected
    actual=portal.get_by_role('region',name='Clasificación del portal',exact=True).locator('tr.mine td').all_text_contents()
    assert actual==[str(expected['position']),expected['team'],str(expected['played']),str(expected['wins']),str(expected['losses'])],(actual,expected)
    portal.get_by_role('group',name='Filtrar actividad').get_by_role('button',name='Mercado',exact=True).click()
    assert portal.locator('.activity-category.sport').count()==0
    portal.get_by_role('group',name='Filtrar actividad').get_by_role('button',name='Todo',exact=True).click()
    portal.get_by_role('button',name='Plan de partido',exact=False).click()
    page.get_by_role('heading',name='Tácticas de '+expected['team'],exact=True).wait_for()
    page.get_by_role('navigation',name='Secciones de la partida').get_by_role('button',name='Portal',exact=True).click()
    page.get_by_role('button',name='Ver partido',exact=True).click()
    for width,label in [(1280,'desktop'),(1920,'wide')]:
        page.set_viewport_size({'width':width,'height':800 if width==1280 else 1080})
        for theme in ['dark','light']:

            if page.evaluate('document.documentElement.dataset.theme') != theme:
                page.get_by_text('Apariencia',exact=True).click()
                page.get_by_role('button',name='☀ Modo claro' if theme == 'light' else '☾ Modo oscuro',exact=True).click()
                page.get_by_text('Apariencia',exact=True).click()
            for tab in ['Portal','Mi equipo','Tácticas','Quinteto','Mercado','Finanzas','Mundo','Competición','Partido','Partidas']:
                page.get_by_role('navigation',name='Secciones de la partida').get_by_role('button',name=tab,exact=True).click()
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
                if tab in ['Mi equipo','Portal']: page.screenshot(path=f'{output_dir}/{"portal" if tab == "Portal" else "team"}-{label}-{theme}.png',full_page=True)
    # Verify the final selected light theme survives a page reload.
    page.reload(wait_until='domcontentloaded')
    assert page.evaluate('document.documentElement.dataset.theme')=='light'
    page.get_by_text('Apariencia',exact=True).click()
    page.get_by_role('button',name='☾ Modo oscuro',exact=True).click()
    page.reload(wait_until='domcontentloaded')
    page.get_by_text('Apariencia',exact=True).click()
    page.get_by_role('button',name='☀ Modo claro',exact=True).wait_for()
    page.get_by_label('Tablas compactas',exact=True).check()
    page.reload(wait_until='domcontentloaded')
    assert page.evaluate('document.documentElement.dataset.density')=='compact'
    assert page.evaluate('document.documentElement.dataset.theme')=='dark'
    # Keyboard focus must remain visible.
    page.keyboard.press('Tab')
    focus=page.evaluate('getComputedStyle(document.activeElement).outlineStyle')
    assert focus!='none',focus
    browser.close()
Path(os.environ.get('BM27_REPORT_PATH','/tmp/bm27-visual-browser-results.json')).write_text(json.dumps({'results':results,'errors':errors},ensure_ascii=False,indent=2))
assert not errors,errors
assert not any(r['violations'] or r['overflow'] for r in results),'See results'
print('PASS: 52 screens, WCAG A/AA axe, no page overflow, theme persistence, keyboard focus, no browser errors.')
