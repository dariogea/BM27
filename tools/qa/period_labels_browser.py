"""Verify that actual two-half and four-quarter games use the correct labels."""
import csv
import io
import os
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("BM27_CHROMIUM", "/usr/bin/chromium"),
        args=["--no-sandbox", "--no-zygote", "--single-process", "--disable-dev-shm-usage"],
    )
    page = browser.new_page(viewport={"width": 1280, "height": 800}, accept_downloads=True)
    page.add_init_script("""
        const OriginalWorker = Worker;
        window.Worker = class extends OriginalWorker {
            constructor(...args) {
                super(...args);
                this.addEventListener('message', ({data}) => {
                    if (data.type === 'matchDetail') {
                        window.matchDetail = data.detail;
                        window.matchPlayerNames = data.playerNames;
                    }
                });
            }
        };
    """)
    for pack, labels, prefix in [
        (None, ["Cuarto " + str(i) for i in range(1, 5)], "C"),
        ("data/packs/example-eight-clubs.json", ["Mitad 1", "Mitad 2"], "M"),
    ]:
        page.goto(os.environ.get("BM27_WEB_URL", "http://127.0.0.1:5173"))
        if pack:
            page.get_by_test_id("data-pack-file").set_input_files(pack)
            expect(page.get_by_test_id("status")).to_contain_text("Paquete validado")
        page.get_by_role("button", name="Nueva partida", exact=True).click()
        page.get_by_role("button", name="Dirigir este equipo", exact=True).click()
        page.locator(".manager-header").get_by_role("button", name="Jugar jornada", exact=True).click()
        expect(page.get_by_test_id("status")).to_contain_text("Jornada jugada")
        nav = page.get_by_role("navigation", name="Secciones de la partida")
        nav.get_by_role("button", name="Competición", exact=True).click()
        fixtures = page.get_by_role("region", name="Partidos de la jornada")
        overtime = fixtures.locator("tr").filter(has=page.get_by_role("cell", name="1", exact=True))
        open_match = overtime.filter(has=page.get_by_role("button", name="Ver el acta", exact=False))
        (open_match if open_match.count() else fixtures).get_by_role(
            "button", name="Ver el acta", exact=False
        ).first.click()
        report = page.get_by_test_id("boxscore")
        expect(report).to_be_visible()
        extra = page.evaluate("window.matchDetail.result.overtimePeriods")
        names = report.get_by_role("combobox", name="Periodo").get_by_role("option")
        expect(names).to_have_text(labels + ["Prórroga " + str(i) for i in range(1, extra + 1)])
        headers = report.locator("table").first.get_by_role("columnheader").all_text_contents()
        assert headers[1:-2] == [
            prefix + str(i + 1) for i in range(len(labels))
        ] + ["PR" + str(i) for i in range(1, extra + 1)]
        report.get_by_text("Análisis de tiros y pérdidas", exact=True).click()
        efficiency = report.get_by_role("table", name="Eficiencia ofensiva")
        box = page.evaluate("window.matchDetail.boxScore")
        detail = page.evaluate("window.matchDetail")
        replay = page.get_by_test_id("replay-viewer")
        chart = replay.locator(".score-progression svg")
        expect(chart).to_have_attribute(
            "aria-label", "Tras 0:00 de juego, "
            f"{replay.locator('.replay-scoreboard > div').first.locator('span').inner_text()} 0, "
            f"{replay.locator('.replay-scoreboard > div').last.locator('span').inner_text()} 0"
        )
        start_paths = chart.locator("path").evaluate_all("(paths) => paths.map((path) => path.getAttribute('d'))")
        replay.get_by_role("button", name="Saltar al final", exact=True).click()
        minutes, seconds = divmod(sum(e["periodSeconds"] for e in detail["events"] if e["type"] == "period_start"), 60)
        home = replay.locator(".replay-scoreboard > div").first.locator("span").inner_text()
        away = replay.locator(".replay-scoreboard > div").last.locator("span").inner_text()
        expect(chart).to_have_attribute(
            "aria-label", f"Tras {minutes}:{seconds:02d} de juego, {home} {box['home']['points']}, {away} {box['away']['points']}"
        )
        assert chart.locator("path").evaluate_all("(paths) => paths.map((path) => path.getAttribute('d'))") != start_paths
        replay.get_by_role("button", name="Inicio", exact=True).click()
        assert chart.locator("path").evaluate_all("(paths) => paths.map((path) => path.getAttribute('d'))") == start_paths
        for index, side in enumerate(["home", "away"]):
            line = box[side]
            totals = line["totals"]
            cells = efficiency.locator("tbody tr").nth(index).get_by_role("cell").all_text_contents()
            expected_efg = (totals["fieldGoalsMade"] + 0.5 * totals["threePointersMade"]) / totals["fieldGoalsAttempted"]
            expected_ppp = line["points"] / line["possessions"]
            assert abs(float(cells[0].replace("%", "").strip().replace(",", ".")) - 100 * expected_efg) <= 0.051
            assert abs(float(cells[1].replace(",", ".")) - expected_ppp) <= 0.0051
        grouped = report.get_by_role("region", name="Desglose de tiros y pérdidas")
        shots = [event for event in detail["events"] if event["type"] == "shot"]
        turnovers = [event for event in detail["events"] if event["type"] == "turnover"]
        for mode, field in [("zones", "zone"), ("plays", "playType")]:
            report.get_by_role("combobox", name="Agrupar estadísticas").select_option(mode)
            rows = grouped.locator("tr[data-shot-category]").all()
            assert rows
            expected_totals = {side["teamId"]: side["totals"] for side in detail["boxScore"].values()
                               if isinstance(side, dict) and "teamId" in side}
            by_team = {team: [0, 0, 0] for team in expected_totals}
            lost_by_team = {team: 0 for team in expected_totals}
            expect(grouped.get_by_role("columnheader", name="Pérdidas")).to_have_count(int(mode == "plays"))
            for row in rows:
                team = row.get_attribute("data-team")
                category = row.get_attribute("data-shot-category")
                events = [shot for shot in shots if shot["offenseTeamId"] == team and shot[field] == category]
                made = [shot for shot in events if shot["made"]]
                cells = row.get_by_role("cell").all_text_contents()
                values = [len(made), len(events), sum(shot["points"] for shot in made)]
                assert [int(cells[i]) for i in (1, 2, 4)] == values
                if mode == "plays":
                    losses = sum(1 for event in turnovers if event["offenseTeamId"] == team and event["playType"] == category)
                    assert int(cells[5]) == losses
                    lost_by_team[team] += losses
                if not events:
                    assert cells[3] == "—"
                by_team[team] = [total + value for total, value in zip(by_team[team], values)]
            for team, values in by_team.items():
                totals = expected_totals[team]
                if mode == "plays":
                    assert lost_by_team[team] == totals["turnovers"]
                assert values == [totals["fieldGoalsMade"], totals["fieldGoalsAttempted"],
                                  totals["points"] - totals["freeThrowsMade"]]
        report.get_by_text("Rendimiento de los quintetos", exact=True).click()
        lineup_table = report.get_by_role("region", name="Tabla de quintetos")
        for side, other in [("home", "away"), ("away", "home")]:
            report.get_by_role("combobox", name="Quintetos de").select_option(side)
            rows = [row.get_by_role("cell").all_text_contents()
                    for row in lineup_table.locator("tbody tr").all()]
            assert rows
            seconds = sum(int(m) * 60 + int(s) for m, s in (row[0].split(":") for row in rows))
            assert seconds == box[side]["totals"]["seconds"] / 5
            assert sum(int(row[1]) for row in rows) == box[side]["points"]
            assert sum(int(row[2]) for row in rows) == box[other]["points"]
            assert all(int(row[3]) == int(row[1]) - int(row[2]) for row in rows)
        with page.expect_download() as download:
            report.get_by_role("button", name="Exportar acta CSV").click()
        assert download.value.suggested_filename.endswith(".csv")
        contents = Path(download.value.path()).read_text(encoding="utf-8-sig")
        exported = list(csv.DictReader(io.StringIO(contents), delimiter=";"))
        player_names = page.evaluate("window.matchPlayerNames")
        fields = {
            "Segundos en pista": "seconds", "Puntos": "points",
            "Tiros de campo anotados": "fieldGoalsMade",
            "Tiros de campo intentados": "fieldGoalsAttempted",
            "Triples anotados": "threePointersMade", "Triples intentados": "threePointersAttempted",
            "Tiros libres anotados": "freeThrowsMade", "Tiros libres intentados": "freeThrowsAttempted",
            "Rebotes ofensivos": "offensiveRebounds", "Rebotes defensivos": "defensiveRebounds",
            "Asistencias": "assists", "Robos": "steals", "Tapones": "blocks",
            "Pérdidas": "turnovers", "Faltas": "fouls",
        }
        for side, venue in [("home", "Local"), ("away", "Visitante")]:
            actual = [row for row in exported if row["Sede"] == venue]
            players = sorted(box[side]["players"], key=lambda p: (-int(p["starter"]), -p["seconds"]))
            assert len(actual) == len(players)
            for row, player in zip(actual, players):
                assert row["Partido"] == detail["result"]["id"]
                assert row["Jugador"] == player_names.get(player["playerId"], player["playerId"])
                assert row["Titular"] == ("Sí" if player["starter"] else "No")
                assert int(row["Puntos local"]) == box["home"]["points"]
                assert int(row["Puntos visitante"]) == box["away"]["points"]
                assert all(int(row[column]) == player[field] for column, field in fields.items())
        expect(report.get_by_text("Acta exportada.", exact=True)).to_be_visible()
        print(f"PASS: {len(labels)} regulation periods, {extra} overtime periods")
    browser.close()
