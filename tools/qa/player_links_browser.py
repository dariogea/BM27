"""Verify direct player profiles and keyboard return in the PC management screens."""
import json
import os
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("BM27_CHROMIUM", "/usr/bin/chromium"),
        args=["--no-sandbox", "--no-zygote", "--single-process", "--disable-dev-shm-usage"],
    )
    page = browser.new_page(viewport={"width": 1280, "height": 800}, accept_downloads=True)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(os.environ.get("BM27_WEB_URL", "http://127.0.0.1:5173"))
    page.get_by_test_id("data-pack-file").set_input_files("data/packs/example-eight-clubs.json")
    page.get_by_role("button", name="Nueva partida", exact=True).click()
    page.get_by_test_id("summary").wait_for()
    page.get_by_role("button", name="Dirigir este equipo", exact=True).click()
    nav = page.get_by_role("navigation", name="Secciones de la partida")
    tools = page.locator("details.game-tools")

    def payload():
        if not tools.evaluate("(e) => e.open"):
            tools.locator("summary").click()
        with page.expect_download() as info:
            page.get_by_role("button", name="Guardar partida", exact=True).click()
        tools.locator("summary").click()
        return json.loads(Path(info.value.path()).read_bytes())["payload"]

    initial = payload()
    checks = 0
    for width, height, theme in [(1280, 800, "dark"), (1920, 1080, "light")]:
        page.set_viewport_size({"width": width, "height": height})
        if theme == "light":
            page.get_by_text("Apariencia", exact=True).click()
            page.get_by_role("button", name="☀ Modo claro", exact=True).click()
            page.get_by_text("Apariencia", exact=True).click()
        for section, selector, back, owned in [
            ("Mi equipo", '.squad-table', "Volver a Mi equipo", True),
            ("Mercado", '[data-testid="contracts"]', "Volver al Mercado", True),
            ("Mercado", '[data-testid="freeagents"]', "Volver al Mercado", False),
        ]:
            nav.get_by_role("button", name=section, exact=True).click()
            link = page.locator(selector).locator("button[data-player-id]").first
            name = link.inner_text()
            identity = link.get_attribute("data-player-id")
            link.focus()
            page.keyboard.press("Enter")
            profile = page.get_by_test_id("player-profile")
            expect(profile).to_be_focused()
            expect(profile.get_by_role("heading", name=name, exact=True)).to_be_visible()
            expect(profile.get_by_text("No revelado", exact=True)).to_have_count(0 if owned else 1)
            page.add_script_tag(path=os.environ.get("BM27_AXE_PATH", "/tmp/bm27-axe/package/axe.min.js"))
            violations = page.evaluate("""async () => (await axe.run(document, {
                runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}
            })).violations.map(v=>v.id)""")
            assert not violations, violations
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            page.get_by_role("button", name=back, exact=False).click()
            expect(page.locator(f'button[data-player-id="{identity}"]').first).to_be_focused()
            checks += 1
    assert payload() == initial
    assert not errors, errors
    print(f"PASS: {checks} direct profiles, keyboard return, rival potential hidden, unchanged save and no PC accessibility violations")
    browser.close()
