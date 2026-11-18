"""Compare a watched matchday with quick simulation using a real Worker."""
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
    nav = page.get_by_role("navigation", name="Secciones de la partida")
    header = page.locator(".manager-header")
    viewer = page.get_by_test_id("replay-viewer")
    boxscore = page.get_by_test_id("boxscore")

    def save():
        tools = page.locator("details.game-tools")
        if not tools.evaluate("(element) => element.open"):
            tools.locator("summary").click()
        with page.expect_download() as download:
            page.get_by_role("button", name="Guardar partida", exact=True).click()
        tools.locator("summary").click()
        return Path(download.value.path()).read_bytes()

    def load(contents):
        page.get_by_test_id("load-file").set_input_files(
            {"name": "matchday.json", "mimeType": "application/json", "buffer": contents}
        )
        expect(page.get_by_test_id("status")).to_contain_text("Partida cargada")

    page.get_by_role("button", name="Nueva partida", exact=True).click()
    expect(page.get_by_test_id("summary")).to_be_visible()
    expect(header.get_by_role("button", name="Jugar y ver")).to_have_count(0)
    page.get_by_role("button", name="Dirigir este equipo", exact=True).click()
    nav.get_by_role("button", name="Tácticas", exact=True).click()
    pace = page.get_by_role("combobox", name="Ritmo", exact=True)
    target = "slow" if pace.input_value() != "slow" else "fast"
    pace.select_option(target)
    page.get_by_role("button", name="Guardar tácticas", exact=True).click()
    expect(page.get_by_role("button", name="Guardar tácticas", exact=True)).to_be_disabled()
    starting_save = save()
    page.locator(".workspace-content").get_by_role("button", name="Jugar y ver", exact=True).click()

    expect(viewer.get_by_role("heading", name="Retransmisión del partido")).to_be_visible()
    expect(viewer).to_contain_text(f"Ritmo: {'lento' if target == 'slow' else 'rápido'}")
    expect(boxscore).to_have_count(0)
    expect(page.get_by_test_id("summary")).to_have_count(0)
    stats = viewer.get_by_role("table", name="Estadísticas hasta la jugada actual")
    field_goals = stats.get_by_role("row").filter(
        has=page.get_by_role("rowheader", name="Tiros de campo", exact=True)
    ).get_by_role("cell")
    viewer.get_by_text("Estadísticas por jugador", exact=True).click()
    player_table = viewer.get_by_role("table", name="Jugadores hasta la jugada actual", exact=False)
    roster_select = viewer.get_by_role("combobox", name="Consultar estadísticas de")
    expect(roster_select.locator("option:checked")).to_contain_text("Tu equipo")
    expect(roster_select.get_by_role("option", name="Rival", exact=False)).to_have_count(1)
    timeline = viewer.get_by_role("slider")
    page.wait_for_function("Number(document.querySelector('.replay-progress input').value) > 1")
    viewer.get_by_role("button", name="Pausar", exact=True).click()
    paused = timeline.input_value()
    page.wait_for_timeout(400)
    assert timeline.input_value() == paused
    for width, height, theme in [(1280, 800, "dark"), (1920, 1080, "light")]:
        page.set_viewport_size({"width": width, "height": height})
        if theme == "light":
            page.get_by_text("Apariencia", exact=True).click()
            page.get_by_role("button", name="☀ Modo claro", exact=True).click()
            page.get_by_text("Apariencia", exact=True).click()
        page.add_script_tag(path=os.environ.get("BM27_AXE_PATH", "/tmp/bm27-axe/package/axe.min.js"))
        violations = page.evaluate("""async () => (await axe.run(document, {runOnly:
            {type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>v.id)""")
        assert not violations, violations
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    viewer.get_by_role("button", name="Saltar al final", exact=True).click()
    expect(boxscore).to_be_visible()
    totals = boxscore.get_by_role("row").filter(
        has=page.get_by_role("cell", name="Total", exact=True)
    )
    for team in range(2):
        expected = totals.nth(team).get_by_role("cell").all_text_contents()[3:]
        shown = [row.get_by_role("cell").nth(team).inner_text()
                 for row in stats.locator("tbody tr").all()]
        assert shown == expected, (shown, expected)
    for side, team in [("home", 0), ("away", 1)]:
        roster_select.select_option(side)
        report = boxscore.get_by_role("region", name="Estadísticas del partido").nth(team)
        records = {
            row.get_by_role("rowheader").inner_text(): row.get_by_role("cell").all_text_contents()[1:]
            for row in player_table.locator("tbody tr").all()
        }
        for row in report.locator("tbody tr").all()[:-1]:
            name, *line = row.get_by_role("cell").all_text_contents()
            assert records[name.removesuffix(" *")] == line
        assert player_table.get_by_role("cell", name="Sí", exact=True).count() == 5
    viewer.get_by_role("button", name="Inicio", exact=True).click()
    expect(field_goals).to_have_text(["0/0", "0/0"])
    assert player_table.get_by_role("cell", name="Sí", exact=True).count() == 0
    assert all(
        cell in ("0", "0/0", "0:00")
        for row in player_table.locator("tbody tr").all()
        for cell in row.get_by_role("cell").all_text_contents()[1:]
    )
    viewer.get_by_role("button", name="Saltar al final", exact=True).click()
    for team in range(2):
        expect(field_goals.nth(team)).to_have_text(totals.nth(team).get_by_role("cell").nth(3).inner_text())
    picker = viewer.get_by_role("combobox", name="Repetir jugada destacada")
    end = timeline.input_value()
    chosen = picker.locator("option").nth(1).get_attribute("value")
    picker.select_option(chosen)
    expect(timeline).to_have_value(chosen)
    expect(viewer.get_by_role("button", name="Reproducir", exact=True)).to_be_visible()
    viewer.get_by_role("button", name="Volver al punto anterior").click()
    expect(timeline).to_have_value(end)
    viewer.get_by_role("button", name="Inicio", exact=True).click()
    expect(picker).to_be_disabled()
    expect(picker.locator("option")).to_have_count(1)
    viewer.get_by_role("button", name="Saltar al final", exact=True).click()
    watched = json.loads(save())["payload"]
    club_id = watched["userTeamId"]
    match = next(
        match
        for competition in watched["currentSeason"]["competitions"]
        for match in competition["matches"]
        if club_id in (match["homeTeamId"], match["awayTeamId"])
    )
    expect(viewer.get_by_test_id("replay-home-score")).to_have_text(str(match["homeScore"]))
    expect(viewer.get_by_test_id("replay-away-score")).to_have_text(str(match["awayScore"]))

    load(starting_save)
    header.get_by_role("button", name="Jugar jornada", exact=True).click()
    expect(page.get_by_test_id("status")).to_contain_text("Jornada jugada")
    expect(viewer).to_have_count(0)
    assert json.loads(save())["payload"] == watched
    load(starting_save)
    header.get_by_role("button", name="Jugar y ver", exact=True).click()
    expect(viewer.get_by_role("heading", name="Retransmisión del partido")).to_be_visible()
    # Manage the away club from the same fixture and check the default again.
    load(starting_save)
    if match["awayTeamId"] != club_id:
        club_tools = page.locator("details.team-management")
        if not club_tools.evaluate("(element) => element.open"):
            club_tools.locator("summary").click()
        page.get_by_role("combobox", name="Equipo", exact=True).select_option(match["awayTeamId"])
        page.get_by_role("button", name="Dirigir este equipo", exact=True).click()
    header.get_by_role("button", name="Jugar y ver", exact=True).click()
    expect(viewer.get_by_role("heading", name="Retransmisión del partido")).to_be_visible()
    viewer.get_by_text("Estadísticas por jugador", exact=True).click()
    expect(roster_select).to_have_value("away")
    expect(roster_select.locator("option:checked")).to_contain_text("Tu equipo")
    assert not errors, errors
    print("PASS: two PC audits, saved tactics, autoplay, pause, skip, matching team and player lines, rewind, exact score, identical simulated state")
    browser.close()
