"""Compare future and played matchdays with the real Worker's calendar, including byes."""
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
    page.add_init_script("""
        const OriginalWorker = Worker;
        window.Worker = class extends OriginalWorker {
            constructor(...args) {
                super(...args);
                this.addEventListener('message', ({data}) => {
                    if (data.type === 'state') window.calendarState = data.view;
                });
            }
        };
    """)
    page.goto(os.environ.get("BM27_WEB_URL", "http://127.0.0.1:5173"))
    sample = json.loads(Path("data/packs/example-eight-clubs.json").read_text())
    sample["config"]["levels"][0]["teamCount"] = 7
    page.get_by_test_id("data-pack-file").set_input_files(
        {"name": "seven-clubs.json", "mimeType": "application/json", "buffer": json.dumps(sample).encode()}
    )
    page.get_by_role("button", name="Nueva partida", exact=True).click()
    page.get_by_test_id("summary").wait_for()
    page.get_by_role("button", name="Dirigir este equipo", exact=True).click()
    page.locator(".manager-header").get_by_role("button", name="Jugar jornada", exact=True).click()
    expect(page.get_by_test_id("status")).to_contain_text("Jornada jugada")
    nav = page.get_by_role("navigation", name="Secciones de la partida")
    nav.get_by_role("button", name="Competición", exact=True).click()
    view = page.evaluate("window.calendarState")
    table = next(t for t in view["tables"] if t["competitionId"] == view["myTeam"]["competitionId"])
    fixtures = table["fixtures"]
    upcoming = page.get_by_role("region", name="Partidos de la jornada")
    round_select = page.get_by_role("combobox", name="Jornada", exact=True)
    assert round_select.get_by_role("option").count() == len(set(f["round"] for f in fixtures))
    own = view["userTeamId"]
    bye_round = next(r for r in sorted(set(f["round"] for f in fixtures))
                     if r > 1 and not any(own in (f["homeTeamId"], f["awayTeamId"]) for f in fixtures if f["round"] == r))
    for width, height, theme in [(1280, 800, "dark"), (1920, 1080, "light")]:
        page.set_viewport_size({"width": width, "height": height})
        if theme == "light":
            page.get_by_text("Apariencia", exact=True).click()
            page.get_by_role("button", name="☀ Modo claro", exact=True).click()
            page.get_by_text("Apariencia", exact=True).click()
        round_select.select_option("2")
        expected = [f for f in fixtures if f["round"] == 2]
        rows = upcoming.locator("tbody tr")
        expect(rows).to_have_count(len(expected))
        for row, fixture in zip(rows.all(), expected):
            assert row.get_by_role("cell").all_text_contents() == [
                view["teamNames"][fixture["homeTeamId"]], "—", "—",
                view["teamNames"][fixture["awayTeamId"]], "", "Programado",
            ]
        expect(upcoming.get_by_role("button")).to_have_count(0)
        page.get_by_label("Solo mis partidos").check()
        round_select.select_option(str(bye_round))
        expect(rows).to_have_count(0)
        expect(page.get_by_text("Tu equipo no tiene partido en esta jornada.", exact=True)).to_be_visible()
        page.get_by_label("Solo mis partidos").uncheck()
        round_select.select_option("2")
        page.add_script_tag(path=os.environ.get("BM27_AXE_PATH", "/tmp/bm27-axe/package/axe.min.js"))
        assert not page.evaluate("""async () => (await axe.run(document, {
            runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}
        })).violations.map(v=>v.id)""")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.locator(".manager-header").get_by_role("button", name="Jugar jornada", exact=True).click()
    page.wait_for_function("window.calendarState.step === 2")
    results = page.evaluate("window.calendarState.tables").copy()
    played = next(t for t in results if t["competitionId"] == table["competitionId"])["matches"]
    actual = [m for m in played if m["round"] == 2 and m["stage"] == "regular"]
    assert {m["id"] for m in actual} == {f["id"] for f in fixtures if f["round"] == 2}
    expect(upcoming.get_by_role("button", name="Ver el acta", exact=False)).to_have_count(len(actual))
    assert not errors, errors
    print("PASS: real future calendar, 7-team byes, no premature reports, two PC audits and exact fixture IDs when played")
    browser.close()
