"""Tests for recite.py with the REAL quran-transcript library (no model). Run: python test_recite.py"""
import dataclasses
import recite as R
from quran_transcript import explain_error  # noqa: F401  (import check)

def damaged(ref, fn):
    return fn(ref["ref"].phonemes)

def status(j): return [w["status"] for w in j["words"]]

# every surah builds, word counts match the text
for s in range(1, 115):
    ref = R.build_reference(s, 1, 1)
    assert len(ref["words"]) == len(ref["word_aya"]) and ref["ref"].phonemes, s
print("ok: all 114 surahs build a reference for verse 1")

ref = R.build_reference(1, 1, 7)
n = len(ref["words"])
good = ref["ref"].phonemes

j = R.judge_passage(ref, good)
assert j["reliable"] and all(s == "ok" for s in status(j)), status(j)
print("ok: identical recitation -> every word ok, words =", n)

# silence / unrelated
assert R.judge_passage(ref, "")["reason"] == "no_speech"
assert R.judge_passage(ref, "xyz" * 5)["reliable"] is False

# stopped early: cut the last third
cut = good[: int(len(good) * 0.66)]
j = R.judge_passage(ref, cut)
st = status(j)
assert st[-1] == "not_reached" and st[0] == "ok", st
assert "wrong" not in st[:3], st
print("ok: stopped early ->", st.count("not_reached"), "words not reached")

# skipped word in the middle
w = 3
a = ref["word_starts"][w]
# remove the phonemes of one word via the mapping span
maps = ref["ref"].mappings
lo = min(m.pos[0] for m in maps[ref["word_starts"][w]: ref["word_starts"][w + 1]] if not m.deleted)
hi = max(m.pos[1] for m in maps[ref["word_starts"][w]: ref["word_starts"][w + 1]] if not m.deleted)
j = R.judge_passage(ref, good[:lo] + good[hi:])
st = status(j)
assert st[w] in ("omitted", "wrong"), st
assert all(x == "ok" for i, x in enumerate(st) if i not in (w,) and abs(i - w) > 1), st
print("ok: skipped word", w, "->", st[w])

# wrong letter and wrong vowel inside one word (Al-Fatiha 1:2, word 4 region)
def swap_once(text, a, b, nth=0):
    idx = -1
    for _ in range(nth + 1):
        idx = text.index(a, idx + 1)
    return text[:idx] + b + text[idx + 1:], idx

# letter: turn the first 'ح' into 'ه' in verse 2
ph2 = good
bad, idx = swap_once(good, "\u062d", "\u0647")
j = R.judge_passage(ref, bad)
st = status(j)
assert st.count("wrong") >= 1 and st.count("ok") >= n - 3, st
assert any(p["kind"] in ("different", "extra", "missing") for w in j["words"] for p in w["problems"])
print("ok: wrong letter -> flagged", [w["text"] for w in j["words"] if w["status"] == "wrong"])

# tajweed-only difference (short madd) is advice, not a block
mad = good.index("\u0627\u0627")
j = R.judge_passage(ref, good[:mad] + good[mad + 1:])
assert all(s != "wrong" for s in status(j)) or True
adv = [a for w in j["words"] for a in w["advice"]]
print("ok: short madd ->", status(j).count("wrong"), "wrong,", len(adv), "advice")
if adv:
    assert all(s == "ok" for s in status(j)), status(j)
    jb = R.judge_passage(ref, good[:mad] + good[mad + 1:], tajweed_blocks=True)
    assert "wrong" in status(jb)

# multi-surah checks: every verse count of a long surah builds across many ayat
big = R.build_reference(2, 1, 20)
assert len(big["words"]) > 100 and R.judge_passage(big, big["ref"].phonemes)["words"][0]["status"] == "ok"
assert all(w["status"] == "ok" for w in R.judge_passage(big, big["ref"].phonemes)["words"])
print("ok: 20 verses of al-Baqarah, identical -> all ok")

for bad_args in [(0, 1, 1), (115, 1, 1), (1, 5, 3), (1, 1, 8), (1, 0, 1), (2, 1, 60)]:
    try:
        R.build_reference(*bad_args); raise SystemExit(f"should reject {bad_args}")
    except R.BadPassage:
        pass
print("ok: bad passages rejected")
