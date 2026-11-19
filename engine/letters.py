"""Letter-check logic for Riwaq, separate from the model so it can be tested without it.

The model (Quran Muaalem) hears audio and returns the phonemes it believes were said, plus the sifat
(articulation qualities: heavy/light, breathy/voiced, ...) of each. Here we build the reference for one
letter (the letter with fatha, Tajweed/Qaida style) and compare.

NOTHING HERE IS PROVEN ON REAL LEARNERS. Measure it with evaluate.py before trusting it.
"""
from quran_transcript import MoshafAttributes, quran_phonetizer

FATHA = "َ"
HAMZA_FATHA = "أ" + FATHA
LETTER_CHARS = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي"  # the 28 letters, in alphabet order

_MOSHAF = MoshafAttributes(rewaya="hafs", madd_monfasel_len=4, madd_mottasel_len=4, madd_mottasel_waqf=4, madd_aared_len=4)

# Which sifat we are willing to coach on, with a plain-language message for each expected value.
HINTS = {
    "tafkheem_or_taqeeq": {
        "mofakham": "This letter is heavy (tafkhīm): say it with a full, deep mouth.",
        "moraqaq": "This letter is light (tarqīq): keep the mouth light and thin.",
    },
    "itbaq": {
        "motbaq": "Press the tongue up against the palate (iṭbāq).",
        "monfateh": "Keep the tongue open, without pressing up to the palate.",
    },
    "hams_or_jahr": {
        "hams": "Let a breath of air flow with this letter (hams).",
        "jahr": "Voice the letter fully, with no airy breath (jahr).",
    },
    "shidda_or_rakhawa": {
        "shadeed": "Stop the sound firmly at the articulation point (shiddah).",
        "rikhw": "Let the sound flow, without stopping it (rakhāwah).",
        "between": "The sound is between stopping and flowing (tawassuṭ).",
    },
    "safeer": {
        "safeer": "This letter has a whistling sound (ṣafīr).",
        "no_safeer": "No whistling sound with this letter.",
    },
    "qalqla": {
        "moqalqal": "Let the letter bounce slightly (qalqalah).",
        "not_moqalqal": "No bounce with this letter.",
    },
    "ghonna": {
        "maghnoon": "Add the nasal sound (ghunna).",
        "not_maghnoon": "No nasal sound with this letter.",
    },
}
MIN_HINT_PROB = 0.8  # only coach when the model is fairly sure about its own reading


def target_text(char: str) -> str:
    """The Tajweed-style target for a letter: letter + fatha (alif is hamza + fatha)."""
    if char not in LETTER_CHARS:
        raise ValueError("unknown letter")
    return HAMZA_FATHA if char == "ا" else char + FATHA


def reference_for(char: str):
    return quran_phonetizer(target_text(char), _MOSHAF, remove_spaces=True)


def expected_phoneme(ref) -> str:
    return ref.phonemes[0]


def consonant_set() -> set[str]:
    return {expected_phoneme(reference_for(c)) for c in LETTER_CHARS}


def first_consonant(predicted: str, consonants: set[str]) -> str:
    for ch in predicted or "":
        if ch in consonants:
            return ch
    return ""


def judge(ref, predicted_text: str, predicted_sifa, consonants: set[str], block_on_hints: bool = True, speech_ok: bool = True) -> dict:
    """result: 'none' (no speech/letter heard), 'miss' (a different letter), 'match' (right letter),
    'fix' (right letter, but a confident articulation note) - 'fix' counts as not yet correct when block_on_hints."""
    expected = expected_phoneme(ref)
    if not speech_ok:
        return {"result": "none", "expected": expected, "heard": "", "hints": []}
    heard = first_consonant(predicted_text, consonants)
    if not heard:
        return {"result": "none", "expected": expected, "heard": "", "hints": []}
    if heard != expected:
        return {"result": "miss", "expected": expected, "heard": heard, "hints": []}
    hints = []
    ref_sifa = ref.sifat[0]
    for feature, messages in HINTS.items():
        want = getattr(ref_sifa, feature, None)
        got = getattr(predicted_sifa, feature, None) if predicted_sifa is not None else None
        if want is None or got is None:
            continue
        if got.text != want and got.prob >= MIN_HINT_PROB and want in messages:
            hints.append({"feature": feature, "expected": want, "heard": got.text, "message": messages[want]})
    return {"result": "fix" if (hints and block_on_hints) else "match", "expected": expected, "heard": heard, "hints": hints}
