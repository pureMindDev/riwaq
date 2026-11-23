# Hosting Riwaq, step by step (and how to update it later)

Riwaq is four parts. Three are small and cheap; the AI engine is the heavy one.

| Part | What it is | Where to host it | Needs |
|---|---|---|---|
| Database | MongoDB | MongoDB Atlas (free M0 tier is enough to start) | a connection string |
| Backend | Node 22 API (`backend/`) | Render, Railway, Fly.io, or any VPS | env variables, HTTPS |
| Frontend | static site (`frontend/dist`) | Netlify, Cloudflare Pages, Vercel | the backend's public URL |
| AI engine | Python + the 2.4 GB model (`engine/`) | a VPS with **at least 4 GB RAM** (8 GB is more comfortable) | HTTPS + a secret key |

Without the engine the site still works (reading, listening, tahfidh planning), but the AI checks are unavailable and the
learner cannot pass a recitation, so the progress rules stay locked. Start without it if you want to launch sooner, add it later.
The free tiers of the hosts above are **not** big enough for the engine.

None of the host steps below were run by me (I have no access to a host). The app itself passed its tests (backend 124, frontend 31).

## 0. Before anything: secrets
- Rotate the Quran Foundation client secret you pasted in chat (dev console), and use the new one.
- Make two long random values: `LETTER_ENGINE_KEY` (the key between backend and engine) and `LETTER_PROOF_SECRET`.
  In Git Bash: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (run it twice).
- Never commit `.env`. The `.gitignore` already excludes it.

## 1. Put the code on GitHub (this is also how you will update)
```
cd riwaq
git add -A && git commit -m "Riwaq" && git push
```
Every host below can watch the repository and redeploy by itself when you push.

## 2. Database (MongoDB Atlas)
Create a free cluster, a database user, and allow network access (for a start `0.0.0.0/0`; tighten it to your backend host's IPs later).
Copy the connection string, ending in a database name, e.g. `mongodb+srv://USER:PASS@cluster.../riwaq`. This is `MONGODB_URI`.

## 3. Backend (Render example; Railway and Fly are similar)
New Web Service from your GitHub repo.
- Root directory: `backend`. Build command: `npm ci --omit=dev`. Start command: `npm start`. Node 22.
- Environment variables (copy names from `backend/.env.example`):
  - `MONGODB_URI`, `CORS_ORIGINS=https://YOUR-FRONTEND-URL` (exact origin, no trailing slash), `TRUST_PROXY=1`
  - `QF_CLIENT_ID`, `QF_CLIENT_SECRET`, `QF_ENV` (`prelive` serves only Surahs 1 and 2; `production` needs Quran Foundation approval)
  - `QURAN_FALLBACK=alquran` (shows all 114 Surahs from the second source while you are on `prelive`)
  - `LETTER_PROOF_SECRET=<random>`, and when the engine exists: `LETTER_ENGINE_URL=https://YOUR-ENGINE-URL`, `LETTER_ENGINE_KEY=<random>`
  - leave `ALLOW_SELF_DECLARATION=false`
- Check `https://YOUR-BACKEND/api/status`: `database.connected` true, `quran.configured` true, and `recitation.available` true once the engine is up.

## 4. Frontend (Netlify or Cloudflare Pages example)
- Base directory `frontend`. Build command `npm run build`. Publish directory `dist`.
- Environment variable at build time: `VITE_API_BASE_URL=https://YOUR-BACKEND/api`.
- `public/_redirects` already makes page reloads work on Netlify and Cloudflare Pages.
- Then put the frontend's final URL into the backend's `CORS_ORIGINS` and redeploy the backend.
- Recording needs HTTPS. Both hosts give it.

## 5. AI engine (VPS, optional but it is the AI Muallim)
A VPS with 4 GB+ RAM and Ubuntu (any provider). Docker route (a `Dockerfile` is in `engine/`; I could not run Docker here, so treat it as a starting point):
```
cd engine
docker build -t riwaq-engine .
docker run -d --restart=always -p 8000:8000 -e ENGINE_API_KEY=<same as LETTER_ENGINE_KEY> -v hf:/root/.cache/huggingface riwaq-engine
```
Put HTTPS in front of it (Caddy or nginx with a free certificate) and use that URL as `LETTER_ENGINE_URL`. The first start downloads the 2.4 GB model
into the `hf` volume. On a CPU a one-verse check takes a few seconds and longer passages longer, so expect to need a bigger machine as users grow.
Do not expose port 8000 without the key set.

## 6. Check it works (do this once after hosting)
1. Sign up, open Listen and Practise: you should see all 114 Surahs and hear audio.
2. Foundation, letters: Check me turns green/red (needs the engine).
3. Recite: the AI Muallim marks words. Run `node --env-file=.env scripts/check-quran-coverage.js` against the same credentials if Surahs are missing.

## How to update it later
1. Replace the changed files in your local `riwaq` folder (unzip an update over it), run `npm test` in `backend` and `frontend`.
2. `git add -A && git commit -m "update" && git push`. Render and Netlify (or Cloudflare) redeploy by themselves.
3. Engine changes (`engine/`): on the VPS `git pull`, `docker build` again, restart the container.
4. If an update adds a setting, it is listed in `backend/.env.example`: add it in the host's environment page.
5. Database changes are additive; nothing needs migrating for any update so far.

## Before telling people about it
- Tell a qualified teacher to review the letter recordings, the makhraj notes, and a sample of AI corrections. The AI checker's accuracy on real learners is not measured.
- Keep the Quran Foundation and Islamic Network credit visible. Read `docs/DEPLOYMENT.md` for rate limits and backups.


## Your chosen hosts: Render (backend) and Vercel (frontend)
Order matters, because each needs the other's address.

1. **MongoDB Atlas** first (section 2). Keep the connection string.
2. **Render:** New + > Blueprint, pick your GitHub repo (it reads `render.yaml`), or New + > Web Service with root `backend`, build `npm ci --omit=dev`, start `npm start`.
   Fill in the empty variables on the Environment page: `MONGODB_URI`, `QF_CLIENT_ID`, `QF_CLIENT_SECRET`, `LETTER_PROOF_SECRET`, and `CORS_ORIGINS` (put a placeholder for now, fix it in step 4).
   Leave `LETTER_ENGINE_URL` and `LETTER_ENGINE_KEY` empty until the engine exists. When it deploys, open `https://YOUR-API.onrender.com/api/status`.
3. **Vercel:** Add New > Project, import the repo, set **Root Directory** to `frontend` (Framework: Vite is detected). Add the environment variable
   `VITE_API_BASE_URL` = `https://YOUR-API.onrender.com/api`, then Deploy. `frontend/vercel.json` makes page reloads work.
4. Go back to Render and set `CORS_ORIGINS` to your Vercel address exactly (for example `https://riwaq.vercel.app`, no slash at the end). Render redeploys by itself.
   If you later add your own domain, list both addresses separated by a comma.
5. Open the Vercel address, sign up, and check section 6 of this guide.

Things to know about the free plans:
- A free Render web service **sleeps after about 15 minutes without traffic** and takes up to a minute to wake, so the first visit can be slow (and the first request may time out; reload). A paid instance stays awake.
- The database is Atlas, not Render, so nothing is lost when Render sleeps or redeploys.
- Vercel's free (Hobby) plan is meant for personal, non-commercial projects. Riwaq is free to learners; if you ever charge or take donations through it, check Vercel's terms or use Cloudflare Pages instead.
- The AI engine cannot run on Render's free plan or Vercel (too little memory). Use a VPS (section 5), or a paid Render instance with at least 4 GB.
- After each `git push`, Render and Vercel redeploy by themselves. Environment variable changes on Render redeploy the backend; a change to `VITE_API_BASE_URL` on Vercel needs a new deploy of the frontend (Deployments > Redeploy).
