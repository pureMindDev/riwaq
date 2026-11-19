"""Tests for the logic around the model. They do NOT run the model. Run: python test_letters.py"""
from types import SimpleNamespace as NS
import letters as L

C = L.consonant_set()
ids = list(L.LETTER_CHARS)
assert len(ids) == 28 and len(set(ids)) == 28

# every letter builds a reference with letter + fatha, one sifa group, and a distinct expected phoneme
exp = [L.expected_phoneme(L.reference_for(c)) for c in ids]
assert all(exp) and len(set(exp)) == 28, "28 distinct expected phonemes"
assert exp[0] == "ء", "alif is taught as hamza + fatha"
for c in ids[1:]:
    assert L.expected_phoneme(L.reference_for(c)) == c, c  # consonant letters keep their own symbol

def sifa(**kw):
    base = dict(hams_or_jahr=None, shidda_or_rakhawa=None, tafkheem_or_taqeeq=None, itbaq=None, safeer=None, qalqla=None, ghonna=None)
    base.update({k: NS(text=t, prob=p) for k, (t, p) in kw.items()})
    return NS(**base)

ba, ta, sad, sin = (L.reference_for(c) for c in "بتصس")
# right letter, nothing confident to coach -> match
assert L.judge(ba, "بڇ", sifa(), C)["result"] == "match"
# a different letter -> miss, and we say what was heard
r = L.judge(ba, "ت", sifa(), C); assert (r["result"], r["heard"], r["expected"]) == ("miss", "ت", "ب")
# alif said as ta -> miss
assert L.judge(L.reference_for("ا"), "ت", sifa(), C)["result"] == "miss"
assert L.judge(L.reference_for("ا"), "ء", sifa(), C)["result"] == "match"
# nothing heard / only vowels
assert L.judge(ba, "", sifa(), C)["result"] == "none" and L.judge(ba, "َ", sifa(), C)["result"] == "none"
assert L.judge(ba, "ب", sifa(), C, speech_ok=False)["result"] == "none"
# sad said light (like sin) -> right phoneme but confident heavy/itbaq hints -> fix
r = L.judge(sad, "ص", sifa(tafkheem_or_taqeeq=("moraqaq", 0.95), itbaq=("monfateh", 0.9)), C)
assert r["result"] == "fix" and {h["feature"] for h in r["hints"]} == {"tafkheem_or_taqeeq", "itbaq"}, r
# the same hints with low confidence are ignored
assert L.judge(sad, "ص", sifa(tafkheem_or_taqeeq=("moraqaq", 0.5)), C)["result"] == "match"
# hints can be switched from blocking to advice-only
assert L.judge(sad, "ص", sifa(tafkheem_or_taqeeq=("moraqaq", 0.95)), C, block_on_hints=False)["result"] == "match"
# agreeing sifat -> no hints
assert L.judge(sad, "ص", sifa(tafkheem_or_taqeeq=("mofakham", 0.99)), C)["hints"] == []
# bad inputs
try: L.target_text("a"); raise SystemExit("should reject")
except ValueError: pass
print("ok: 28 references, judge rules")
