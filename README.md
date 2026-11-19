# Riwaq
**Your Qur’an Learning Journey**

(Previously called Digital Tahfidh. Some internal names still use the old name on purpose: see "Internal names" below.)

A free digital madrasa: learn to read Arabic, memorise a little each day, keep what you have memorised (Muraja'ah), and listen to recitation.
For individual learners. No payments, ads or monetisation.

## The idea: the website is the Muallim
There is no human teacher role. The software plays the Muallim: it listens to the student, points out exactly what is wrong, and **does not let anyone move on until they have actually got it right**. Nothing is completed by clicking "I have learned it".

## The learning journey (what the app actually does)
1. **Account and initial assessment.** A short questionnaire suggests a programme. It is self-reported and always changeable.
2. **Foundation reading** (if needed): 11 ordered lessons: letters, articulation overview, vowels, sukun/shadda/tanwin, long vowels, joining letters, fluency drills, and finally **reading aloud to the Muallim**. Every lesson is closed by a server-graded quiz (80% to pass) or, for the last one, a passed recitation. A lesson unlocks the next.
3. **Tahfidh:** an achievable daily target (suggested from your time, adjustable 1–20 verses). Each day the plan assigns the next passage after the last one. You prepare it (listen, repeat, hide the text), then **recite the whole passage to the Muallim**. It counts as memorised only when the Muallim passes it.
4. **Muraja'ah:** a revision is completed by reciting the passage to the Muallim, and **the result decides the rating** (correct = easy; 1–2 corrections = moderate; 3+ = difficult). You cannot rate yourself. Passages come back on a simple schedule (1, 3, 7, 14, 30, 60 days); dates are yours to change. At most 6 revisions are planned per Tahfidh day.
5. **Juz milestones:** when a whole Juz has been memorised through the app, revise each of its passages to the Muallim, then recite one sample passage from each completed Juz. An item is passed only by a correct recitation.
6. **Hafiz / Hafidah programme:** Muraja'ah-only. Declare which whole Ajza' you have memorised (a declaration, never "verified") and get a daily rotation (least recently revised first). Each is revised by reciting it to the Muallim. No new memorisation is assigned.

### How the Muallim corrects
It compares what the recognition engine heard with the exact text and says so directly, for example:
- `Word 3 «لَيْسَ»: on the letter س (Sīn) the vowel should be fatḥa, but you said kasra.`
- `Word 4 «الرحيم»: the 4th letter should be ح (Ḥā’), but you said ء (hamza).`
- `Word 2 «…»: you said «…». The word is «…».` · `you skipped this word` · `you repeated…` · `You stopped before word 5…`

If the audio cannot be followed it says "I could not hear you", never an accusation.

**How accurate the Muallim is depends entirely on the recognition engine.** Letter and vowel corrections need an engine whose transcript contains the letters and vowel marks it heard. If the engine returns plain text, vowel mistakes cannot be heard and are not invented. **No engine is bundled and none has been validated** (see `docs/RECITATION.md`). Until one is connected, the Muallim is honestly "not available" and the steps that need it cannot be passed. Test your engine with `backend/scripts/check-engine.js` and with real learner recordings before relying on it (see `docs/RECITATION.md`).

### No shortcuts, and what is not built
There are no click-through shortcuts: memorising a passage, completing a revision, passing a milestone check and finishing the last foundation lesson all require reciting to the Muallim. Foundation lessons 1–10 require passing a server-graded quiz.

**Developer switch.** `ALLOW_SELF_DECLARATION=true` (default `false`) lets a developer test without an engine. Never enable it in production.

**Letter audio:** all 28 letters have an individual recording of the letter's **name** by a native Arabic speaker (Lingua Libre, Wikimedia Commons; CC0 / CC BY 4.0 / CC BY-SA 3.0) in `frontend/public/audio/letters/`, with credits in `CREDITS.txt` (linked from the lesson page). They are **not Tajweed-verified** and are not makhraj demonstrations; a qualified teacher should review them. Per-letter play/stop with a visible playing state, tap-the-letter replay, one clip at a time, and graceful handling of missing files; `npm run check:audio` validates the manifest. Letter cards also show a short "Where it is made" (makhraj) note and a **Check me** button that turns green/red: with the optional AI engine in `engine/` (Quran Muaalem; see `engine/README.md`; real-model accuracy not yet measured) or, without it, the browser's ordinary Arabic speech recognition (not a Tajweed judge; accuracy on real voices not yet tested; it may send audio to the browser's speech provider) and a "Record & compare" recorder. The makhraj notes are not yet reviewed by a qualified teacher. See `docs/LETTER_AUDIO.md` for sources, licences, how the files were obtained and what is untested.

**Not built yet:** letter-by-letter pronunciation lessons (hear "Alif", repeat it, be told if it is wrong). That needs recorded reference audio for the letters from qualified readers and a model proven on single-letter recitations; neither exists in this project. Foundation letter lessons are currently recognition quizzes.

## Repository layout
```
riwaq/
  frontend/                 React + Vite (plain CSS). Static; deploy anywhere.
    src/ (pages, components, context, hooks, services/api.js, lib)
  backend/                  Node + Express + MongoDB (Mongoose). No src/ folder.
    app.js server.js        Express setup / process entry point
    config/                 env config, database connection, assessment + curriculum content
    controllers/            request handling (thin)
    routes/                 URL -> controller
    middleware/             auth, rate limit, security headers, errors
    models/                 Mongoose schemas
    services/               business logic and external integrations (Qur'an provider, recognition engine)
    utils/                  pure helpers (dates, scheduler, Juz coverage, recitation alignment)
    dev/ scripts/ test/     mock provider, engine check + test-DB scripts, automated tests (node:test)
  e2e/                      real-browser tests (Playwright for Python) + stack scripts
  docs/                     CHECKLIST.md, RECITATION.md, DEPLOYMENT.md, engine-example/
```

## Requirements
- Node.js 22.9+ and npm
- **MongoDB** (local install or MongoDB Atlas). Accounts and progress are stored there.
- Quran Foundation API credentials for Qur'an text, audio and Juz data (see below)
- For the automated tests: a real `mongod` (MongoDB 7.0.34 is what the suite was last verified on) on your PATH. Mongo-compatible look-alikes such as FerretDB 1.x are **not** supported: the app uses partial indexes they lack; for browser tests also Python 3 + `pip install playwright && playwright install chromium`

## Run it
```
# 1. backend (terminal 1)
cd backend
cp .env.example .env        # set MONGODB_URI, QF_CLIENT_ID, QF_CLIENT_SECRET
npm install
npm start                   # http://localhost:4000   (npm run dev to auto-restart)

# 2. frontend (terminal 2)
cd frontend
npm install
npm run dev                 # http://localhost:5173   (proxies /api to the backend)
```
The two start independently. In production set `VITE_API_BASE_URL` for the frontend and `CORS_ORIGINS` for the backend (see `docs/DEPLOYMENT.md`).

Try everything without credentials (placeholder text, **not Qur'an**):
```
./e2e/run-stack.sh         # throwaway MongoDB + mock provider + API + frontend; stop with ./e2e/stop-stack.sh
```

## Environment variables (backend/.env.example has placeholders only)
| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string (required) |
| `PORT` | Port to listen on (default 4000) |
| `CORS_ORIGINS` | Allowed frontend origin(s), comma-separated, exact match |
| `TRUST_PROXY` | Number of reverse proxies in front of the API (default `0`). Set `1` behind a typical host so the sign-in rate limit sees real visitor IPs; see `docs/DEPLOYMENT.md` |
| `QF_CLIENT_ID`, `QF_CLIENT_SECRET`, `QF_ENV` | Quran Foundation credentials (server only) and `prelive`/`production` |
| `RECITATION_ENGINE_URL` | The recognition service the Muallim listens through. **Required for anyone to pass Tahfidh, revision, milestones or the last foundation lesson** |
| `ALLOW_SELF_DECLARATION` | **Development only**, default `false`. Lets a developer test without an engine by skipping the Muallim. Never enable in production |
| `SESSION_DAYS`, `AUTH_RATE_LIMIT_MAX` | Login session length; sign-in attempts per IP per 15 minutes |
| `UPLOAD_RATE_LIMIT_MAX` | Recording uploads per signed-in learner per 15 minutes (default 60) |

## External services you must set up
1. **MongoDB**: install locally or create an Atlas cluster; put the URI in `backend/.env`.
2. **Quran Foundation**: https://dev-console.quran.foundation/projects → create a *Server* app with *API access only*; read the Developer Terms. New apps are **pre-live** (limited Surahs). For the full Qur'an request production access and set `QF_ENV=production`. We never store Qur'an text or audio; Surah/Juz *metadata* is cached in memory for 10 minutes. The Juz endpoint (`/juzs`) and the audio base URL are coded from the documentation and **not yet confirmed against the live API**.
3. **Recitation recognition (the Muallim):** see `docs/RECITATION.md`. Nothing is bundled. Without it, learners can do the quizzes but cannot pass any recitation step.

## Security and privacy
Passwords: scrypt (N=16384, r=8, p=1) with a random 16-byte salt, 8-128 characters, compared in constant time; unknown emails cost the same time as wrong passwords. **There are no JWTs.** Sessions are opaque random 256-bit tokens; only their SHA-256 hash is stored (so a database leak does not reveal usable tokens), they expire after `SESSION_DAYS` (default 30, enforced both on lookup and by a MongoDB TTL index) and are revocable at sign-out. They are sent as `Authorization: Bearer` and kept in the browser's localStorage (so a cross-site-scripting bug would expose them; the app sets no third-party scripts). Every learner query is scoped to the signed-in user (tested). Sign-in/sign-up is rate limited per IP, and recording uploads (`/foundation/.../recitation`, `/tahfidh/.../recitations`, `/recitation/analyze`) per account, both in memory (see `docs/DEPLOYMENT.md` for `TRUST_PROXY`). CORS allows only the origins in `CORS_ORIGINS`. Responses carry `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `Cache-Control: no-store`; `X-Powered-By` is off. Request bodies are limited to 100 KB (JSON) and 10 MB (audio). Errors are returned as safe JSON and logs contain only error names/messages, never request bodies, tokens or passwords. Accounts can be deleted, which removes all their data. Recordings are never stored; only the outcome of a recitation check is. `.env` files are git-ignored; only `.env.example` (placeholders) is in the repository.

## Checks
```
cd backend  && npm run test:db     # 94 tests; starts a throwaway mongod (needs mongod on PATH, or set MONGOD_BIN). Or: TEST_MONGODB_URI=... npm test
cd frontend && npm test && npm run lint && npm run build
export MONGOD_BIN=$(which mongod)
./e2e/run-stack.sh strict && (cd e2e && python3 muallim.py); ./e2e/stop-stack.sh                      # the Muallim rules (scriptable TEST engine)
./e2e/run-stack.sh dev && (cd e2e && python3 madrasa.py && python3 public.py); ./e2e/stop-stack.sh   # general flows (dev switch on, no engine)
```
Without `TEST_MONGODB_URI`, the database tests are reported as SKIPPED (not passed); the rest still run.
Status when this was last updated (2026-11-13): backend `npm run test:db` 107/107 passed on MongoDB 7.0.34. Frontend: 25 tests passed, build OK. The Python browser suite in `e2e/` was **not** re-run after the redesign. Separate scripted Chromium checks (real backend and MongoDB, no real Qur'an provider or recitation engine) covered the Foundation journey including page reloads (failed quiz, pass, complete, next lesson unlocks, attempts/score persist), keyboard use, WCAG AA contrast of key text, the Riwaq branding, and no horizontal overflow at 375, 390, 430, 768, 820 and 1280 px. Not tested: real phones, iOS/Safari, screen readers, iOS/Safari audio playback, and whether each clip says the right letter (checked by provenance only; nobody listened), and recognition accuracy (no real engine connected).

Arabic notes: the 28 letters follow the standard order; alif, dāl, dhāl, rā’, zāy and wāw never join the next letter, so they are shown with two shapes (alone, end) and the others with four. Hamza (ء), tā’ marbūṭa (ة) and alif maqṣūra (ى) are not taught as separate letters.
The word-aligner exists in `backend/utils/recitation/` and `frontend/src/lib/recitation/`; a backend test fails if they differ.

## Internal names (unchanged on purpose)
The visible name is Riwaq. These internal identifiers keep the old name so existing installs do not lose data or sign users out: the browser-storage keys `dt:token` and `digital-tahfidh:prefs:v1`, the example database name `digital-tahfidh` (in `.env.example` and `e2e/`), the npm package name `digital-tahfidh-backend`, and the `DigitalTahfidh/0.1` User-Agent sent to the Qur'an provider. Renaming any of them is a separate, deliberate migration. "Tahfidh" is also the name of the memorisation feature and its page, and stays.

## Known limitations
- **No real recognition engine has been connected or measured.** The Muallim's wording and rules are tested with a scriptable stub that returns exactly what the test says was "heard". Real accuracy (especially for vowels and letters) is unknown until a Qur'an-capable engine is connected and checked on real learner recordings.
- **Letter pronunciation is played, not checked.** Letters have recordings of their names (not Tajweed-verified) but the app does not check a student's pronunciation of single letters; that needs a model proven on isolated letters.
- Not yet run against the real Quran Foundation API (see `docs/CHECKLIST.md`).
- No password reset or email verification yet (needs an email service). No teacher or class features.
- The sign-in/upload rate limiters and the per-learner lock are in-process: with several servers each has its own counters. `/api/health` does not check the database (use `/api/status`). While MongoDB is down, routes that need it answer `503 DATABASE_UNAVAILABLE` immediately (with `Retry-After: 5`) and recover by themselves; `/api/health` still says `ok`. There is no HSTS/CSP header from the API (set them at your proxy), no account lockout or password reset, and no session list or "sign out everywhere".
- Multi-server deployments: the per-learner lock is in-process; a unique database index protects the daily assignment, but a perfect overlap guarantee across servers would need MongoDB transactions (replica set).
- On-device guest progress from the earlier version was removed; progress now lives in accounts.
