"""Verify direct club navigation using the actual simulation Worker on PC."""
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
    page.add_init_script("""
        const RealWorker = window.Worker;
        window.Worker = class extends RealWorker {
            set onmessage(handler) {
                this.addEventListener('message', event => {
                    if (event.data.type === 'state') window.bm27State = event.data.view;
                    if (window.delayClub && event.data.result?.kind === 'club') {
                        setTimeout(() => {
                            handler(event);
                            window.clubDelivered = true;
                        }, 1000);
                    } else handler(event);
                });
            }
        };
    """)
    page.goto(os.environ.get("BM27_WEB_URL", "http://127.0.0.1:5173"))
    nav = page.get_by_role("navigation", name="Secciones de la partida")
    profile = page.get_by_test_id("club-profile")
    registered = page.get_by_role("list", name="Clubes inscritos en la competición")
    standings = page.get_by_role("region", name="Clasificación del portal")

    def close_game_tools():
        details = page.locator("details.game-tools")
        if details.evaluate("(element) => element.open"):
            details.locator("summary").click()

    def save():
        details = page.locator("details.game-tools")
        if not details.evaluate("(element) => element.open"):
            details.locator("summary").click()
        with page.expect_download() as download:
            page.get_by_role("button", name="Guardar partida", exact=True).click()
        close_game_tools()
        return Path(download.value.path()).read_bytes()

    def verify_club(button, keyboard=False):
        name = button.inner_text()
        if keyboard:
            button.focus()
            button.press("Enter")
        else:
            button.click()
        expect(profile.get_by_role("heading", name=name, exact=True)).to_be_visible()
        expect(profile).to_be_focused()
        expect(profile.get_by_role("region", name="Plantilla del club consultado")
               .locator("tbody tr").first).to_be_visible()

    def audit():
        page.add_script_tag(path=os.environ.get("BM27_AXE_PATH", "/tmp/bm27-axe/package/axe.min.js"))
        violations = page.evaluate("""async () => (await axe.run(document, {runOnly:
            {type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>v.id)""")
        assert not violations, violations
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")

    page.get_by_role("button", name="Nueva partida", exact=True).click()
    registered.wait_for()
    before = save()
    verify_club(registered.get_by_role("button").first, keyboard=True)
    page.get_by_role("button", name="← Volver al Portal", exact=True).click()
    page.evaluate("window.delayClub = true")
    registered.get_by_role("button").first.click()
    expect(page.get_by_text("Abriendo ficha del club…")).to_be_visible()
    nav.get_by_role("button", name="Mundo", exact=True).click()
    page.wait_for_function("window.clubDelivered")
    expect(profile).to_have_count(0)
    page.evaluate("window.delayClub = false")
    expect(page.get_by_role("heading", name="Buscador de jugadores y clubes")).to_be_visible()
    assert save() == before

    nav.get_by_role("button", name="Portal", exact=True).click()
    page.evaluate("window.delayClub = true; window.clubDelivered = false")
    registered.get_by_role("button").first.click()
    expect(page.get_by_text("Abriendo ficha del club…")).to_be_visible()
    page.get_by_test_id("load-file").set_input_files(
        {"name": "portal-save.json", "mimeType": "application/json", "buffer": before}
    )
    registered.wait_for()
    page.wait_for_function("window.clubDelivered")
    page.evaluate("window.delayClub = false")
    nav.get_by_role("button", name="Mundo", exact=True).click()
    expect(profile).to_have_count(0)
    nav.get_by_role("button", name="Portal", exact=True).click()
    page.get_by_role("button", name="Dirigir este equipo", exact=True).click()
    page.get_by_role("button", name="Jugar jornada", exact=True).click()
    standings.wait_for()
    before = save()
    audits = 0
    for width, height in [(1280, 800), (1920, 1080)]:
        page.set_viewport_size({"width": width, "height": height})
        for theme in ["dark", "light"]:
            if page.evaluate("document.documentElement.dataset.theme") != theme:
                page.get_by_text("Apariencia", exact=True).click()
                page.get_by_role("button", name="☀ Modo claro" if theme == "light" else "☾ Modo oscuro", exact=True).click()
                page.get_by_text("Apariencia", exact=True).click()
            competition = page.get_by_role("combobox", name="Competición del portal")
            competition.select_option(index=audits)
            audit()
            verify_club(standings.get_by_role("button").first)
            audit()
            audits += 1
            page.get_by_role("button", name="← Volver al Portal", exact=True).click()
    verify_club(page.locator("button.opponent-name"))
    expect(profile.get_by_role("region", name="Plantilla del club consultado")).to_be_visible()
    profile.get_by_role("region", name="Plantilla del club consultado").get_by_role("button").first.click()
    expect(page.get_by_test_id("player-profile")).to_be_focused()
    assert save() == before

    page.locator("details.game-tools summary").click()
    page.get_by_test_id("data-pack-file").set_input_files(
        str(Path("data/packs/example-eight-defined-clubs.json").resolve())
    )
    expect(page.get_by_text("8 clubes definidos individualmente. Jugadores generados.", exact=True)).to_be_visible()
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Nueva partida", exact=True).click()
    page.wait_for_function("window.bm27State?.clubData === 'defined'")
    verify_club(registered.get_by_role("button", name="Valle Norte Canastas", exact=True))
    expect(profile).to_contain_text("Club de Baloncesto Valle Norte 1")
    assert not errors, errors
    print(f"PASS: {audits * 2} PC axe audits, portal links, keyboard, stale reply, saves and explicit IDs")
    browser.close()
