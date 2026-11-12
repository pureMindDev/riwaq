"""Browser tests for the public pages (no account): Listen & Practise and Recitation Check. MOCK provider data."""
import json, re
from common import *

with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)

    def landing(page, ctx):
        page.goto(BASE)
        expect(page.get_by_role("heading", name="Assalamu alaikum")).to_be_visible()
        expect(page.get_by_text("How it works")).to_be_visible()
        expect(page.get_by_role("link", name="Create a free account")).to_be_visible()
        for path in ["/tahfidh", "/murajaah", "/settings", "/foundation/letters-1", "/milestones/abc"]:
            page.goto(BASE + path)
            expect(page).to_have_url(re.compile("/login$"))   # accounts are required for personal pages
        page.goto(BASE + "/listen"); expect(page.get_by_text("Test Surah A")).to_be_visible()  # listening needs no account
    run("Landing page; personal pages redirect to sign-in; Listen needs no account", landing, browser)

    def listen_list(page, ctx):
        page.goto(BASE + "/listen")
        expect(page.get_by_text("Test Surah B")).to_be_visible()
        page.get_by_label("Find a Surah").fill("surah b")
        expect(page.get_by_text("Test Surah A")).to_have_count(0)
        page.get_by_label("Find a Surah").fill("zzz")
        expect(page.get_by_text("No Surah matches")).to_be_visible()
    run("Surah list loads, search filters, empty search message", listen_list, browser)

    def verses_rtl(page, ctx):
        page.goto(BASE + "/listen/1")
        first = page.locator(".quran-text").first
        expect(first).to_be_visible()
        info = first.evaluate("e => { const s = getComputedStyle(e); return {dir: s.direction, align: s.textAlign, lh: parseFloat(s.lineHeight)/parseFloat(s.fontSize), lang: e.lang, tr: e.getAttribute('translate'), text: e.textContent} }")
        assert info["dir"] == "rtl" and info["lang"] == "ar" and info["tr"] == "no", info
        assert info["align"] in ("right", "start") and info["lh"] >= 2 and "نَصٌّ" in info["text"], info
    run("Arabic text renders RTL, lang=ar, translate=no, generous line height", verses_rtl, browser)

    def audio_basic(page, ctx):
        page.goto(BASE + "/listen/1")
        expect(page.get_by_text("Test Surah A · verse 1")).to_be_visible()
        assert page.evaluate("document.querySelector('audio').paused") is True, "must not autoplay"
        page.get_by_role("button", name="Play", exact=True).click()
        page.wait_for_function("(() => { const a = document.querySelector('audio'); return !a.paused && a.currentTime > 0.1 })()", timeout=5000)
        page.get_by_role("button", name="Pause").click()
        page.wait_for_function("document.querySelector('audio').paused")
        page.get_by_role("button", name="Replay").click()
        page.wait_for_function("!document.querySelector('audio').paused", timeout=3000)
    run("Audio: no autoplay; play, pause and replay work with real audio", audio_basic, browser)

    def nav_repeat_resume(page, ctx):
        page.goto(BASE + "/listen/1")
        page.get_by_role("button", name="Next verse").click()
        expect(page.locator(".verse-active .verse-number")).to_have_text("2")
        page.get_by_role("button", name="Previous verse").click()
        expect(page.get_by_role("button", name="Previous verse")).to_be_disabled()
        page.locator(".verse").nth(2).click()
        expect(page.get_by_role("button", name="Next verse")).to_be_disabled()
        page.locator(".verse").nth(0).click()
        page.get_by_text("Repeat & options").click()
        page.get_by_label("Repeat each verse").select_option("3")
        page.get_by_role("button", name="Play", exact=True).click()
        page.wait_for_function("document.querySelector('.verse-active .verse-number').textContent === '2'", timeout=15000)
        page.goto(BASE + "/listen")
        expect(page.get_by_text("Continue where you left off")).to_be_visible()
        page.get_by_role("link", name="Continue", exact=True).click()
        expect(page.locator(".verse-active .verse-number")).to_have_text("2")
    run("Verse navigation, repeat 3× then auto-advance, and resuming the last position", nav_repeat_resume, browser)

    def compact_player(page, ctx):
        page.goto(BASE + "/listen/1")
        expect(page.get_by_label("Reciter")).to_have_value("901")
        expect(page.get_by_text("Text: Uthmani script")).to_be_visible()
        expect(page.get_by_text("Quran.Foundation").first).to_be_visible()
        page.get_by_role("button", name="Next verse").click(); page.get_by_role("button", name="Next verse").click()
        page.get_by_role("button", name="Back to first verse").click()
        expect(page.locator(".verse-active .verse-number")).to_have_text("1")
        assert page.locator(".player").bounding_box()["height"] < 0.2 * page.viewport_size["height"]
    run("Reciter picker, script and attribution shown, compact player (<20% of screen)", compact_player, browser)

    def errors(page, ctx):
        state = {"fail": True}
        def h(route):
            if state["fail"]: route.fulfill(status=503, content_type="application/json", body=json.dumps({"error": {"code": "PROVIDER_UNREACHABLE", "message": "x"}}))
            else: route.continue_()
        page.route("**/api/chapters/2/verses*", h)
        page.goto(BASE + "/listen/2")
        expect(page.get_by_role("alert")).to_contain_text("isn't responding")
        state["fail"] = False
        page.get_by_role("button", name="Try again").click()
        expect(page.locator(".verse").first).to_be_visible()
        page.unroute("**/api/chapters/2/verses*")
        page.route("**/api/chapters", lambda r: r.abort())
        page.goto(BASE + "/listen")
        expect(page.get_by_role("alert")).to_contain_text("Could not reach the server")
        page.unroute("**/api/chapters")
        page.route("**/api/chapters/1/audio*", lambda r: r.fulfill(json={"reciterId": 901, "audio": [{"verseKey": f"1:{i}", "url": "http://localhost:4100/missing/f.wav"} for i in (1, 2, 3)]}))
        page.goto(BASE + "/listen/1")
        expect(page.get_by_text("could not be loaded")).to_be_visible()
        expect(page.locator(".verse").first).to_be_visible()  # text stays readable
    run("Provider error + retry, network failure, and audio load failure are all reported", errors, browser)

    def recite_guest(page, ctx):
        page.goto(BASE + "/recite")
        expect(page.get_by_text("Not available: no recognition service is connected")).to_be_visible()
        page.get_by_label(re.compile("Just record and listen back")).check()
        page.locator("#rec-surah").select_option("1")
        expect(page.locator(".reference .quran-text").first).to_be_visible()
        page.get_by_role("button", name="Start recording").click()
        expect(page.get_by_text("Recording…")).to_be_visible(); page.wait_for_timeout(1000)
        page.get_by_role("button", name="Stop recording").click()
        expect(page.locator("audio[controls]")).to_be_visible()
        assert page.get_by_role("button", name="Analyse my recitation").count() == 0
    run("Recitation Check (guest): honest 'not available', reference text, record + playback only", recite_guest, browser)

    def recite_live(page, ctx):
        page.add_init_script(FAKE_SPEECH)  # TEST ONLY fake SpeechRecognition
        page.goto(BASE + "/recite")
        page.locator("#rec-surah").select_option("1")
        page.get_by_label(re.compile("Browser speech recognition")).check()
        start = page.get_by_role("button", name="Start recording")
        expect(start).to_be_disabled()
        page.get_by_label(re.compile("my browser may send my voice")).check()
        start.click()
        expect(page.get_by_text("Listening…")).to_be_visible()
        page.evaluate("window.__emit('نص تجريبي ليس', false)")
        expect(page.locator(".word-followed")).to_have_count(3)
        page.evaluate("window.__emit('نص تجريبي ليس', true)"); page.evaluate("window.__emit('من القرآن رقم', true)")
        page.get_by_role("button", name="Stop recording").click()
        res = page.locator("section", has=page.get_by_role("heading", name="Result (checked after recording)"))
        expect(res.locator(".legend")).to_contain_text("Matched 6")
        page.get_by_role("button", name="Discard and retry").click()
        page.get_by_role("button", name="Start recording").click()
        expect(page.get_by_text("Listening…")).to_be_visible()
        page.evaluate("window.__emit('نص مختلف ليس من القرآن رقم', true)")
        page.get_by_role("button", name="Stop recording").click()
        expect(res.locator(".analysis .word-uncertain")).to_have_count(1)
        assert page.locator(".word-substituted, .word-omitted").count() == 0   # unvalidated engine: never an accusation
        page.get_by_role("button", name="Discard and retry").click(); page.get_by_role("button", name="Start recording").click()
        expect(page.get_by_text("Listening…")).to_be_visible()
        page.evaluate("window.__sr.onerror({error: 'network'})")
        expect(page.get_by_role("alert").filter(has_text="internet connection")).to_be_visible()
    run("Browser live follow-along (SpeechRecognition FAKED): consent gate, live words, conservative result, engine error", recite_live, browser)

    def mic(page, ctx):
        page.add_init_script("window.__gum = 0; const o = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = (...a) => { window.__gum++; return window.__deny ? Promise.reject(Object.assign(new Error('x'), {name: 'NotAllowedError'})) : o(...a) }")
        page.goto(BASE + "/recite"); page.locator("#rec-surah").select_option("1"); page.wait_for_timeout(400)
        assert page.evaluate("window.__gum") == 0, "microphone must not be requested before pressing Start"
        page.get_by_label(re.compile("Just record and listen back")).check()
        page.evaluate("window.__deny = true")
        page.get_by_role("button", name="Start recording").click()
        expect(page.get_by_text("Microphone permission was denied")).to_be_visible()
    run("Microphone is requested only on Start; a denial is explained", mic, browser)

    def routes(page, ctx):
        for path, text in [("/listen/1", "Test Surah A"), ("/listen/999", "Surah not found"), ("/recite", "Recitation Check"), ("/login", "Sign in"), ("/register", "Create your account"), ("/nope", "Page not found")]:
            page.goto(BASE + path); expect(page.get_by_text(text, exact=False).first).to_be_visible()
    run("Direct loads of public routes", routes, browser)

    def mobile(page, ctx):
        for path in ["/", "/login", "/register", "/listen", "/listen/2", "/recite"]:
            page.goto(BASE + path); page.wait_for_load_state("networkidle")
            sw = page.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
            assert sw[0] <= sw[1], f"horizontal overflow on {path}: {sw}"
        expect(page.locator("nav.nav-bottom")).to_be_visible(); expect(page.locator("nav.nav-top")).to_be_hidden()
    run("Mobile 375px: no horizontal overflow on public pages; bottom navigation", mobile, browser, viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True)

    browser.close()
report()
