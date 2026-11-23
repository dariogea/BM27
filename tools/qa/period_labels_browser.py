"""Verify that actual two-half and four-quarter games use the correct labels."""
import os
from playwright.sync_api import expect, sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("BM27_CHROMIUM", "/usr/bin/chromium"),
        args=["--no-sandbox", "--no-zygote", "--single-process", "--disable-dev-shm-usage"],
    )
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page.add_init_script("""
        const OriginalWorker = Worker;
        window.Worker = class extends OriginalWorker {
            constructor(...args) {
                super(...args);
                this.addEventListener('message', ({data}) => {
                    if (data.type === 'matchDetail') window.matchDetail = data.detail;
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
        print(f"PASS: {len(labels)} regulation periods, {extra} overtime periods")
    browser.close()
