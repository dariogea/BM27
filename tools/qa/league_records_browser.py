import csv
import io
import json
import math
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

save_path=Path(os.environ.get('BM27_LEAGUE_SAVE','/tmp/bm27-league-save.json'))
payload=json.loads(save_path.read_text())['payload']
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
                    if(event.data.type==='world' && event.data.result.kind==='records')window.bm27Records=event.data.result;
                });
            }
        };
    ''')
    page.goto(os.environ.get('BM27_WEB_URL','http://127.0.0.1:5173'),wait_until='domcontentloaded')
    page.get_by_test_id('load-file').set_input_files(str(save_path.resolve()))
    page.wait_for_function('window.bm27State?.seasonNumber===3')
    page.get_by_role('navigation',name='Secciones de la partida').get_by_role('button',name='Mundo',exact=True).click()
    records=page.get_by_role('region',name='Líderes y palmarés',exact=True)
    def consult():
        page.evaluate('window.bm27Records=null')
        records.get_by_role('button',name='Consultar líderes',exact=True).click()
        page.wait_for_function('window.bm27Records!==null')
        expect(records.get_by_role('button',name='Consultar líderes',exact=True)).to_be_enabled()
        return page.evaluate('window.bm27Records')
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
    for width,label in [(1280,'desktop'),(1920,'wide')]:
        page.set_viewport_size({'width':width,'height':800 if width==1280 else 1080})
        for theme in ['dark','light']:
            if page.evaluate('document.documentElement.dataset.theme')!=theme:
                page.get_by_text('Apariencia',exact=True).click()
                page.get_by_role('button',name='☀ Modo claro' if theme=='light' else '☾ Modo oscuro',exact=True).click()
                page.get_by_text('Apariencia',exact=True).click()
            records.get_by_role('combobox',name='Temporada de los líderes',exact=True).select_option('0')
            records.get_by_role('combobox',name='Estadística',exact=True).select_option('points')
            records.get_by_role('combobox',name='Cálculo',exact=True).select_option('average')
            records.get_by_role('spinbutton',name='Mínimo de partidos',exact=True).fill('1')
            data=consult()
            assert data['season']==2 and data['completed']
            for row in data['rows']:
                s=next(s for s in payload['history'][1]['competitions'][0]['playerStats'] if s['playerId']==row['playerId'] and s['teamId']==row['teamId'])
                assert math.isclose(row['value'],s['points']/s['games'])
            assert [h['season'] for h in data['honours']]==[2,1]
            for h,s in zip(data['honours'],reversed(payload['history'])):
                assert h['champion']['id']==s['competitions'][0]['championTeamId']
            audit(label+'-'+theme+'-leaders-honours')
            if width==1280 and theme=='dark':
                page.evaluate('window.scrollTo(0,0)')
                page.screenshot(path='docs/screenshots/league-leaders-desktop-dark.png',full_page=True)
            records.get_by_role('combobox',name='Cálculo',exact=True).select_option('per40')
            records.get_by_role('spinbutton',name='Mínimo de minutos',exact=True).fill('50')
            per40=consult()
            assert per40['rows']
            for row in per40['rows']:
                source=next(s for s in payload['history'][1]['competitions'][0]['playerStats']
                            if s['playerId']==row['playerId'] and s['teamId']==row['teamId'])
                assert source['seconds'] >= 3000
                assert math.isclose(row['value'],source['points'] * 2400 / source['seconds'])
            expect(records.get_by_role('columnheader',name='Por 40 min',exact=True)).to_be_visible()
            audit(label+'-'+theme+'-per40-minimum-time')
            with page.expect_download() as download:
                records.get_by_role('button',name='Exportar tabla CSV',exact=True).click()
            exported=list(csv.DictReader(io.StringIO(Path(download.value.path()).read_text(encoding='utf-8-sig')),delimiter=';'))
            assert len(exported)==len(per40['rows'])
            for exported_row,source in zip(exported,per40['rows']):
                assert exported_row['Jugador']==source['name']
                assert exported_row['Club']==source['teamName']
                assert exported_row['Unidad']=='por 40 min'
                assert exported_row['Unidad de la base']=='segundos'
                assert exported_row['Factor de escala']=='2400'
                assert math.isclose(float(exported_row['Valor'].replace(',','.')),source['value'])
                assert exported_row['Mínimo de minutos']=='50'
            expect(records.get_by_text('Tabla exportada',exact=False)).to_be_visible()

            records.get_by_role('spinbutton',name='Mínimo de minutos',exact=True).fill('0')
            records.get_by_role('combobox',name='Estadística',exact=True).select_option('threePointPercent')
            records.get_by_role('spinbutton',name='Mínimo de intentos',exact=True).fill('5')
            pct=consult()
            assert all(r['denominator']>=5 and math.isclose(r['value'],100*r['numerator']/r['denominator']) for r in pct['rows'])
            audit(label+'-'+theme+'-percentages')
    records.get_by_role('combobox',name='Estadística',exact=True).select_option('points')
    records.get_by_role('combobox',name='Cálculo',exact=True).select_option('total')
    records.get_by_role('combobox',name='Temporada de los líderes',exact=True).select_option('1')
    totals=consult()
    assert totals['season']==1 and all(r['value']==r['numerator'] for r in totals['rows'])
    histories = {}
    for season in payload['history']:
        for competition in season['competitions']:
            for stats in competition['playerStats']:
                if stats['games'] > 0:
                    histories.setdefault(stats['playerId'], []).append((season['seasonNumber'], stats))
    row_index, player_row = next((index, row) for index, row in enumerate(totals['rows'])
                                 if len(histories.get(row['playerId'], [])) >= 2)
    records.get_by_role('region',name='Tabla de líderes',exact=True).locator('tbody tr').nth(row_index).get_by_role('button').first.click()
    profile=page.get_by_test_id('player-profile')
    expect(profile).to_be_focused()
    trend=profile.get_by_role('figure',name='Evolución por temporada')
    recorded=sorted(histories[player_row['playerId']],key=lambda item:item[0])
    for metric in ['points','rebounds','assists','minutes']:
        trend.get_by_role('combobox',name='Estadística de evolución').select_option(metric)
        bars=trend.locator('li')
        expect(bars).to_have_count(len(recorded))
        for idx,(season,stats) in enumerate(recorded):
            value = {'points':stats['points'], 'rebounds':stats['offensiveRebounds']+stats['defensiveRebounds'],
                     'assists':stats['assists'], 'minutes':stats['seconds']/60}[metric] / stats['games']
            expect(bars.nth(idx)).to_contain_text(f'Temporada {season}')
            shown = float(bars.nth(idx).locator('strong').inner_text().replace(',','.'))
            assert math.isclose(shown,value,abs_tol=0.051)
    audit('actual-player-evolution')
    records.get_by_role('region',name='Palmarés de la competición',exact=True).get_by_role('button').first.click()
    page.get_by_test_id('club-profile').wait_for()
    expect(page.get_by_test_id('club-profile')).to_be_focused()
    records.get_by_role('spinbutton',name='Mínimo de partidos',exact=True).fill('999')
    empty=consult()
    assert empty['rows']==[]
    expect(records.get_by_text('No hay jugadores que cumplan estos filtros.',exact=True)).to_be_visible()
    audit('empty-filter-and-profile-links')
    assert export_file()==original,'Read-only queries changed the saved universe'
    # Start a genuine third season as an observer: no third champion may be fabricated.
    page.get_by_role('button',name='Jugar jornada',exact=True).click()
    page.wait_for_function('window.bm27State?.seasonInProgress && window.bm27State?.step===1')
    page.get_by_role('navigation',name='Secciones de la partida').get_by_role('button',name='Mundo',exact=True).click()
    records=page.get_by_role('region',name='Líderes y palmarés',exact=True)
    latest=consult()
    assert latest['season']==3 and not latest['completed'] and [h['season'] for h in latest['honours']]==[2,1]
    audit('current-season-without-fabricated-champion')
    browser.close()
Path('/tmp/bm27-league-browser-results.json').write_text(json.dumps({'results':reports,'errors':errors},ensure_ascii=False,indent=2))
assert not errors,errors
assert not any(r['violations'] or r['overflow'] for r in reports),'See report'
print(f'PASS: {len(reports)} PC checks; real season totals, averages, percentages, honours, links, filters and unchanged save; no current champion invented.')
