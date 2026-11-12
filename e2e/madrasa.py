"""Browser tests of the madrasa journey (accounts, assessment, foundation, Tahfidh, Muraja'ah, milestones, Hafiz).
Real backend + real MongoDB + MOCK Qur'an provider (placeholder text). Recognition results are FAKED where noted."""
import json, re
from common import *

NAMES = {"ا": "Alif", "ب": "Bā’", "ت": "Tā’", "ث": "Thā’", "ج": "Jīm", "ح": "Ḥā’", "خ": "Khā’"}
today_task = lambda page: page.locator("section", has=page.get_by_role("heading", name="Today’s plan")).locator("li.task")

def answer_quiz(page, correct=True):
    for fs in page.locator("form[aria-labelledby='quiz-h'] fieldset").all():
        right = NAMES[fs.locator(".arabic-big").inner_text().strip()]
        labels = [l.inner_text().strip() for l in fs.locator("label").all()]
        pick = right if correct else next(l for l in labels if l != right)
        fs.get_by_label(pick, exact=True).check()
    page.get_by_role("button", name="Check my answers").click()

with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)

    def foundation(page, ctx):
        onboard(page, "beginner")
        expect(today_task(page)).to_have_count(1)
        expect(today_task(page).first).to_contain_text("Letters 1")
        page.get_by_role("link", name=re.compile("Start lesson: Letters 1")).click()
        expect(page.locator(".letter-card")).to_have_count(7)
        assert "\u200d" in page.locator(".letter-card").nth(1).locator(".forms").inner_text(), "joined forms are drawn by the browser (ZWJ)"
        expect(page.get_by_role("button", name="Complete lesson")).to_be_disabled()
        answer_quiz(page, correct=False)
        expect(page.get_by_text("Review the lesson and try again")).to_be_visible()
        expect(page.get_by_role("button", name="Complete lesson")).to_be_disabled()
        answer_quiz(page, correct=True)
        expect(page.get_by_text("Well done: 7 of 7 correct.")).to_be_visible()
        page.get_by_role("button", name="Complete lesson").click()
        expect(page.get_by_text("Lesson complete.")).to_be_visible()
        page.goto(BASE); expect(today_task(page).first).to_contain_text("Done")
        page.goto(BASE + "/tahfidh")
        expect(page.get_by_role("heading", name="Foundation reading")).to_be_visible()
        expect(page.get_by_text("1 of 11 lessons complete.")).to_be_visible()
        items = page.locator("ol.lesson-list li")
        expect(items.nth(1).get_by_role("link")).to_be_visible()       # lesson 2 unlocked
        expect(items.nth(2).get_by_role("link")).to_have_count(0)      # lesson 3 still locked
        expect(items.nth(2)).to_contain_text("Locked")
        page.goto(BASE + "/foundation/letters-3")
        expect(page.get_by_role("alert")).to_contain_text("Finish the earlier lessons first")
    run("Foundation: assessment → lessons, joined letter forms, server-graded quiz (fail, then pass), sequential unlocking", foundation, browser)

    def accounts(page, ctx):
        mail, pw = register(page, name="Yusuf Ali")
        assess(page, "beginner"); page.get_by_role("button", name="Start", exact=True).click()
        expect(page.get_by_role("heading", name=re.compile("Assalamu alaikum, Yusuf"))).to_be_visible()
        page.reload(); expect(page.get_by_role("heading", name=re.compile("Assalamu alaikum, Yusuf"))).to_be_visible()  # session survives a refresh
        page.goto(BASE + "/settings"); page.get_by_role("button", name="Sign out").click()
        expect(page.get_by_role("link", name="Create a free account")).to_be_visible()
        page.goto(BASE + "/tahfidh"); expect(page).to_have_url(re.compile("/login$"))
        page.get_by_label("Email").fill(mail); page.get_by_label("Password").fill("wrong-password-1"); page.get_by_role("button", name="Sign in").click()
        expect(page.get_by_role("alert").filter(has_text="Email or password is incorrect.")).to_be_visible()
        page.get_by_label("Password").fill(pw); page.get_by_role("button", name="Sign in").click()
        expect(page).to_have_url(re.compile("/tahfidh$"))                       # returned to where we were going
        expect(page.get_by_role("heading", name="Foundation reading")).to_be_visible()
        page.goto(BASE + "/register")
        expect(page).not_to_have_url(re.compile("/register$"))                  # signed-in users are not asked to register again
    run("Accounts: register, session survives refresh, sign out, guarded redirect, wrong password, sign back in", accounts, browser)

    def duplicate(page, ctx):
        mail, _ = register(page)
        page.context.clear_cookies(); page.evaluate("localStorage.clear()")
        page.goto(BASE + "/register")
        page.get_by_label("Your name").fill("Dup"); page.get_by_label("Email").fill(mail.upper()); page.get_by_label("Password").fill("another-pass-1")
        page.get_by_role("button", name="Create account").click()
        expect(page.get_by_role("alert").filter(has_text="already exists")).to_be_visible()
        page.get_by_label("Email").fill("not-an-email"); page.get_by_label("Password").fill("short")
        assert page.get_by_label("Password").evaluate("e => e.validity.tooShort || e.validity.valueMissing || !e.checkValidity()")
    run("Registration: duplicate emails are refused (case-insensitive) and the password minimum is enforced", duplicate, browser)

    def tahfidh_day(page, ctx):
        onboard(page, "ready", start_surah="1", verses=2)
        expect(today_task(page)).to_have_count(1)
        expect(today_task(page).first).to_contain_text("Test Surah A 1–2")
        page.get_by_role("link", name=re.compile("Open: Test Surah A 1–2")).click()
        expect(page.get_by_role("heading", name="Test Surah A 1–2")).to_be_visible()
        page.get_by_role("button", name="Hide the text (recite from memory)").click()
        expect(page.get_by_text("Verse 1 (hidden)")).to_be_visible()
        page.get_by_role("button", name="Log a study session").click()
        expect(page.get_by_text("Session recorded.")).to_be_visible()
        page.locator(".verse").nth(1).click()
        page.wait_for_timeout(600)                                                   # position is saved to the account
        page.goto(BASE + "/tahfidh")
        page.get_by_role("link", name="Continue from verse 2").click()
        expect(page.locator(".verse-active .verse-number")).to_have_text("2")
        expect(page.get_by_text("The Muallim is not available yet")).to_be_visible()   # no engine connected: honest, and the step cannot be passed
        mark = page.get_by_role("button", name="Mark as memorised")
        expect(mark).to_be_disabled()                                                 # nothing passed yet
        page.get_by_label(re.compile("Development mode only")).check()               # the developer-only switch is on in this stack
        mark.click()
        expect(page).to_have_url(re.compile(r"/$"))
        expect(today_task(page).first).to_contain_text("Done")
        page.goto(BASE + "/tahfidh")
        card = page.locator("li.passage", has_text="Test Surah A 1–2")
        expect(card.locator(".chip-memorised")).to_be_visible()
        expect(card).to_contain_text("Self-declared")
        expect(page.locator(".chip", has_text=re.compile(r"^Verified$"))).to_have_count(0)   # nothing is ever labelled verified
        expect(page.locator("section", has=page.get_by_role("heading", name="Surahs you have covered")).locator("progress")).to_have_attribute("max", "3")
        expect(page.get_by_text("2 verses recorded as memorised", exact=False)).to_be_visible()
    run("Tahfidh day (dev stack, no engine): assigned passage, session, saved position, honest 'Muallim unavailable', coverage", tahfidh_day, browser)

    def revision(page, ctx):
        onboard(page, "ready", start_surah="1")
        page.goto(BASE + "/murajaah")
        expect(page.get_by_text("Nothing is due today")).to_have_count(0)
        page.locator("#rev-surah").select_option("2"); page.locator("#rev-to").fill("5")
        page.get_by_role("button", name="Add to revision").click(); expect(page.get_by_text("Added.")).to_be_visible()
        page.locator("#rev-from").fill("1"); page.locator("#rev-to").fill("5")
        page.get_by_role("button", name="Add to revision").click()
        expect(page.get_by_text("overlaps")).to_be_visible()                          # no duplicate records
        row = page.locator("section", has=page.get_by_role("heading", name="Today’s revision")).locator("li.task")
        expect(row).to_contain_text("Test Surah B 1–5"); expect(row.locator(".chip-due")).to_be_visible()
        page.get_by_role("link", name="Start revising Test Surah B 1–5").click()
        expect(page.get_by_text("The Muallim is not available yet")).to_be_visible()
        page.get_by_text("Development mode: finish without the Muallim").click()
        expect(page.get_by_role("button", name="Complete (dev)")).to_be_disabled()
        page.get_by_role("radio", name="Difficult").check(); page.get_by_role("button", name="Complete (dev)").click()
        expect(page.get_by_text("Session completed: Test Surah B 1–5")).to_be_visible()
        expect(page.get_by_text("Nothing is due today")).to_be_visible()
        expect(page.locator("section", has=page.get_by_role("heading", name="Revision history"))).to_contain_text("Difficult")
        mem = page.locator("li.passage", has_text="Test Surah B 1–5")
        expect(mem.locator(".chip-needs")).to_be_visible()
        mem.get_by_label("Next revision date").fill("2020-01-01")                    # the learner can move the date
        expect(row.locator(".chip-overdue")).to_be_visible()
        page.goto(BASE); expect(page.locator(".overdue-badge")).to_contain_text("1 overdue")
        expect(today_task(page).filter(has_text="Revise")).to_have_count(1)           # revision appears in today's plan
    run("Muraja'ah: add known passage, no duplicates, rate difficult, history, needs-practice flag, adjust date → overdue, plan", revision, browser)

    def hafiz(page, ctx):
        register(page); assess(page, "hafiz")
        expect(page.get_by_role("heading", name=re.compile("Suggested: Muraja’ah only"))).to_be_visible()
        page.get_by_role("button", name="Start", exact=True).click()
        expect(page).to_have_url(re.compile("/tahfidh$"))
        expect(page.get_by_text("Record what you have memorised")).to_be_visible()
        page.get_by_label("Juz 1", exact=True).check(); page.get_by_label("Juz 2", exact=True).check()
        page.get_by_role("button", name="Add to my revision").click()
        expect(page.get_by_text("Added 3 passages (63 verses)")).to_be_visible()
        expect(page.get_by_text("not verified", exact=False).first).to_be_visible()
        expect(page.locator("li.passage").first).to_contain_text("Declared (not yet recited)")
        expect(page.get_by_role("heading", name="Add a passage")).to_have_count(0)    # no new-memorisation tools for the Muraja'ah-only programme
        page.goto(BASE)
        expect(today_task(page)).to_have_count(3)
        assert today_task(page).filter(has_text="Memorise").count() == 0
        page.get_by_role("link", name=re.compile("Start: Test Surah A 1–3")).click()
        page.get_by_text("Development mode: finish without the Muallim").click()
        page.get_by_role("radio", name="Easy").check(); page.get_by_role("button", name="Complete (dev)").click()
        page.goto(BASE); expect(today_task(page).filter(has_text="Done")).to_have_count(1)
        page.goto(BASE + "/murajaah"); expect(page.get_by_text("When you complete a whole Juz")).to_be_visible()   # declared Ajza' spawn no milestones
    run("Hafiz path: Muraja'ah-only programme, declare Ajza' (unverified), daily rotation with no new memorisation, no milestones", hafiz, browser)

    def isolation(page, ctx):
        onboard(page, "ready", start_surah="1", verses=2)
        href = page.get_by_role("link", name=re.compile("Open: Test Surah A")).get_attribute("href")
        other = ctx.browser.new_context(viewport={"width": 1100, "height": 900}); b = other.new_page()
        onboard(b, "ready", start_surah="1", verses=2)
        expect(b.locator("li.task")).to_have_count(1)                                    # B's own passage is created by B's plan
        b.goto(BASE + href)
        expect(b.get_by_role("alert")).to_contain_text("Passage not found")
        b.goto(BASE + "/tahfidh")
        expect(b.locator("li.passage")).to_have_count(1)                                # B has only B's own assigned passage
        expect(b.locator("li.passage h3")).to_have_text("Test Surah A 1–2")
        assert href not in (b.get_by_role("link", name=re.compile("Start learning|Continue")).first.get_attribute("href") or "")
        other.close()
    run("Isolation: a second learner cannot open the first learner's passage and sees only their own", isolation, browser)

    def settings(page, ctx):
        mail, pw = register(page); assess(page, "beginner"); page.get_by_role("button", name="Start", exact=True).click()
        page.goto(BASE + "/settings")
        page.get_by_label("Tahfidh (memorisation with revision)").check()
        page.locator("#ss").select_option("1"); page.get_by_label(re.compile("Towards the end")).check(); page.locator("#nv").fill("2")
        page.get_by_role("button", name="Save", exact=True).click()
        expect(page.get_by_text("Saved. Today’s plan updates")).to_be_visible()
        page.goto(BASE); expect(today_task(page).first).to_contain_text("Test Surah A 1–2")
        page.locator("a", has_text="Settings").first.click()
        page.get_by_label("Muraja’ah only (for Hafiz / Hafidah)").check(); page.get_by_role("button", name="Save", exact=True).click()
        page.goto(BASE); expect(page.get_by_text("Tell us what you have memorised")).to_be_visible()   # plan re-made for the new programme
        page.goto(BASE + "/settings")
        page.on("dialog", lambda d: d.accept())
        page.get_by_role("button", name="Delete my account and data").click()
        expect(page.get_by_role("link", name="Create a free account")).to_be_visible()
        page.goto(BASE + "/login"); page.get_by_label("Email").fill(mail); page.get_by_label("Password").fill(pw); page.get_by_role("button", name="Sign in").click()
        expect(page.get_by_role("alert").filter(has_text="Email or password is incorrect.")).to_be_visible()
    run("Settings: change programme and targets (plan re-made), delete account removes access", settings, browser)

    def mobile_ready(page, ctx):
        onboard(page, "ready", start_surah="1")
        for path in ["/", "/tahfidh", "/murajaah", "/settings", "/listen/1"]:
            page.goto(BASE + path); page.wait_for_load_state("networkidle")
            sw = page.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
            assert sw[0] <= sw[1], f"horizontal overflow on {path}: {sw}"
        page.goto(BASE); page.screenshot(path="/tmp/shot_home_mobile.png")
        bad = page.evaluate("[...document.querySelectorAll('button, a.btn, select')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 40 && !e.classList.contains('btn-link')).map(e => e.outerHTML.slice(0, 80))")
        assert not bad, bad
    run("Mobile 375px (Tahfidh learner): no overflow on Home, Tahfidh, Muraja'ah, Settings; tap targets ≥ 40px", mobile_ready, browser, viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True)

    def mobile_foundation(page, ctx):
        register(page)
        sw = page.evaluate("[document.documentElement.scrollWidth, window.innerWidth]"); assert sw[0] <= sw[1], f"welcome overflow {sw}"
        page.screenshot(path="/tmp/shot_welcome_mobile.png")
        assess(page, "beginner"); page.get_by_role("button", name="Start", exact=True).click()
        for path in ["/", "/tahfidh", "/foundation/letters-1"]:
            page.goto(BASE + path); page.wait_for_load_state("networkidle")
            sw = page.evaluate("[document.documentElement.scrollWidth, window.innerWidth]"); assert sw[0] <= sw[1], f"overflow on {path}: {sw}"
        page.screenshot(path="/tmp/shot_lesson_mobile.png", full_page=False)
    run("Mobile 375px (foundation learner): no overflow on assessment, lessons and quiz", mobile_foundation, browser, viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True)

    browser.close()
report()
