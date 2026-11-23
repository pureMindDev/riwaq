# Recitation Check and the Muallim: status, findings and test plan

## What is real today (read this first; last verified 2026-11-12)
Four different things are easy to confuse. Only the last one can ever give Qur'an-specific word feedback, and it is **not connected** in this project.

| # | What | What it actually is | State |
|---|---|---|---|
| 1 | **Recorded audio playback** (Listen & Practise, "Just record and listen back", reference recitation) | Plays audio. Nothing is analysed or judged. Reference recitation comes from the Quran Foundation API (not yet run against the live API). | Works (tested with the mock provider only) |
| 2 | **Browser speech recognition** (Recite page, "live follow-along") | The browser's built-in Web Speech API. It recognises **ordinary Arabic**, was not trained on Qur'an recitation, may send the voice to Google/Microsoft, and its accuracy on recitation has **not been measured**. It is labelled experimental, differences are shown only as "unsure", and it is **never** used to pass or fail anything. | Works as a rough practice aid. Not reliable Qur'anic correction. |
| 3 | **Letter-name audio** (Foundation letter cards) | Plays recordings listed in `frontend/public/audio/letters/manifest.json`. No recordings are bundled and speech synthesis is deliberately not used. | Button appears only for letters with a recording. None supplied yet. |
| 4 | **Qur'an-specific recitation recognition** (the Muallim) | A server-side engine you supply through `RECITATION_ENGINE_URL`. This is the only path that gates progress (memorised, revision, milestones, last foundation lesson). | **Not connected.** Until it is, the Muallim says "not available yet" and those steps cannot be passed. |

When an engine **is** connected but `RECITATION_ENGINE_VALIDATED` is not `true`, the Muallim screen shows an "Experimental" notice. Note that the validation flag only softens the Recite practice page (everything becomes "unsure"); the Muallim still states its corrections directly and still gates progress, so **do not connect an engine to real learners before the validation below has been done.**

**Not provided anywhere in the app:** Tajweed rules, makhraj (articulation) checking, pronunciation scoring, or live mistake correction. The Muallim compares words, letters and vowel marks in the engine's transcript with the reference text. It does not listen to how a letter is pronounced.

### What accurate word-level feedback needs (integration checklist)
1. A recognition engine that is trained or fine-tuned for Qur'an recitation and returns, per word, the text it heard **with vowel marks (tashkeel)** and, ideally, a confidence. A plain-text engine cannot reveal vowel mistakes, and the Muallim will not invent them.
2. A small service wrapping it to the contract in "Engine contract" below, reachable at `RECITATION_ENGINE_URL` (check the model's licence: at least one candidate is non-commercial only).
3. `node --env-file=.env scripts/check-engine.js <surah> <from> <to> <reciterId>` against the real Quran Foundation API (needs credentials) to see that studio audio matches almost entirely.
4. The teacher-marked test on real learner phone recordings (see "Smallest feasible experiment"), and the release gate: false accusations on correct words must be very rare before `RECITATION_ENGINE_VALIDATED=true` is set.
5. Privacy text in Settings updated if the engine is a third-party hosted service. Recordings are processed in memory only and never stored by this app.

## How the Muallim works
The product's teacher is software. After a student recites, `backend/utils/recitation/muallim.js` turns the engine's transcript into direct corrections (word, letter, vowel, skipped, repeated, stopped early). Passing requires **zero** corrections. Progress (memorised, revision rating, milestones, the last foundation lesson) depends on that verdict.

It can only be as good as the engine:
- To say *"the vowel should be kasra, you said fatha"* the engine must return vowel marks (tashkeel) for what it heard.
- To say *"the 4th letter should be ح, you said ء"* it must transcribe the letters it heard faithfully, not auto-correct to the nearest dictionary word.
- Many general speech models do neither. **Before launching, test your chosen engine** with `scripts/check-engine.js` and with real recordings that contain deliberate mistakes, and confirm the corrections it produces are right.
- A wrong correction is worse than none. If tests show the engine cannot hear vowels, do not claim vowel checking.

## The Muallim
The server-side engine is now the "Muallim": it answers with direct corrections (`backend/utils/recitation/muallim.js`) and gates progress. It does not use the conservative "unsure" wording; when it cannot follow the audio it says so and accuses nothing. Its corrections are only as good as the engine's transcript:
- **Wrong word / skipped / extra:** need a transcript with the words heard.
- **Wrong letter:** needs the transcript to contain the letters actually said (e.g. ح vs ء).
- **Wrong vowel:** needs a transcript WITH vowel marks. Plain text cannot reveal vowel mistakes, and the Muallim will not claim them.
Choose and validate an engine that outputs fully vowelled text, then test it with `scripts/check-engine.js` and real learner recordings before relying on it. The browser engine on the Recitation Check page remains a general-Arabic practice tool and stays cautious.

## Status
Three ways to use the page, in increasing order of what you must set up:

1. **Record / upload and listen back.** Works now. Nothing is analysed.
2. **Browser speech recognition (live follow-along).** Works with no setup in browsers that have the Web Speech API (Chrome, Edge, Safari). It recognises *ordinary* Arabic, is not trained for Qur'an recitation, and the browser may send your voice to its vendor (Google/Microsoft). While you recite, words it recognises are highlighted. Mistake checking runs only after you press Stop, and every difference is shown only as "unsure". **Not measured:** we have not tested its real accuracy on recitation. Only the page logic was tested, with a fake SpeechRecognition object.
3. **Server recognition engine (analysis after recording).** Needs you to run a Qur'an-capable model behind the contract below and set `RECITATION_ENGINE_URL`. Supports uploads. `docs/engine-example/server.py` is an UNTESTED starting point.

Not live: nothing here is real-time mistake correction, and nothing judges Tajweed.

**Why the feasibility experiment was not run here:** the build environment could not reach model hosts (Hugging Face) or the Quran Foundation API, had no GPU, and had no learner recordings.

## Conservative mode and validation
`RECITATION_ENGINE_VALIDATED` defaults to `false`. While false, every difference (skipped, different, extra, repeated) is shown only as "unsure". Set it to `true` only after the release gate below has been met.

## Check an engine with real reference audio
Once an engine and Quran Foundation credentials are configured:
```
cd backend
node --env-file=.env scripts/check-engine.js 1 1 7 <reciterId>
```
It sends the professional reciter's audio for each verse to your engine and prints how many words match the text. Studio audio should match almost entirely. Passing this does **not** show it works on learners' phone recordings, which is what the teacher-marked test below is for.

## What the code guarantees
- Differences are reported as "possibly", never as certain mistakes.
- Close matches and low-confidence words are "unsure".
- If too little of the speech matches the text, the whole result is "unreliable" and **nothing** is flagged.
- Words after the learner stopped are "not reached", not "skipped".
- Spelling-convention differences (vowel marks, Qur'anic signs, alef/ya variants) are ignored.
- It judges **words only**. No Tajweed or pronunciation claims.
- Results are labelled as after-recording analysis, not live.

The aligner is unit-tested with ordinary Arabic sentences (not Qur'anic text) and the API is tested against a stub engine.

## Engine contract
`POST $RECITATION_ENGINE_URL` with the raw audio body and its `Content-Type`.
Reply `200 {"words":[{"text":"...","confidence":0.0-1.0 (optional)}]}`.
Any model can be wrapped to this shape (e.g. a small Python service).

## Candidates found (claims are the authors' own, unverified by us)
- Tarteel: real-time word-level detection (missed/incorrect/extra words, not letter-level), proprietary.
- Open Hugging Face models: FastConformer-Quran variants (offline and streaming), Whisper fine-tunes on EveryAyah, and a streaming phoneme zipformer.
- Reported error rates **conflict widely** between model cards, and at least one model is **non-commercial only**. Check each licence before use.
- Most training data is clean studio recitation. Ordinary phone recordings by learners are the real risk.

## Smallest feasible experiment (do this next)
1. Collect 30–50 short recordings (3–10 verses) from several learners on phones, including some deliberate skips, substitutions and repeats, with consent.
2. Have a qualified Qur'an teacher mark each word: correct / skipped / wrong word / repeated. Keep this as the ground truth.
3. Run one offline model on the audio, wrap it to the contract above, and run it through the aligner.
4. Measure, per word, precision and recall of each flag type against the teacher, and how often "correct" words are wrongly flagged (false accusations).
5. **Release gate (suggested):** do not show any "possibly skipped/different" flags to learners until false accusations on correct words are very rare (for example under 2%) on phone recordings from several speakers, reviewed with teachers. Until then keep it hidden or labelled experimental.
6. Only after offline results hold up, try streaming for live feedback and measure latency on mobile.

## Privacy
Recordings stay in browser memory. They are sent out only when a engine is configured **and** the learner ticks consent for that recording. The backend holds audio in memory for the request only and never stores or logs it. If you choose a third-party hosted engine, review its data policy and update the privacy text in Settings.


## AI passage checker for hifz and muraja'ah (added 2026-11-23)

When `LETTER_ENGINE_URL` is set, the Muallim uses the AI checker (`engine/`, Quran Muaalem) for whole passages, at the level of letters and vowels, instead of the word-level engine. Everything downstream is unchanged: the result is saved as a `RecitationSubmission`, "memorised" needs a passed submission, and a revision session is rated from it (easy if passed, difficult with 3 or more corrections, otherwise moderate).

- Engine: `POST /recite?surah=S&from=A&to=B` (body = audio, up to 40 verses and 180 s). It builds the reference from the Qur'an text bundled with the `quran-transcript` package (all 114 Surahs; the engine never calls the provider), asks the model what it heard, and compares with the library's own `explain_error`. It returns one record per word: `ok`, `wrong` (with the letter or vowel problem), `omitted`, or `not_reached` (stopped early).
- Policy (`engine/recite.py`): a wrong, extra or missing letter or vowel blocks the pass. Tajweed-rule differences (madd length, ghunna...) are shown as **notes** and do **not** block (flip `tajweed_blocks` to change). If the audio matches the passage too little (similarity below 0.4) or is silent, the verdict is `unclear`, which neither passes nor fails.
- Each verse is phonetised as if the reader stops at its end. A reader who joins verses may be told about verse-end sounds.
- Backend: `letterEngine.checkPassage`, `utils/recitation/passageFeedback.js`, `GET /api/status` -> `recitation.mode` is `ai` or `words`.
- **Not measured.** The model authors report 75.8% Tajweed F1 on their own benchmark. Nobody has checked it on learners' phone recordings. Because it gates progress, a wrong verdict can hold back a learner who recited correctly. Before relying on it: record 30 or more passages (some correct, some with deliberate mistakes), have a qualified teacher mark them, and count disagreements. If it blocks too often, lower the strictness in `recite.py`, or make the pass advisory.
- Tests: `engine/test_recite.py` (real library, 114 Surahs, error injection), `engine/test_server.py` (fake model), `backend/test/passage-check.test.js`.

## All Surahs and audio

The Quran Foundation `prelive` account serves only Surahs 1 and 2 (the site itself restricts nothing). Two ways to get all 114:

1. **Production access** from the Quran Foundation (apply in their dev console, needs approval), then `QF_ENV=production` and the production keys. No code change.
2. **Second source, now:** set `QURAN_FALLBACK=alquran` in `backend/.env`. For anything the Quran Foundation cannot serve, the site uses the free AlQuran.cloud API (Islamic Network): its list of 114 Surahs, Tanzil-based Uthmani text (the Basmala it puts in front of verse 1 is removed, except for Al-Fatihah and At-Tawbah where it is handled correctly), per-verse recitation audio streamed from its CDN, and the Juz map. Its reciters appear in the Reciter list with ids from 100001; when a Surah has no audio from the chosen Quran Foundation reciter the viewer switches to one of them. Terms read on 2026-11-23: free, text may be used unaltered with credit, recitations may be streamed for personal and educational use and stay the reciters' copyright (a reciter can ask for removal in a commercial product; re-read the terms if Riwaq ever becomes commercial). Credit is shown under every passage.

**Not verified:** the AlQuran.cloud API could not be reached from where this was built; the code follows its published OpenAPI spec and is tested only against a fake of it. Run `node --env-file=.env scripts/check-quran-coverage.js <reciterId> --audio` on your machine to see which Surahs and audio actually arrive. Nobody has listened to those recitations or compared that text with a printed mushaf. Have a teacher spot-check some Surahs.

`node --env-file=.env scripts/check-quran-coverage.js [reciterId] [--audio]` lists, for all 114 Surahs, whether text and audio arrive (run with `--audio` and no id to list reciter ids).
