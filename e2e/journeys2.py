"""More browser tests (fresh browser context per test). Mock provider data only.
SpeechRecognition and the analyze endpoint are FAKED here to exercise the UI logic; real recognition
accuracy is NOT tested (it needs a real engine and internet)."""
import json, re, sys, wave, struct, math, tempfile, os
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:5173"
results = []
FAKE_SPEECH = """
(() => {
  class FakeSR {
    constructor() { this.results = []; window.__sr = this }
    start() { this.running = true }
    stop() { this.running = false; setTimeout(() => this.onend && this.onend(), 0) }
    abort() {}
  }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR
  window.__emit = (text, isFinal, conf = 0.9) => {
    const sr = window.__sr, last = sr.results[sr.results.length - 1]
    const r = { isFinal, 0: { transcript: text, confidence: isFinal ? conf : 0 }, length: 1 }
    let idx
    if (last && !last.isFinal) { sr.results[sr.results.length - 1] = r; idx = sr.results.length - 1 }
    else { sr.results.push(r); idx = sr.results.length - 1 }
    sr.onresult({ resultIndex: idx, results: sr.results })
  }
})()
"""

def make_wav(path):
    with wave.open(path, "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000)
        w.writeframes(b"".join(struct.pack("<h", int(3000 * math.sin(2 * math.pi * 440 * i / 8000))) for i in range(8000)))

def run(name, fn, browser, **ctx_kw):
    ctx = browser.new_context(viewport={"width": 1100, "height": 900}, permissions=["microphone"], **ctx_kw)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    try:
        fn(page, ctx)
        if errs: raise AssertionError(f"page errors: {errs[:2]}")
        results.append((name, True, ""))
    except Exception as e:
        results.append((name, False, str(e).splitlines()[0][:220]))
    ctx.close()

def add_passage(page, surah, frm, to, status="learning"):
    page.goto(BASE + "/tahfidh")
    page.locator("#add-surah").select_option(str(surah))
    page.get_by_label("From verse").fill(str(frm)); page.get_by_label("To verse").fill(str(to))
    if status == "memorised":
        page.get_by_label("I have already memorised it").check()
    page.get_by_role("button", name="Add passage").click()
    expect(page.get_by_text("Added.")).to_be_visible()

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])

    def status_coverage_resume(page, ctx):
        add_passage(page, 2, 1, 5)
        cov = page.locator("section", has=page.get_by_role("heading", name="Surahs you have covered"))
        expect(cov).to_contain_text("Test Surah B")
        expect(cov).to_contain_text("5 verses learning")
        expect(cov.locator("progress")).to_have_attribute("max", "60")
        page.get_by_role("link", name="Start learning").click()
        expect(page.get_by_text("Listen to a verse a few times", exact=False)).to_be_visible()
        page.locator(".verse").nth(2).click()
        page.go_back()
        expect(page.get_by_role("link", name="Continue from verse 3")).to_be_visible()
        page.get_by_role("link", name="Continue from verse 3").click()
        expect(page.locator(".verse-active .verse-number")).to_have_text("3")  # resumes where you stopped
        page.go_back()
        sel = page.locator("li.passage select")
        sel.select_option("memorised")
        expect(cov).to_contain_text("5 verses memorised")
        expect(page.locator("li.passage .chip-memorised")).to_be_visible()
        sel.select_option("needs_review")
        expect(page.locator("li.passage .chip-needs")).to_be_visible()
        sel.select_option("learning")
        expect(page.locator("li.passage .chip-learning")).to_be_visible()
        assert page.locator("li.passage").count() == 1  # never duplicated
    run("Tahfidh: status selector, Surah coverage from real data, per-passage resume, no duplicates", status_coverage_resume, browser)

    def dashboard_next(page, ctx):
        page.goto(BASE)
        expect(page.get_by_role("link", name="Choose your first passage")).to_be_visible()
        add_passage(page, 1, 1, 2)
        page.goto(BASE)
        expect(page.get_by_role("link", name="Continue memorisation")).to_be_visible()
        add_passage(page, 2, 1, 5, "memorised")
        page.goto(BASE)
        expect(page.get_by_role("link", name="Start today’s revision")).to_be_visible()
        expect(page.get_by_text("1 passage to revise")).to_be_visible()
        assert page.locator("ul.week li").count() == 7
        page.get_by_role("link", name="Start today’s revision").click()
        expect(page.get_by_role("button", name="Complete session")).to_be_visible()
        page.get_by_label("Easy").check(); page.get_by_role("button", name="Complete session").click()
        page.goto(BASE)
        assert page.locator("ul.week li strong").last.inner_text() == "1"  # today's session counted from real data
        expect(page.get_by_role("link", name="Start today’s revision")).to_have_count(0)
    run("Dashboard: next action changes with real data; 7-day strip counts real sessions", dashboard_next, browser)

    def import_export(page, ctx):
        add_passage(page, 2, 1, 5, "memorised")
        page.goto(BASE + "/settings")
        with page.expect_download() as d:
            page.get_by_role("button", name="Export my data").click()
        path = d.value.path()
        page.on("dialog", lambda dlg: dlg.accept())
        page.get_by_role("button", name="Delete all my data").click()
        page.goto(BASE + "/tahfidh"); expect(page.get_by_text("Nothing recorded yet")).to_be_visible()
        page.goto(BASE + "/settings")
        page.get_by_label("Restore from a backup file").set_input_files(path)
        expect(page.get_by_text("Imported 1 passages")).to_be_visible()
        page.goto(BASE + "/murajaah"); expect(page.locator("li.task strong")).to_have_text("Test Surah B 1–5")
        bad = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False); bad.write('{"version":1,"passages":[{"id":"x"}],"sessions":[]}'); bad.close()
        page.goto(BASE + "/settings")
        page.get_by_label("Restore from a backup file").set_input_files(bad.name)
        expect(page.get_by_text("not valid")).to_be_visible()
        page.goto(BASE + "/murajaah"); expect(page.locator("li.task strong")).to_have_text("Test Surah B 1–5")  # untouched
    run("Settings: export → delete → import restores data; invalid backup refused, data untouched", import_export, browser)

    def corrupt_storage(page, ctx):
        page.goto(BASE)
        page.evaluate("localStorage.setItem('digital-tahfidh:v1', '{broken')")
        page.reload()
        expect(page.get_by_role("alert").first).to_contain_text("could not be read")
        assert page.evaluate("localStorage.getItem('digital-tahfidh:v1:unreadable-backup')") == "{broken"
        add_passage(page, 1, 1, 2)  # app keeps working
    run("Corrupted saved data: warned, backed up, app keeps working", corrupt_storage, browser)

    def direct_routes(page, ctx):
        for path, text in [("/listen/1", "Test Surah A"), ("/tahfidh", "Your memorisation"), ("/murajaah", "Today’s revision"),
                           ("/murajaah/revise/nope", "Passage not found"), ("/tahfidh/nope", "Passage not found"),
                           ("/listen/999", "Surah not found"), ("/recite", "Recitation Check"), ("/settings", "Reciter"), ("/nope", "Page not found")]:
            page.goto(BASE + path)
            expect(page.get_by_text(text, exact=False).first).to_be_visible()
    run("Direct loads of every route (incl. unknown ids) render correctly", direct_routes, browser)

    def listen_reciter(page, ctx):
        page.goto(BASE + "/listen/1")
        expect(page.get_by_label("Reciter")).to_have_value("901")
        expect(page.get_by_text("Text: Uthmani script")).to_be_visible()
        expect(page.get_by_text("Quran.Foundation").first).to_be_visible()
        page.get_by_role("button", name="Next verse").click(); page.get_by_role("button", name="Next verse").click()
        page.get_by_role("button", name="Back to first verse").click()
        expect(page.locator(".verse-active .verse-number")).to_have_text("1")
        vp = page.viewport_size["height"]; bar = page.locator(".player").bounding_box()
        assert bar["height"] < 0.2 * vp, f"player too tall: {bar['height']}px"
    run("Listen: reciter picker, script/attribution shown, back-to-first, compact player (<20% of screen)", listen_reciter, browser)

    def upload_server_engine(page, ctx):
        wav = os.path.join(tempfile.gettempdir(), "t.wav"); make_wav(wav)
        page.route("**/api/status", lambda r: r.fulfill(json={"quran": {"configured": True}, "recitation": {"available": True, "validated": False}}))
        seen = {}
        def analyze(route):
            seen["ct"] = route.request.headers.get("content-type"); seen["len"] = len(route.request.post_data_buffer or b"")
            items = [{"index": i, "reference": w, "status": "correct", "heard": w} for i, w in enumerate(["نص", "تجريبي"])]
            items.append({"index": 2, "reference": "ليس", "status": "uncertain", "heard": "ليش", "reason": "unvalidated_engine"})
            route.fulfill(json={"result": {"reliable": True, "items": items, "extras": [{"afterIndex": 2, "heard": "كلمة", "status": "uncertain"}],
                                           "summary": {"correct": 2, "uncertain": 2, "omitted": 0, "substituted": 0, "notReached": 0, "repeated": 0, "extra": 0}}})
        page.route("**/api/recitation/analyze*", analyze)
        page.goto(BASE + "/recite")
        expect(page.get_by_label("Or upload a recording (audio file, up to 10 MB)")).to_be_disabled()  # needs a passage first
        page.locator("#rec-surah").select_option("1")
        page.get_by_label(re.compile(r"Recognition service \(after recording\)")).check()
        page.get_by_label("Or upload a recording (audio file, up to 10 MB)").set_input_files(wav)
        expect(page.locator("audio[controls]")).to_be_visible()
        page.get_by_label(re.compile("I understand my recording will be sent")).check()
        page.get_by_role("button", name="Analyse my recitation").click()
        expect(page.get_by_text("Where the recording differs from the text")).to_be_visible()
        expect(page.get_by_text("not yet been checked against qualified")).to_be_visible()
        assert seen["ct"].startswith("audio/") and seen["len"] > 1000, seen
        page.get_by_role("button", name="Discard and retry").click()
        expect(page.get_by_text("Result (checked after recording)")).to_have_count(0)
        big = os.path.join(tempfile.gettempdir(), "big.wav"); open(big, "wb").write(b"0" * (11 * 1024 * 1024))
        page.get_by_label("Or upload a recording (audio file, up to 10 MB)").set_input_files(big)
        expect(page.get_by_text("larger than 10 MB")).to_be_visible()
    run("Recitation Check (analyze endpoint FAKED): upload → consent → analysis shown with 'not validated' notice; size limit; retry", upload_server_engine, browser)

    def browser_engine_live(page, ctx):
        page.add_init_script(FAKE_SPEECH)  # TEST ONLY fake SpeechRecognition
        page.goto(BASE + "/recite")
        page.locator("#rec-surah").select_option("1")   # reference: 3 placeholder verses, 6 words each
        page.get_by_label(re.compile("Browser speech recognition")).check()
        start = page.get_by_role("button", name="Start recording")
        expect(start).to_be_disabled()  # consent first
        page.get_by_label(re.compile("my browser may send my voice")).check()
        start.click()
        expect(page.get_by_text("Listening…")).to_be_visible()
        page.evaluate("window.__emit('نص تجريبي ليس', false)")
        expect(page.locator(".word-followed")).to_have_count(3)      # live follow-along
        assert page.locator(".word-omitted, .word-substituted").count() == 0  # no accusations while live
        page.evaluate("window.__emit('نص تجريبي ليس', true)")
        page.evaluate("window.__emit('من القرآن رقم', true)")
        expect(page.locator(".word-followed")).to_have_count(6)
        page.get_by_role("button", name="Stop recording").click()
        res = page.locator("section", has=page.get_by_role("heading", name="Result (checked after recording)"))
        expect(res).to_be_visible()
        expect(res.locator(".legend")).to_contain_text("Matched 6")
        expect(res.locator(".legend")).to_contain_text("Not reached 12")
        expect(res).to_contain_text("ordinary Arabic")
        expect(page.locator("audio[controls]")).to_be_visible()      # can listen back
        # second attempt with a wrong word: engine is unvalidated, so it must be "unsure", never "possibly different"
        page.get_by_role("button", name="Discard and retry").click()
        page.get_by_role("button", name="Start recording").click()
        expect(page.get_by_text("Listening…")).to_be_visible()
        page.evaluate("window.__emit('نص مختلف ليس من القرآن رقم', true)")
        page.get_by_role("button", name="Stop recording").click()
        expect(res).to_contain_text("heard:")
        expect(res.locator(".analysis .word-uncertain")).to_have_count(1)
        assert page.locator(".word-substituted, .word-omitted").count() == 0
        expect(res).not_to_contain_text("possibly different")
    run("Recitation Check browser engine (SpeechRecognition FAKED): consent gate, live follow, post-stop analysis, conservative 'unsure'", browser_engine_live, browser)

    def speech_error(page, ctx):
        page.add_init_script(FAKE_SPEECH)
        page.goto(BASE + "/recite")
        page.locator("#rec-surah").select_option("1")
        page.get_by_label(re.compile("Browser speech recognition")).check()
        page.get_by_label(re.compile("my browser may send my voice")).check()
        page.get_by_role("button", name="Start recording").click()
        expect(page.get_by_text("Listening…")).to_be_visible()
        page.evaluate("window.__sr.onerror({error: 'network'})")
        expect(page.get_by_role("alert").filter(has_text="internet connection")).to_be_visible()
        page.get_by_role("button", name="Stop recording").click()
        expect(page.get_by_text("Result (checked after recording)")).to_have_count(0)  # no fake result after an engine failure
    run("Recitation Check: engine failure is reported and produces no fake result", speech_error, browser)

    def mic_denied(page, ctx):
        page.add_init_script("navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('x'), {name: 'NotAllowedError'}))")
        page.goto(BASE + "/recite")
        page.locator("#rec-surah").select_option("1")
        page.get_by_label(re.compile("Just record and listen back")).check()
        page.get_by_role("button", name="Start recording").click()
        expect(page.get_by_text("Microphone permission was denied")).to_be_visible()
    run("Microphone permission denied is explained (mic only requested after pressing Start)", mic_denied, browser)

    def mic_not_requested_early(page, ctx):
        page.add_init_script("window.__gum = 0; const o = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = (...a) => { window.__gum++; return o(...a) }")
        page.goto(BASE + "/recite"); page.locator("#rec-surah").select_option("1")
        page.wait_for_timeout(500)
        assert page.evaluate("window.__gum") == 0
    run("Microphone is not requested on page load or when choosing a passage", mic_not_requested_early, browser)

    browser.close()

for n, ok, msg in results:
    print(("PASS " if ok else "FAIL ") + n + ("" if ok else f"\n     -> {msg}"))
print(f"\n{sum(ok for _, ok, _ in results)}/{len(results)} passed")
sys.exit(0 if all(ok for _, ok, _ in results) else 1)
