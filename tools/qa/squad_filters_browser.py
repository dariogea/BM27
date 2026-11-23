"""Check combined squad filters against a generated fixture with two explicit injuries."""
import json
import os
import subprocess
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

fixture = subprocess.run(
    ["pnpm", "exec", "tsx", "-e", """
        import { readFileSync } from 'node:fs';
        import { generateUniverseFromDataPack, setUserTeam, exportSave } from './packages/core/src/index.ts';
        const pack = JSON.parse(readFileSync('data/packs/example-eight-clubs.json', 'utf8'));
        let world = generateUniverseFromDataPack(pack, 'squad-filters');
        world = setUserTeam(world, world.teams[0].id);
        const squad = world.players.filter(p => p.teamId === world.userTeamId);
        squad[0].injury = { gamesRemaining: 3 };
        squad[1].injury = { gamesRemaining: 2 };
        process.stdout.write(exportSave(world));
    """],
    check=True, capture_output=True,
).stdout
saved = json.loads(fixture)["payload"]
players = [p for p in saved["players"] if p["teamId"] == saved["userTeamId"]]

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("BM27_CHROMIUM", "/usr/bin/chromium"),
        args=["--no-sandbox", "--no-zygote", "--single-process", "--disable-dev-shm-usage"],
    )
    page = browser.new_page(viewport={"width": 1280, "height": 800}, accept_downloads=True)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(os.environ.get("BM27_WEB_URL", "http://127.0.0.1:5173"))
    page.get_by_test_id("load-file").set_input_files(
        {"name": "filters.json", "mimeType": "application/json", "buffer": fixture}
    )
    expect(page.get_by_test_id("status")).to_contain_text("Partida cargada")
    nav = page.get_by_role("navigation", name="Secciones de la partida")
    nav.get_by_role("button", name="Mi equipo", exact=True).click()
    table = page.locator(".squad-table")
    first_five = set(table.locator("tbody tr.starter button[data-player-id]").evaluate_all(
        "(elements) => elements.map(e => e.dataset.playerId)"
    ))
    filters = page.get_by_role("search", name="Filtrar plantilla")
    checks = 0
    for width, height, theme in [(1280, 800, "dark"), (1920, 1080, "light")]:
        page.set_viewport_size({"width": width, "height": height})
        if theme == "light":
            page.get_by_text("Apariencia", exact=True).click()
            page.get_by_role("button", name="☀ Modo claro", exact=True).click()
            page.get_by_text("Apariencia", exact=True).click()
        for position in ["", "PG", "SG", "SF", "PF", "C"]:
            filters.get_by_role("combobox", name="Posición de la plantilla").select_option(position)
            for status in ["all", "healthy", "injured"]:
                filters.get_by_role("combobox", name="Disponibilidad").select_option(status)
                expected = {player["id"] for player in players
                            if (not position or position in player["positions"])
                            and (status == "all" or bool(player["injury"]) == (status == "injured"))}
                shown = set(table.locator("button[data-player-id]").evaluate_all(
                    "(elements) => elements.map(e => e.dataset.playerId)"
                ))
                assert shown == expected
                starters = set(table.locator("tr.starter button[data-player-id]").evaluate_all(
                    "(elements) => elements.map(e => e.dataset.playerId)"
                ))
                assert starters == expected.intersection(first_five)
                checks += 1
        filters.get_by_role("button", name="Limpiar filtros").click()
        query = filters.get_by_role("searchbox", name="Jugador de la plantilla")
        query.fill("  " + players[0]["lastName"].upper() + "  ")
        expected = {player["id"] for player in players
                    if players[0]["lastName"].lower() in (player["firstName"] + " " + player["lastName"]).lower()}
        shown = set(table.locator("button[data-player-id]").evaluate_all("(elements) => elements.map(e => e.dataset.playerId)"))
        assert shown == expected
        query.fill("no-such-player")
        expect(table.locator("tbody tr")).to_have_count(0)
        expect(page.get_by_text("No hay jugadores que cumplan estos filtros.", exact=True)).to_be_visible()
        filters.get_by_role("button", name="Limpiar filtros").click()
        table.get_by_role("columnheader", name="Edad").get_by_role("button").click()
        ages = table.locator("tbody tr").evaluate_all(
            "(rows) => rows.map(row => Number(row.querySelectorAll('td')[2].textContent))"
        )
        assert ages == sorted(ages, reverse=(theme == "dark"))
        page.add_script_tag(path=os.environ.get("BM27_AXE_PATH", "/tmp/bm27-axe/package/axe.min.js"))
        assert not page.evaluate("""async () => (await axe.run(document, {
            runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}
        })).violations.map(v=>v.id)""")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    tools = page.locator("details.game-tools")
    tools.locator("summary").click()
    with page.expect_download() as info:
        page.get_by_role("button", name="Guardar partida", exact=True).click()
    assert json.loads(Path(info.value.path()).read_bytes())["payload"] == saved
    assert not errors, errors
    print(f"PASS: {checks} filter combinations, secondary positions, original starters, sorting, empty state and unchanged save")
    browser.close()
