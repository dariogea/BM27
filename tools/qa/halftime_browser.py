"""Exercise the managed halftime flow with four quarters and two halves."""
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def check(browser, periods, pack=None):
    page = browser.new_page(viewport={"width": 1280, "height": 800}, accept_downloads=True)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.add_init_script("""
        const SimulationWorker = window.Worker;
        window.Worker = class extends SimulationWorker {
            constructor(...args) {
                super(...args);
                window.bm27Worker = this;
                this.addEventListener('message', ({data}) => {
                    if (data.id >= 900000) window.bm27Probe = data;
                    if (data.type === 'halftime') window.bm27Half = data.match;
                    if (data.type === 'state') window.bm27State = data.view;
                    if (data.type === 'matchDetail') window.bm27Match = data;
                    if (data.type === 'dataPack') window.bm27Pack = data.summary;
                });
            }
        };
    """)
    page.goto(os.environ.get("BM27_WEB_URL", "http://127.0.0.1:5173"))
    if pack:
        page.get_by_test_id("data-pack-file").set_input_files(str(pack))
        page.wait_for_function("Boolean(window.bm27Pack)")
    page.get_by_role("button", name="Nueva partida", exact=True).click()
    page.get_by_role("button", name="Dirigir este equipo", exact=True).click()
    page.get_by_role("button", name="Tácticas", exact=True).click()
    initial = page.evaluate("window.bm27State")
    page.get_by_role("button", name="Dirigir partido", exact=True).click()
    page.wait_for_function("Boolean(window.bm27Half)")
    half = page.evaluate("window.bm27Half")
    assert len([event for event in half["detail"]["events"] if event["type"] == "period_end"]) == periods // 2
    assert initial["userTeamId"] in (half["detail"]["boxScore"]["home"]["teamId"],
                                     half["detail"]["boxScore"]["away"]["teamId"])
    expect(page.get_by_role("button", name="Jugar jornada", exact=True)).to_be_disabled()
    expect(page.get_by_role("button", name="Jugar segunda mitad", exact=True)).to_have_count(0)
    page.evaluate("window.bm27Worker.postMessage({id: 900001, type: 'advance'})")
    page.wait_for_function("window.bm27Probe?.id === 900001")
    assert page.evaluate("window.bm27Probe.type") == "error"
    assert page.evaluate("window.bm27State.step") == initial["step"]

    page.get_by_role("button", name="Volver sin jugar la jornada").click()
    expect(page.get_by_role("button", name="Dirigir partido", exact=True)).to_be_visible()
    assert page.evaluate("window.bm27State.step") == initial["step"]
    page.get_by_role("button", name="Dirigir partido", exact=True).click()
    page.get_by_role("button", name="Saltar al descanso", exact=True).click()
    expect(page.get_by_role("heading", name="Descanso", exact=True)).to_be_visible()
    expect(page.get_by_test_id("replay-home-score")).to_have_text(str(half["detail"]["boxScore"]["home"]["points"]))
    expect(page.get_by_test_id("replay-away-score")).to_have_text(str(half["detail"]["boxScore"]["away"]["points"]))
    expect(page.get_by_text(f'Instrucciones para {initial["myTeam"]["name"]} en lo que queda de partido.')).to_be_visible()
    pace = "slow" if half["tactics"]["pace"] == "fast" else "fast"
    pressure = "low" if half["tactics"]["pressure"] == "high" else "high"
    page.get_by_label("Ritmo al descanso").select_option(pace)
    page.get_by_label("Presión al descanso").select_option(pressure)
    orders = {"pace": pace, "pressure": pressure}
    focus = "inside" if half["tactics"]["offenseFocus"] != "inside" else "perimeter"
    rebound = "crash" if half["tactics"]["offensiveRebounding"] != "crash" else "get-back"
    page.get_by_label("Ataque al descanso").select_option(focus)
    page.get_by_label("Rebote ofensivo al descanso").select_option(rebound)
    orders.update(offenseFocus=focus, offensiveRebounding=rebound)
    defense = "zone" if periods == 2 else "man"
    page.get_by_label("Defensa al descanso").select_option(defense)
    if defense != half["tactics"]["defenseScheme"]:
        orders["defenseScheme"] = defense
    coverage = page.get_by_label("Bloqueo directo al descanso")
    if defense == "zone":
        expect(coverage).to_be_disabled()
    else:
        plan = "blitz" if half["tactics"]["pickAndRollCoverage"] != "blitz" else "drop"
        coverage.select_option(plan)
        orders["pickAndRollCoverage"] = plan
    page.add_script_tag(path=os.environ.get("BM27_AXE_PATH", "/tmp/bm27-axe/package/axe.min.js"))
    assert page.evaluate("""async () => (await axe.run(document, {
        runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa']}
    })).violations.map(v => v.id)""") == []
    page.get_by_role("button", name="Jugar segunda mitad", exact=True).click()
    page.wait_for_function("Boolean(window.bm27Match)")
    played = page.evaluate("window.bm27Match")
    assert played["detail"]["events"][:len(half["detail"]["events"])] == half["detail"]["events"]
    assert played["halftimeTactics"] == orders
    assert page.evaluate("window.bm27State.myTeam.tactics") == initial["myTeam"]["tactics"]
    assert page.evaluate("window.bm27State.myTeam.lastMatch") == played["detail"]["result"]
    page.evaluate("(matchId) => window.bm27Worker.postMessage({id: 900002, type: 'finishManagedMatch', matchId})",
                  half["matchId"])
    page.wait_for_function("window.bm27Probe?.id === 900002")
    assert page.evaluate("window.bm27Probe.type") == "error"
    page.get_by_role("button", name="Saltar al final", exact=True).click()
    expect(page.get_by_text("Tu plan desde el descanso", exact=True)).to_be_visible()
    expect(page.get_by_test_id("replay-home-score")).to_have_text(str(played["detail"]["result"]["homeScore"]))
    expect(page.get_by_test_id("replay-away-score")).to_have_text(str(played["detail"]["result"]["awayScore"]))

    tools = page.locator("details.game-tools")
    if not tools.evaluate("(element) => element.open"):
        tools.locator("summary").click()
    with page.expect_download() as saved:
        page.get_by_role("button", name="Guardar partida", exact=True).click()
    content = Path(saved.value.path()).read_bytes()
    page.reload()
    page.get_by_test_id("load-file").set_input_files({
        "name": "halftime-save.json", "mimeType": "application/json", "buffer": content
    })
    page.wait_for_function("Boolean(window.bm27State?.myTeam?.lastMatch)")
    assert page.evaluate("window.bm27State.myTeam.lastMatch") == played["detail"]["result"]
    page.get_by_role("button", name="Ver partido", exact=True).first.click()
    expect(page.get_by_role("alert").filter(has_text="El detalle de este partido no está disponible")).to_be_visible()
    assert not errors, errors
    page.close()
    print(f"PASS: {periods} periods, owned tactics, deterministic first half, one committed result and save reload")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path=os.environ.get("BM27_CHROMIUM", "/usr/bin/chromium"),
        headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        timeout=20000,
    )
    check(browser, 4)
    check(browser, 2, Path("data/packs/example-eight-clubs.json").resolve())
    browser.close()
