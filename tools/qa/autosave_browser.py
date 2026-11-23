"""Exercise matchday recovery and the title-menu Continue action in a PC browser."""
import json
import os
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path=os.environ.get("BM27_CHROMIUM", "/usr/bin/chromium"),
        args=["--no-sandbox", "--no-zygote", "--single-process", "--disable-dev-shm-usage"],
    )
    page = browser.new_page(viewport={"width": 1280, "height": 800}, accept_downloads=True)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(os.environ.get("BM27_WEB_URL", "http://127.0.0.1:5173"))
    tools = page.locator("details.game-tools")

    def export_payload():
        if not tools.evaluate("(element) => element.open"):
            tools.locator("summary").click()
        with page.expect_download() as download:
            page.get_by_role("button", name="Guardar partida", exact=True).click()
        tools.locator("summary").click()
        return json.loads(Path(download.value.path()).read_bytes())["payload"]

    expect(page.get_by_role("button", name="Continuar", exact=True)).to_have_count(0)
    page.get_by_test_id("data-pack-file").set_input_files("data/packs/example-eight-clubs.json")
    tools.locator("summary").click()
    page.get_by_role("button", name="Nueva partida", exact=True).click()
    page.get_by_test_id("summary").wait_for()
    page.get_by_role("button", name="Dirigir este equipo", exact=True).click()
    header = page.locator(".manager-header")
    header.get_by_role("button", name="Jugar jornada", exact=True).click()
    expect(page.get_by_test_id("status")).to_contain_text("Guardado automático completado")
    first = export_payload()
    header.get_by_role("button", name="Jugar jornada", exact=True).click()
    expect(page.get_by_test_id("status")).to_contain_text("Guardado automático completado")
    second = export_payload()

    page.reload()
    page.get_by_role("button", name="Continuar", exact=True).click()
    expect(page.get_by_test_id("status")).to_contain_text("Partida cargada")
    assert export_payload() == second
    page.get_by_role("navigation", name="Secciones de la partida").get_by_role(
        "button", name="Partidas", exact=True
    ).click()
    table = page.get_by_role("table", name="Guardados internos disponibles")
    previous = table.get_by_role("row").filter(
        has=page.get_by_text("Guardado automático anterior", exact=True)
    )
    page.once("dialog", lambda dialog: dialog.accept())
    previous.get_by_role("button", name="Cargar", exact=True).click()
    expect(page.get_by_test_id("status")).to_contain_text("Partida cargada")
    assert export_payload() == first
    header.get_by_role("button", name="Jugar jornada", exact=True).click()
    expect(page.get_by_test_id("status")).to_contain_text("Guardado automático completado")
    assert export_payload() == second

    page.evaluate("""async () => {
        const request = indexedDB.open('bm27-saves-v1', 1);
        const db = await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction('payloads', 'readwrite');
                tx.objectStore('payloads').put({ name: '__bm27_autosave__', json: 'broken' });
                tx.oncomplete = resolve;
                tx.onabort = () => reject(tx.error);
            });
        } finally {
            db.close();
        }
    }""")
    page.reload()
    page.get_by_role("button", name="Continuar", exact=True).click()
    expect(page.get_by_role("alert")).to_contain_text("dañada")
    expect(page.get_by_test_id("summary")).to_have_count(0)
    recovery = page.get_by_role("button", name="Cargar autoguardado anterior", exact=False)
    expect(recovery).to_contain_text("Temporada 1")
    recovery.focus()
    page.keyboard.press("Enter")
    expect(page.get_by_test_id("status")).to_contain_text("Partida cargada")
    assert export_payload() == first
    header.get_by_role("button", name="Jugar jornada", exact=True).click()
    expect(page.get_by_test_id("status")).to_contain_text("Guardado automático completado")
    assert export_payload() == second
    page.get_by_role("navigation", name="Secciones de la partida").get_by_role(
        "button", name="Partidas", exact=True
    ).click()
    page.once("dialog", lambda dialog: dialog.accept())
    previous.get_by_role("button", name="Cargar", exact=True).click()
    expect(page.get_by_test_id("status")).to_contain_text("Partida cargada")
    assert export_payload() == first

    for width, height, theme in [(1280, 800, "dark"), (1920, 1080, "light")]:
        page.set_viewport_size({"width": width, "height": height})
        if theme == "light":
            page.get_by_text("Apariencia", exact=True).click()
            page.get_by_role("button", name="☀ Modo claro", exact=True).click()
            page.get_by_text("Apariencia", exact=True).click()
        page.reload()
        expect(page.get_by_role("button", name="Continuar", exact=True)).to_be_visible()
        page.add_script_tag(path=os.environ.get("BM27_AXE_PATH", "/tmp/bm27-axe/package/axe.min.js"))
        violations = page.evaluate("""async () => (await axe.run(document, {
            runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}
        })).violations.map(v => v.id)""")
        assert not violations, violations
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    assert not errors, errors
    print("PASS: corrupt autosave recovery without overwriting the last valid copy, Continue after restart, previous checkpoint recovery, deterministic continuation and two PC accessibility audits")
    browser.close()
