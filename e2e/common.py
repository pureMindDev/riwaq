"""Shared helpers for the browser tests. Data comes from the MOCK provider (placeholder text, not Qur'an)."""
import os, re, sys, traceback, uuid
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:5173"
ARGS = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]
results = []

FAKE_SPEECH = """
(() => {
  class FakeSR { constructor() { this.results = []; window.__sr = this } start() { this.running = true } stop() { this.running = false; setTimeout(() => this.onend && this.onend(), 0) } abort() {} }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR
  window.__emit = (text, isFinal, conf = 0.9) => {
    const sr = window.__sr, last = sr.results[sr.results.length - 1]
    const r = { isFinal, 0: { transcript: text, confidence: isFinal ? conf : 0 }, length: 1 }
    let idx
    if (last && !last.isFinal) { sr.results[sr.results.length - 1] = r; idx = sr.results.length - 1 } else { sr.results.push(r); idx = sr.results.length - 1 }
    sr.onresult({ resultIndex: idx, results: sr.results })
  }
})()
"""

ONLY = os.environ.get("ONLY")

def run(name, fn, browser, viewport=None, **kw):
    if ONLY and ONLY.lower() not in name.lower():
        return
    ctx = browser.new_context(viewport=viewport or {"width": 1100, "height": 900}, permissions=["microphone"], **kw)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and errs.append(m.text[:300]))
    try:
        fn(page, ctx)
        if errs: raise AssertionError(f"console/page errors: {errs[:2]}")
        results.append((name, True, ""))
    except Exception as e:
        line = next((f"line {f.lineno}" for f in reversed(traceback.extract_tb(e.__traceback__)) if f.filename.endswith(("madrasa.py", "public.py", "muallim.py"))), "?")
        try: where = f" | url={page.url} | text={page.locator('main').inner_text()[:240]!r}"
        except Exception: where = ""
        results.append((name, False, f"{line}: {str(e).splitlines()[0][:200]}{where}"))
    ctx.close()

def report():
    for n, ok, msg in results:
        print(("PASS " if ok else "FAIL ") + n + ("" if ok else f"\n     -> {msg}"))
    print(f"\n{sum(ok for _, ok, _ in results)}/{len(results)} passed")
    sys.exit(0 if all(ok for _, ok, _ in results) else 1)

def email():
    return f"e2e-{uuid.uuid4().hex[:10]}@example.com"

def register(page, name="Aisha Test", mail=None, password="correct-horse-9"):
    mail = mail or email()
    page.goto(BASE + "/register")
    page.get_by_label("Your name").fill(name)
    page.get_by_label("Email").fill(mail)
    page.get_by_label("Password").fill(password)
    page.get_by_role("button", name="Create account").click()
    expect(page).to_have_url(re.compile(r"/welcome$"))
    return mail, password

ANSWERS = {
    "beginner": {"Can you recognise and read the letters": "No, I cannot yet", "Can you read Arabic words with the short vowel": "No", "Do you recognise how letters change shape": "No",
                 "Can you read the Qur’an from the mushaf": "No", "How much of the Qur’an have you memorised": "Nothing yet", "How much time can you give": "About 15 minutes"},
    "ready": {"Can you recognise and read the letters": "Yes, all of them", "Can you read Arabic words with the short vowel": "Yes, fairly smoothly", "Do you recognise how letters change shape": "Yes",
              "Can you read the Qur’an from the mushaf": "Yes, fluently", "How much of the Qur’an have you memorised": "Nothing yet", "How much time can you give": "About 30 minutes"},
}
ANSWERS["hafiz"] = {**ANSWERS["ready"], "How much of the Qur’an have you memorised": "All of it (Hafiz / Hafidah)"}

def assess(page, kind):
    for legend, option in ANSWERS[kind].items():
        page.locator("fieldset", has_text=legend).get_by_label(option, exact=True).check()
    page.get_by_role("button", name="See my suggestion").click()

def onboard(page, kind, start_surah="1", verses=None, direction="Towards the end"):
    """Register + assessment + accept. For tahfidh: begin in `start_surah`, going `direction`."""
    register(page)
    assess(page, kind)
    if kind == "ready":
        expect(page.get_by_role("heading", name=re.compile("Suggested: Tahfidh"))).to_be_visible()
        page.locator("#start-surah").select_option(start_surah)
        page.get_by_label(re.compile(direction)).check()
        if verses: page.locator("#nv").fill(str(verses))
    page.get_by_role("button", name="Start", exact=True).click()
    page.wait_for_url(re.compile(r"/(tahfidh)?$"))
