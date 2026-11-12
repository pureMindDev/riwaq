"""Browser tests against the MOCK provider (placeholder text, not Qur'an).
Run: ./e2e/run-stack.sh  then  python3 e2e/journeys.py"""
import json, sys, re
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:5173"
results = []
def check(name, fn):
    try:
        fn(); results.append((name, True, ""))
    except Exception as e:
        results.append((name, False, str(e).splitlines()[0][:200]))

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"])
    ctx = browser.new_context(viewport={"width": 1100, "height": 900}, permissions=["microphone"])
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and (errors.append(" | ".join(str(a.json_value()) for a in m.args)), open("/tmp/err.txt","w").write("\n\n".join(errors))))

    def home():
        page.goto(BASE)
        expect(page.get_by_role("heading", name="Assalamu alaikum")).to_be_visible()
        expect(page.get_by_text("Getting started")).to_be_visible()
        for label, path in [("Tahfidh", "/tahfidh"), ("Muraja’ah", "/murajaah"), ("Listen & Practise", "/listen"), ("Home", "/")]:
            page.locator("nav.nav-top").get_by_role("link", name=label, exact=True).click()
            expect(page).to_have_url(re.compile(re.escape(path) + "$"))
    check("Home loads, onboarding shows, top nav works", home)

    def listen_list():
        page.goto(BASE + "/listen")
        expect(page.get_by_text("Test Surah A")).to_be_visible()
        expect(page.get_by_text("Test Surah B")).to_be_visible()
        page.get_by_label("Find a Surah").fill("surah b")
        expect(page.get_by_text("Test Surah A")).to_have_count(0)
        page.get_by_label("Find a Surah").fill("zzz")
        expect(page.get_by_text("No Surah matches")).to_be_visible()
    check("Surah list loads, search filters, empty search message", listen_list)

    def verses_rtl():
        page.goto(BASE + "/listen/1")
        first = page.locator(".quran-text").first
        expect(first).to_be_visible()
        info = first.evaluate("e => { const s = getComputedStyle(e); return {dir: s.direction, align: s.textAlign, ff: s.fontFamily, lh: parseFloat(s.lineHeight)/parseFloat(s.fontSize), lang: e.lang, tr: e.getAttribute('translate'), text: e.textContent} }")
        assert info["dir"] == "rtl" and info["lang"] == "ar" and info["tr"] == "no", info
        assert info["align"] in ("right", "start"), info
        assert info["lh"] >= 2, info
        assert "نَصٌّ" in info["text"]
        page.screenshot(path="/tmp/shot_listen_desktop.png")
    check("Arabic text renders RTL, lang=ar, translate=no, generous line height", verses_rtl)

    def audio_basic():
        page.goto(BASE + "/listen/1")
        expect(page.get_by_text("Test Surah A · verse 1")).to_be_visible()
        paused = page.evaluate("document.querySelector('audio').paused")
        assert paused is True, "audio must not autoplay"
        page.get_by_role("button", name="Play", exact=True).click()
        page.wait_for_function("(() => { const a = document.querySelector('audio'); return !a.paused && a.currentTime > 0.1 })()", timeout=5000)
        expect(page.get_by_role("button", name="Pause")).to_be_visible()
        page.get_by_role("button", name="Pause").click()
        page.wait_for_function("document.querySelector('audio').paused")
        page.get_by_role("button", name="Replay").click()
        page.wait_for_function("(() => { const a = document.querySelector('audio'); return !a.paused })()", timeout=3000)
    check("Audio: no autoplay; play, pause and replay work with real audio", audio_basic)

    def verse_nav():
        page.goto(BASE + "/listen/1")
        page.get_by_role("button", name="Next verse").click()
        expect(page.locator(".verse-active .verse-number")).to_have_text("2")
        page.get_by_role("button", name="Previous verse").click()
        expect(page.locator(".verse-active .verse-number")).to_have_text("1")
        expect(page.get_by_role("button", name="Previous verse")).to_be_disabled()
        page.locator(".verse").nth(2).click()
        expect(page.get_by_role("button", name="Next verse")).to_be_disabled()
    check("Verse navigation: prev/next/select and edge states", verse_nav)

    def repeat_and_advance():
        page.goto(BASE + "/listen/1")
        page.get_by_text("Repeat & options").click()
        page.get_by_label("Repeat each verse").select_option("3")
        page.get_by_role("button", name="Play", exact=True).click()
        page.wait_for_function("document.querySelector('.verse-active .verse-number').textContent === '2'", timeout=15000)
    check("Repeat 3× then auto-advance to the next verse", repeat_and_advance)

    def resume_position():
        page.goto(BASE + "/")
        expect(page.get_by_text("verse 2", exact=False).first).to_be_visible()
        page.get_by_role("link", name="Continue listening").click()
        expect(page.locator(".verse-active .verse-number")).to_have_text("2")
    check("Last listening position is saved and resumes", resume_position)

    def tahfidh_flow():
        page.goto(BASE + "/tahfidh")
        page.get_by_label("Surah").select_option("1")
        expect(page.get_by_label("To verse")).to_have_value("3")
        page.get_by_label("From verse").fill("1"); page.get_by_label("To verse").fill("2")
        page.get_by_role("button", name="Add passage").click()
        expect(page.get_by_text("Added.")).to_be_visible()
        expect(page.locator("li.passage h3")).to_have_text("Test Surah A 1–2")
        # overlap rejected
        page.get_by_label("From verse").fill("2"); page.get_by_label("To verse").fill("3")
        page.get_by_role("button", name="Add passage").click()
        expect(page.get_by_text("This overlaps Test Surah A 1–2")).to_be_visible()
        # invalid range rejected
        page.get_by_label("From verse").fill("3"); page.get_by_label("To verse").fill("99")
        page.get_by_role("button", name="Add passage").click()
        expect(page.get_by_text("This Surah has 3 verses.")).to_be_visible()
        # persisted across reload
        page.reload()
        expect(page.locator("li.passage h3")).to_have_text("Test Surah A 1–2")
        expect(page.locator("li.passage .chip-learning")).to_be_visible()
    check("Tahfidh: add passage, overlap + range validation, persists after reload", tahfidh_flow)

    def learn_and_memorise():
        page.goto(BASE + "/tahfidh")
        page.get_by_role("link", name="Start learning").click()
        expect(page.get_by_role("heading", name="Test Surah A 1–2")).to_be_visible()
        page.get_by_role("button", name="Hide the text (recite from memory)").click()
        expect(page.get_by_text("Verse 1 (hidden)")).to_be_visible()
        page.get_by_role("button", name="I studied this today").click()
        page.get_by_role("button", name="Mark as memorised").click()
        expect(page).to_have_url(re.compile(r"/tahfidh$"))
        expect(page.locator("li.passage .chip-memorised")).to_be_visible()
        assert page.locator("text=Verified").count() == 0 and page.locator("text=verified").count() == 0
        expect(page.get_by_text("verses recorded as memorised")).to_be_visible()
        expect(page.get_by_text("Memorisation history").locator("..").get_by_text("Test Surah A 1–2").first).to_be_visible()
    check("Tahfidh: learn view, hide text, log session, mark memorised (never 'verified')", learn_and_memorise)

    def murajaah_flow():
        page.goto(BASE + "/murajaah")
        # freshly memorised passage is due tomorrow -> not in today's list
        expect(page.get_by_text("Nothing is due today")).to_be_visible()
        page.locator("#rev-surah").select_option("2")
        page.locator("#rev-from").fill("1"); page.locator("#rev-to").fill("5")
        page.get_by_role("button", name="Add to revision").click()
        expect(page.get_by_text("Added.")).to_be_visible()
        expect(page.locator("li.task strong")).to_have_text("Test Surah B 1–5")
        expect(page.locator("li.task .chip-due")).to_be_visible()
        page.get_by_role("link", name="Start revising Test Surah B 1–5").click()
        expect(page.get_by_role("button", name="Complete session")).to_be_disabled()
        page.get_by_label("Difficult").check()
        page.get_by_role("button", name="Complete session").click()
        expect(page.get_by_text("Session completed: Test Surah B 1–5")).to_be_visible()
        expect(page.get_by_text("Nothing is due today")).to_be_visible()
        expect(page.get_by_text("Revision history").locator("..").get_by_text("Difficult")).to_be_visible()
        expect(page.locator("li.passage", has_text="Test Surah B 1–5").locator(".chip-needs")).to_be_visible()
        expect(page.locator("li.passage", has_text="Test Surah B 1–5").locator(".chip-stale")).to_have_count(0)
    check("Muraja'ah: add known passage, due today, revise, rate difficult, history, needs-practice flag", murajaah_flow)

    def adjust_due():
        page.goto(BASE + "/murajaah")
        card = page.locator("li.passage", has_text="Test Surah B 1–5")
        card.get_by_label("Next revision date").fill("2020-01-01")
        expect(page.locator("li.task strong")).to_have_text("Test Surah B 1–5")
        expect(page.locator("li.task .chip-overdue")).to_be_visible()
        page.reload()
        expect(page.locator("li.task .chip-overdue")).to_be_visible()
    check("Muraja'ah: learner can adjust the date; overdue is shown and persists", adjust_due)

    def dashboard():
        page.goto(BASE + "/")
        expect(page.get_by_text("Getting started")).to_have_count(0)
        expect(page.locator("#q-revise").locator("..").locator("li.task")).to_have_count(1)
        expect(page.get_by_text("verses recorded as memorised")).to_be_visible()
        expect(page.get_by_text("Recent activity")).to_be_visible()
    check("Dashboard reflects real saved data (revision task, summary, recent activity)", dashboard)

    def error_and_retry():
        state = {"fail": True}
        def handler(route):
            if state["fail"]:
                route.fulfill(status=503, content_type="application/json", body=json.dumps({"error": {"code": "PROVIDER_UNREACHABLE", "message": "x"}}))
            else:
                route.continue_()
        page.route("**/api/chapters/2/verses*", handler)
        page.goto(BASE + "/listen/2")
        expect(page.get_by_role("alert")).to_contain_text("isn't responding")
        state["fail"] = False
        page.get_by_role("button", name="Try again").click()
        expect(page.locator(".verse").first).to_be_visible()
        page.unroute("**/api/chapters/2/verses*")
    check("Error state shows a friendly message; Retry recovers", error_and_retry)

    def network_down():
        page.route("**/api/chapters", lambda r: r.abort())
        page.goto(BASE + "/listen")
        expect(page.get_by_role("alert")).to_contain_text("Could not reach the server")
        page.unroute("**/api/chapters")
    check("Network failure is reported clearly", network_down)

    def audio_failure():
        # The audio API points at a URL that really returns 404 (the mock provider has no such file).
        page.route("**/api/chapters/1/audio*", lambda r: r.fulfill(json={"reciterId": 901, "audio": [{"verseKey": f"1:{i}", "url": "http://localhost:4100/missing/file.wav"} for i in (1, 2, 3)]}))
        page.goto(BASE + "/listen/1")
        expect(page.get_by_text("could not be loaded")).to_be_visible()
        expect(page.get_by_role("button", name="Try again")).to_be_visible()
        page.get_by_role("button", name="Try again").click()
        expect(page.get_by_text("could not be loaded")).to_be_visible()
        expect(page.locator(".verse").first).to_be_visible()  # text remains readable
        page.unroute("**/api/chapters/1/audio*")
    check("Audio load failure shows a message and a retry button", audio_failure)

    def recite_unavailable():
        page.goto(BASE + "/recite")
        expect(page.get_by_text("Not available: no recognition service is connected")).to_be_visible()
        page.get_by_label(re.compile("Just record and listen back")).check()
        page.locator("#rec-surah").select_option("1")
        expect(page.locator(".reference .quran-text").first).to_be_visible()  # reference text is shown
        page.get_by_role("button", name="Start recording").click()
        expect(page.get_by_text("Recording…")).to_be_visible()
        page.wait_for_timeout(1200)
        page.get_by_role("button", name="Stop recording").click()
        expect(page.locator("audio[controls]")).to_be_visible()
        expect(page.get_by_role("button", name="Analyse my recitation")).to_have_count(0)
        assert page.get_by_text("Result").count() == 0
    check("Recitation Check: honest 'not available'; mic recording works; no fake analysis offered", recite_unavailable)

    def recite_mocked_engine():
        # TEST ONLY: network mocking to exercise the result UI; real engine results are not available.
        page.route("**/api/status", lambda r: r.fulfill(json={"quran": {"configured": True}, "recitation": {"available": True}}))
        unreliable = {"result": {"reliable": False, "reason": "low_overlap", "items": [{"index": 0, "reference": "كلمة", "status": "uncertain", "reason": "unreliable_recognition"}], "extras": [], "summary": {"correct": 0, "uncertain": 1, "omitted": 0, "substituted": 0, "notReached": 0, "repeated": 0, "extra": 0}}}
        page.route("**/api/recitation/analyze*", lambda r: r.fulfill(json=unreliable))
        page.goto(BASE + "/recite")
        page.locator("#rec-surah").select_option("1")
        page.get_by_label(re.compile(r"Recognition service \(after recording\)")).check()
        page.get_by_role("button", name="Start recording").click(); page.wait_for_timeout(1000)
        page.get_by_role("button", name="Stop recording").click()
        btn = page.get_by_role("button", name="Analyse my recitation")
        expect(btn).to_be_disabled()
        page.get_by_label(re.compile("I understand my recording")).check()
        btn.click()
        expect(page.get_by_text("nothing is marked as a mistake")).to_be_visible()
        expect(page.get_by_text("checked after recording")).to_be_visible()
        expect(page.get_by_text("does not check Tajweed")).to_be_visible()
        page.unroute("**/api/status"); page.unroute("**/api/recitation/analyze*")
    check("Recitation Check UI (mocked responses): consent gate, post-recording label, unreliable => no accusations", recite_mocked_engine)

    def settings_page():
        page.goto(BASE + "/settings")
        expect(page.get_by_text("only in this browser, on this device")).to_be_visible()
        page.get_by_label("Reference recitation").select_option(label="Mock Reciter (test tone)")
        with page.expect_download() as d:
            page.get_by_role("button", name="Export my data").click()
        data = json.load(open(d.value.path()))
        assert data["version"] == 1 and len(data["passages"]) == 2, data
        page.on("dialog", lambda dlg: dlg.accept())
        page.get_by_role("button", name="Delete all my data").click()
        page.goto(BASE + "/tahfidh")
        expect(page.get_by_text("Nothing recorded yet")).to_be_visible()
    check("Settings: reciter choice, data export contains saved data, delete all works", settings_page)

    def storage_blocked_banner():
        c2 = browser.new_context()
        c2.add_init_script("Object.defineProperty(window, 'localStorage', {get(){ throw new Error('blocked') }})")
        pg = c2.new_page(); pg.goto(BASE)
        expect(pg.get_by_role("alert").first).to_contain_text("blocking local storage")
        c2.close()
    check("Blocked browser storage is announced (progress not silently lost)", storage_blocked_banner)

    # ---- mobile ----
    mctx = browser.new_context(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True)
    m = mctx.new_page()
    def mobile():
        for path in ["/", "/tahfidh", "/murajaah", "/listen", "/listen/2", "/recite", "/settings"]:
            m.goto(BASE + path); m.wait_for_load_state("networkidle")
            sw = m.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
            assert sw[0] <= sw[1], f"horizontal overflow on {path}: {sw}"
        expect(m.locator("nav.nav-bottom")).to_be_visible()
        expect(m.locator("nav.nav-top")).to_be_hidden()
        m.goto(BASE + "/listen/1")
        expect(m.locator(".player-bar")).to_be_visible()
        small = m.evaluate("[...document.querySelectorAll('button, a.btn, select, input[type=checkbox]')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 40 && !e.classList.contains('btn-link') && !(e.type === 'checkbox' && e.closest('label'))).map(e => e.outerHTML.slice(0,80))")
        assert not small, small
        m.screenshot(path="/tmp/shot_listen_mobile.png")
        m.goto(BASE + "/"); m.screenshot(path="/tmp/shot_home_mobile.png")
    check("Mobile 375px: no horizontal overflow on any page, bottom nav, sticky player, tap targets ≥ 40px", mobile)

    check("No console/page errors during the whole run", lambda: (_ for _ in ()).throw(AssertionError(errors[0])) if errors else None)
    browser.close()

width = max(len(n) for n, _, _ in results)
for n, ok, msg in results:
    print(("PASS " if ok else "FAIL ") + n + ("" if ok else f"\n     -> {msg}"))
print(f"\n{sum(ok for _, ok, _ in results)}/{len(results)} passed")
sys.exit(0 if all(ok for _, ok, _ in results) else 1)
