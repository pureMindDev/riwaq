# Feature checklist

Legend: ✅ built and tested · 🟡 built; tested only with mock/fake data · ⛔ needs you (credentials, approval, real recordings) · ❌ not built

## Architecture
| Item | State |
|---|---|
| Frontend (`frontend/src`) and backend separated; backend has no `src/` | ✅ |
| Backend folders: config, controllers, models, routes, middleware, services, utils; `app.js` + `server.js` | ✅ |
| Frontend calls the API via a configurable base URL; no secrets in frontend | ✅ |
| Responsive app shell (sidebar on wide screens, menu drawer + bottom bar on phones) and Foundation page with one card per letter (lesson score and attempts, complete/locked state) | ✅ checked by hand at 3 widths; not covered by automated browser tests |
| Frontend and backend start independently | ✅ |
| Backend boots, connects to MongoDB, serves `/api/health` and `/api/status`; refuses to start without `MONGODB_URI`, with an unreachable database, or with the port taken | ✅ run by hand on 2026-11-11 (and the pure parts are in `test/hardening.test.js`) |
| Database outage while running: requests get an immediate 503 (~3 ms measured), `/api/status` shows `database.connected:false`, and service recovers by itself when MongoDB returns | ✅ run by hand; not an automated test |
| Recording uploads limited per account (429 + Retry-After) | ✅ `test/uploads.test.js` |
| Graceful shutdown on SIGTERM/SIGINT | ✅ run by hand once; not an automated test |
| `scripts/check-engine.js` loads and runs (mock provider + stub engine) | ✅ `test/check-engine.test.js`; ⛔ never run against the real provider or a real engine |

## Madrasa journey
| Feature | State |
|---|---|
| Accounts: register, sign in/out, delete account, rate limiting, hashed passwords/tokens | ✅ |
| Learner data isolation (404 on other learners' records) | ✅ tested in API and in two real browser sessions |
| Initial assessment → programme suggestion, changeable | ✅ |
| Foundation reading: 11 lessons, every one closed by a server-graded quiz or a passed recitation; sequential unlock | ✅ |
| Letter pronunciation by listening (hear Alif, repeat, be told if wrong); speaker button on letter cards | ❌ needs recorded reference audio and a model proven on isolated letters (no speaker button is shown, so nothing pretends to pronounce) |
| Letter audio button | 🟡 works for any letter listed in `frontend/public/audio/letters/manifest.json` (tested with temporary tones); ⛔ no real recordings supplied, so none is shown |
| Per-letter scores | ❌ letter cards show their lesson's best quiz score and attempts, not a score for the single letter |
| Foundation read-along uses provider text and audio | 🟡 mock provider; ⛔ real API |
| Tahfidh: achievable daily target, assigned next passage, resume position; memorised only after the Muallim passes the whole passage | ✅ (stub engine) |
| Muraja'ah completed only by reciting; the result sets the rating | ✅ (stub engine) |
| Murajaah alongside new memorisation (due, overdue, ratings, adjustable dates, history) | ✅ |
| Juz milestones + cumulative self-assessment | 🟡 mock Juz data; ⛔ real `/juzs` unverified |
| Hafiz/Hafidah Muraja'ah-only programme with declared Ajza' | 🟡 same Juz caveat |
| Persistence in MongoDB | ✅ full suite (93 tests) passed on a real MongoDB 7.0.34 on 2026-11-11; not run on any other version |
| Dashboard/plan built only from saved data | ✅ |

## The Muallim
| Feature | State |
|---|---|
| No click-through progress: memorising, revising, milestone checks and the last foundation lesson require the Muallim; other lessons require server-graded quizzes | ✅ tested (strict mode) |
| Direct corrections: wrong word, skipped, repeated, added, stopped early, wrong letter (named), wrong vowel (named) | ✅ logic tested with a scriptable engine |
| Same corrections from a REAL engine on real learners' recordings | ⛔ no engine connected; accuracy unmeasured |
| Letter-by-letter pronunciation lessons (hear, repeat, be told if wrong) | ❌ needs reference audio from qualified readers and a proven model |

## Recitation
| Feature | State |
|---|---|
| Record, upload, playback, reference text, retry | ✅ |
| Browser live follow-along | 🟡 fake SpeechRecognition in tests; accuracy unmeasured |
| The Muallim: direct word / letter / vowel corrections in plain language | ✅ logic tested; ⛔ accuracy depends on a real engine that transcribes letters and vowel marks |
| Server recognition engine path (store outcome only) | 🟡 stub engine; ⛔ no real engine |
| Validated against qualified teachers | ⛔ |
| Live mistake correction, Tajweed | ❌ not claimed |

## Not built
Password reset / email verification, teacher or class features, payments (deliberately), push reminders.
