import json
import gzip
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage'])
 page=b.new_page(accept_downloads=True,viewport={'width':1280,'height':800})
 page.goto('http://localhost:5173')
 page.get_by_role('button',name='Nueva partida',exact=True).click()
 page.get_by_role('button',name='Dirigir este equipo',exact=True).click()
 page.locator('.manager-header').get_by_role('button',name='Jugar jornada',exact=True).click()
 expect(page.get_by_test_id('status')).to_contain_text('Jornada jugada')
 def export(name):
  tools=page.locator('.game-tools')
  if not tools.evaluate('(e)=>e.open'):tools.locator('summary').click()
  with page.expect_download() as d:page.get_by_role('button',name=name,exact=True).click()
  return Path(d.value.path()).read_bytes()
 plain=export('Guardar partida')
 packed=export('Guardar partida comprimida')
 assert gzip.decompress(packed)==plain
 page.reload()
 f=page.get_by_test_id('load-file')
 f.set_input_files(dict(name='career.json.gz',mimeType='application/gzip',buffer=packed))
 expect(page.get_by_test_id('status')).to_contain_text('Partida cargada')
 assert json.loads(export('Guardar partida'))['payload']==json.loads(plain)['payload']
 f.set_input_files(dict(name='bad.gz',mimeType='application/gzip',buffer=packed[:-6]))
 expect(page.get_by_role('alert')).to_contain_text('dañado')
 assert json.loads(export('Guardar partida'))['payload']==json.loads(plain)['payload']
 f.set_input_files(dict(name='career.json',mimeType='application/json',buffer=plain))
 expect(page.get_by_test_id('status')).to_contain_text('Partida cargada')
 print(f'PASS: JSON {len(plain)} bytes; gzip {len(packed)} bytes; identical state after load and corrupt file rejected')
 b.close()
