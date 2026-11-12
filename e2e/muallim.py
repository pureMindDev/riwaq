"""Browser tests of the MUALLIM rules. Run against: ./e2e/run-stack.sh strict
Stack: real backend + MongoDB + MOCK provider + a TEST engine that "hears" /tmp/e2e-transcript.txt.
The test engine does not analyse audio; these tests verify the product's rules and wording, not recognition accuracy."""
import json
from common import *

V = lambda n: f"نَصٌّ تَجْرِيبِيٌّ لَيْسَ مِنَ الْقُرْآنِ رَقْم {n}"     # the mock provider's verse text
say = lambda text: open("/tmp/e2e-transcript.txt", "w", encoding="utf-8").write(text)
wrong_word = lambda text: text.replace("تَجْرِيبِيٌّ", "مُخْتَلِفٌ")
wrong_vowel = lambda text: text.replace("لَيْسَ", "لَيْسِ")
passage_text = lambda surah, a, b: " ".join(V(n) for n in range(a, b + 1))

def recite(page, transcript, button="Recite to the Muallim"):
    """Record ~1s with the fake microphone, then send it to the Muallim (the test engine returns `transcript`)."""
    say(transcript)
    page.get_by_role("button", name=re.compile("Start reciting")).first.click()
    page.wait_for_timeout(900)
    page.get_by_role("button", name="Stop", exact=True).click()
    page.get_by_label(re.compile("I understand my recording is sent")).first.check()
    page.get_by_role("button", name=button).first.click()

def api(page, method, path, body=None):
    return page.evaluate("""async ([m, p, b]) => {
        const r = await fetch('/api' + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('dt:token') }, body: b ? JSON.stringify(b) : undefined })
        return { status: r.status, body: await r.json().catch(() => null) } }""", [method, path, body])

def known(page, surah, to):
    page.goto(BASE + "/murajaah")
    page.locator("#rev-surah").select_option(str(surah)); page.locator("#rev-to").fill(str(to))
    page.get_by_role("button", name="Add to revision").click(); expect(page.get_by_text("Added.")).to_be_visible()

with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)

    def passage_earned(page, ctx):
        onboard(page, "ready", start_surah="1", verses=1)
        page.get_by_role("link", name=re.compile("Open: Test Surah A 1")).click()
        mark = page.get_by_role("button", name="Mark as memorised")
        expect(mark).to_be_disabled(); expect(page.get_by_text("This unlocks when the Muallim passes")).to_be_visible()
        recite(page, wrong_word(V(1)))                                  # 1) a wrong WORD is pointed out, directly
        fb = page.locator(".muallim-try_again")
        expect(fb).to_be_visible(); expect(fb.locator(".corrections li")).to_have_count(1)
        expect(fb.locator(".corrections li")).to_contain_text("Word 2")
        expect(fb.locator(".corrections li")).to_contain_text("you said «مُخْتَلِفٌ»")
        expect(mark).to_be_disabled()
        page.get_by_role("button", name="Recite again").click()
        recite(page, wrong_vowel(V(1)))                                 # 2) a wrong VOWEL names the letter and both vowels
        expect(page.locator(".corrections li").first).to_contain_text("on the letter س (Sīn) the vowel should be fatḥa, but you said kasra")
        expect(mark).to_be_disabled()
        page.get_by_role("button", name="Recite again").click()
        recite(page, "نَصٌّ تَجْرِيبِيٌّ")                                # 3) stopping early
        expect(page.locator(".corrections li").first).to_contain_text("You stopped before word 3")
        page.get_by_role("button", name="Recite again").click()
        recite(page, V(1))                                              # 4) correct
        expect(page.locator(".muallim-passed")).to_contain_text("Correct")
        expect(mark).to_be_enabled()
        mark.click()
        expect(page).to_have_url(re.compile(r"/$"))
        expect(page.locator("li.task").first).to_contain_text("Done")
        page.goto(BASE + "/tahfidh")
        expect(page.locator("li.passage", has_text="Test Surah A 1")).to_contain_text("Passed the Muallim")
    run("Passage is earned: wrong word, wrong vowel (letter named), early stop are each pointed out; only a correct recitation unlocks 'memorised'", passage_earned, browser)

    def unclear(page, ctx):
        onboard(page, "ready", start_surah="1", verses=1)
        page.get_by_role("link", name=re.compile("Open: Test Surah A 1")).click()
        recite(page, "مرحبا بكم في هذا البرنامج الجميل")
        expect(page.locator(".muallim-unclear")).to_contain_text("I could not follow your recitation")
        assert page.locator(".corrections li").count() == 0, "unclear audio must not produce accusations"
        expect(page.get_by_role("button", name="Mark as memorised")).to_be_disabled()
    run("Unclear audio: the Muallim says it could not follow, accuses nothing, and nothing unlocks", unclear, browser)

    def no_shortcuts(page, ctx):
        onboard(page, "ready", start_surah="1", verses=1)
        page.get_by_role("link", name=re.compile("Open: Test Surah A 1")).click()
        pid = page.url.rsplit("/", 1)[1]
        r = api(page, "POST", f"/tahfidh/passages/{pid}/memorised", {"selfDeclared": True})
        assert (r["status"], r["body"]["error"]["code"]) == (409, "MUALLIM_PASS_REQUIRED"), r
        recite(page, V(1)); expect(page.locator(".muallim-passed")).to_be_visible()
        page.get_by_role("button", name="Mark as memorised").click()
        expect(page).to_have_url(re.compile(r"/$"))                                   # wait until it is really memorised
        r = api(page, "POST", f"/murajaah/passages/{pid}/complete", {"rating": "easy"})
        assert (r["status"], r["body"]["error"]["code"]) == (409, "MUALLIM_REQUIRED"), r
        r = api(page, "POST", "/foundation/lessons/readalong/complete")
        assert r["status"] == 409, r
    run("No shortcuts: self-declaring, self-rating a revision and completing a lesson by request are all refused by the server", no_shortcuts, browser)

    def revision(page, ctx):
        onboard(page, "ready", start_surah="1")
        known(page, 1, 1)
        page.get_by_role("link", name="Start revising Test Surah A 1").click()
        assert page.get_by_role("radio").count() == 0, "no self-rating in strict mode"
        expect(page.get_by_role("button", name="Finish this revision")).to_have_count(0)
        recite(page, wrong_word(V(1)))
        expect(page.get_by_text("found 1 thing to correct")).to_be_visible()
        page.get_by_role("button", name="Finish this revision").click()
        expect(page.get_by_text("Session completed: Test Surah A 1")).to_be_visible()
        expect(page.locator("section", has=page.get_by_role("heading", name="Revision history"))).to_contain_text("Moderate")
        page.get_by_role("link", name="Revise now").click()
        recite(page, V(1))
        expect(page.get_by_text("counts as an easy revision")).to_be_visible()
        page.get_by_role("button", name="Finish this revision").click()
        expect(page.locator("section", has=page.get_by_role("heading", name="Revision history"))).to_contain_text("Easy")
    run("Revision is reciting: the Muallim's result decides moderate vs easy; no self-rating exists", revision, browser)

    def milestone(page, ctx):
        onboard(page, "ready", start_surah="1")
        known(page, 1, 3); known(page, 2, 10)
        page.get_by_role("link", name="Open Juz 1 milestone").click()
        text_for = lambda label: passage_text(1, 1, 3) if "Surah A" in label else passage_text(2, 1, 10)
        for done in range(2):
            expect(page.get_by_text(f"1. Revise this Juz ({done}/2)")).to_be_visible()
            row = page.locator("section", has=page.get_by_role("heading", name=re.compile("1. Revise this Juz"))).locator("li.task").filter(has=page.get_by_role("link", name=re.compile("^Revise "))).first
            label = row.locator("strong").inner_text()
            row.get_by_role("link").click(); recite(page, text_for(label))
            page.get_by_role("button", name="Finish this revision").click()
            expect(page.get_by_text("Session completed")).to_be_visible()
            page.goto(BASE + "/murajaah"); page.get_by_role("link", name="Open Juz 1 milestone").click()
        expect(page.get_by_text("1. Revise this Juz (2/2)")).to_be_visible()
        item = page.locator("section", has=page.get_by_role("heading", name=re.compile("2. Cumulative check"))).locator("section.card").first
        label = item.locator("h2").inner_text()
        recite(page, wrong_word(text_for(label)))                       # a mistake: the item is NOT passed
        expect(page.locator(".muallim-try_again")).to_be_visible()
        expect(page.get_by_text("Milestone complete.")).to_have_count(0)
        page.get_by_role("button", name="Recite again").click()
        recite(page, text_for(label))                                   # correct: passed
        expect(page.get_by_text("Milestone complete.")).to_be_visible()
    run("Juz milestone: revise each passage to the Muallim, then the cumulative check is passed only by a correct recitation", milestone, browser)

    def hafiz(page, ctx):
        register(page); assess(page, "hafiz"); page.get_by_role("button", name="Start", exact=True).click()
        page.get_by_label("Juz 1", exact=True).check(); page.get_by_role("button", name="Add to my revision").click()
        expect(page.get_by_text("Added 2 passages (13 verses)")).to_be_visible()
        page.goto(BASE)
        expect(page.locator("li.task")).to_have_count(2)
        page.get_by_role("link", name=re.compile("Start: Test Surah A 1–3")).click()
        recite(page, passage_text(1, 1, 3))
        page.get_by_role("button", name="Finish this revision").click()
        page.goto(BASE); expect(page.locator("li.task", has_text="Done")).to_have_count(1)
    run("Hafiz path: declared Ajza' are revised only by reciting them to the Muallim", hafiz, browser)

    browser.close()
report()
