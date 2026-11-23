"""Passage check for hifz and muraja'ah, separate from the model so it can be tested without it.

The learner recites a passage (surah S, verses A to B). The model (Quran Muaalem) returns the phonemes it believes it heard.
We build the REFERENCE phonemes for the same passage from the bundled Uthmani text (package quran-transcript), compare the
two with the library's own error explainer, and turn the errors into one record per word of the passage.

Policy (set here, easy to change):
  * A word is WRONG when a letter or a vowel (harakah) is wrong, extra or missing. Wrong words block "passed".
  * A word that was not said at all is OMITTED; trailing omitted words are NOT_REACHED (the learner stopped early).
  * Tajweed-rule differences (madd length, ghunna, qalqala ...) are ADVICE and do not block, unless tajweed_blocks=True.
  * Each ayah is phonetised as if the reader STOPS at its end (the usual way a passage is recited when memorising). A reader
    who joins ayahs may be told about the ayah-end sounds; that is a known limit.

NOTHING HERE IS PROVEN ON REAL LEARNERS. The model's authors report a 75.8% Tajweed F1 on their own benchmark. Measure on
teacher-marked recordings before trusting it to gate progress.
"""
import bisect
import dataclasses
import difflib
import re

from quran_transcript import Aya, MoshafAttributes, QuranPhoneticScriptOutput, explain_error, quran_phonetizer
from quran_transcript.phonetics.conv_base_operation import MappingPos

MOSHAF = MoshafAttributes(rewaya="hafs", madd_monfasel_len=4, madd_mottasel_len=4, madd_mottasel_waqf=4, madd_aared_len=4)
MIN_SIMILARITY = 0.4  # below this the audio does not look like this passage at all: say so instead of accusing words
MAX_AYAT = 40
_LETTER = re.compile("[ء-يٱ]")


class BadPassage(ValueError):
    pass


def build_reference(surah: int, start: int, end: int) -> dict:
    """The reference for verses start..end of a surah: words, phonemes, and the data the model and error explainer need."""
    if not (1 <= surah <= 114):
        raise BadPassage("unknown surah")
    if start < 1 or end < start:
        raise BadPassage("the first verse must not come after the last verse")
    if end - start + 1 > MAX_AYAT:
        raise BadPassage(f"at most {MAX_AYAT} verses at a time")
    texts, phon, sifat, maps, word_aya = [], [], [], [], []
    offset = 0
    for aya in range(start, end + 1):
        try:
            text = Aya(surah, aya).get().uthmani
        except Exception as exc:  # the library raises for a verse the surah does not have
            raise BadPassage(f"surah {surah} has no verse {aya}") from exc
        r = quran_phonetizer(text, MOSHAF, remove_spaces=True, sura_idx=surah)
        if texts:  # the space that joins two verses
            maps.append(MappingPos(pos=(offset, offset), tajweed_rules=None, deleted=True))
        maps.extend(dataclasses.replace(m, pos=(m.pos[0] + offset, m.pos[1] + offset)) for m in r.mappings)
        texts.append(text)
        phon.append(r.phonemes)
        sifat.extend(r.sifat)
        word_aya.extend([aya] * len(text.split(" ")))
        offset += len(r.phonemes)
    uthmani = " ".join(texts)
    words = uthmani.split(" ")
    starts, c = [], 0
    for w in words:
        starts.append(c)
        c += len(w) + 1
    return {
        "surah": surah, "from": start, "to": end,
        "uthmani": uthmani, "words": words, "word_starts": starts, "word_aya": word_aya,
        "ref": QuranPhoneticScriptOutput(phonemes="".join(phon), sifat=sifat, mappings=maps),
    }


def _word_of(reference: dict, char_pos: int) -> int:
    return max(0, bisect.bisect_right(reference["word_starts"], char_pos) - 1)


def _advice(err) -> dict:
    rules = err.ref_tajweed_rules or err.missing_tajweed_rules or err.replaced_tajweed_rules or err.inserted_tajweed_rules or []
    name = None
    for r in rules:
        try:
            name = r.name.en
            break
        except AttributeError:
            continue
    if err.expected_len is not None and err.predicted_len is not None:
        msg = f"{name or 'This sound'}: hold it for {err.expected_len} counts (you held it for {err.predicted_len})."
    else:
        msg = f"{name or 'A Tajweed rule'}: not said as the rule requires here."
    return {"rule": name, "message": msg}


def judge_passage(reference: dict, predicted: str, tajweed_blocks: bool = False) -> dict:
    """Compare predicted phonemes with the reference; one record per word. Pure function (no model)."""
    words = reference["words"]
    recs = [{"index": i, "aya": reference["word_aya"][i], "text": w, "status": "ok", "problems": [], "advice": []} for i, w in enumerate(words)]
    ref_ph = reference["ref"].phonemes
    out = {"words": recs, "reliable": True, "reason": None, "similarity": 0.0}
    predicted = (predicted or "").replace(" ", "")
    if not predicted:
        out.update(reliable=False, reason="no_speech")
        return out
    out["similarity"] = round(difflib.SequenceMatcher(None, ref_ph, predicted, autojunk=False).ratio(), 3)
    if out["similarity"] < MIN_SIMILARITY:
        out.update(reliable=False, reason="too_little_match")
        return out

    deletes = [0] * len(words)
    for e in explain_error(reference["uthmani"], ref_ph, predicted, reference["ref"].mappings):
        w = _word_of(reference, e.uthmani_pos[0])
        span = reference["uthmani"][e.uthmani_pos[0]:e.uthmani_pos[1]]
        r = recs[w]
        if e.error_type == "tajweed":
            item = _advice(e)
            (r["problems"] if tajweed_blocks else r["advice"]).append(
                {"kind": "tajweed", "span": span, **item} if tajweed_blocks else item)
            continue
        kind = {"delete": "missing", "insert": "extra", "replace": "different"}[e.speech_error_type]
        if e.error_type == "tashkeel":
            kind = "vowel"
        if kind == "missing":
            deletes[w] += 1
        r["problems"].append({"kind": kind, "span": span, "expected": e.expected_ph, "heard": e.preditected_ph})

    for r in recs:
        if r["problems"]:
            r["status"] = "wrong"
    # A word is OMITTED when most of the letters it actually pronounces were reported missing and nothing else is wrong with it.
    maps = reference["ref"].mappings
    bounds = reference["word_starts"] + [len(reference["uthmani"]) + 1]
    for i, r in enumerate(recs):
        units = sum(1 for k in range(bounds[i], min(bounds[i + 1] - 1, len(maps)))
                    if not maps[k].deleted and _LETTER.match(reference["uthmani"][k]))
        if units and deletes[i] >= max(1, round(units * 0.6)) and all(p["kind"] == "missing" for p in r["problems"]):
            r["status"] = "omitted"
    # Omitted words running to the end of the passage mean the learner stopped early.
    i = len(recs) - 1
    while i >= 0 and recs[i]["status"] == "omitted":
        recs[i]["status"] = "not_reached"
        i -= 1
    return out
