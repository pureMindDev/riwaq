# Deployment

The frontend and backend deploy separately.

## Backend (any Node 22.9+ host)
1. Set environment variables from `backend/.env.example` on the host (never commit `.env`).
2. `CORS_ORIGINS` must list your frontend's exact origin, e.g. `https://app.example.com`.
3. Run `npm ci --omit=dev && npm start`. Check `GET /api/status`: `database.connected` and `quran.configured` must be `true`.
4. Put it behind HTTPS (the API sets no HSTS header itself; do it at the proxy/host).
5. If a reverse proxy or platform load balancer sits in front of the API, set `TRUST_PROXY=1` (the number of proxies). Without it the server sees every visitor as the proxy's IP, so the built-in sign-in/sign-up rate limit (`AUTH_RATE_LIMIT_MAX` per IP per 15 minutes) is shared by all users. Leave it `0` when there is no proxy, otherwise clients could fake their IP.
6. Rate limiting is built in for `/api/auth/register` and `/api/auth/login` (per IP, `AUTH_RATE_LIMIT_MAX`) and for the three audio upload routes (per account, `UPLOAD_RATE_LIMIT_MAX`, default 60 per 15 minutes). It is in memory: per server process, reset on restart, not shared between servers. Add proxy-level limiting for everything else.
7. `GET /api/health` only says the process is up. It does not check MongoDB. Use `GET /api/status` (`database.connected`) if your monitor should detect a database outage. While MongoDB is down, routes that need it return `503` (`DATABASE_UNAVAILABLE`, `Retry-After: 5`) at once and recover automatically when it returns.
8. The server shuts down cleanly on `SIGTERM`/`SIGINT` (finishes open requests, closes MongoDB). If the port is taken it exits with an error instead of pretending to run.

## Frontend (static hosting)
1. Create `frontend/.env.production` with `VITE_API_BASE_URL=https://your-backend.example.com/api`.
2. `cd frontend && npm run build`, then upload `dist/`.
3. Direct page loads need the host to serve `index.html` for unknown paths. `public/_redirects` handles Netlify/Cloudflare Pages. Vercel: add a rewrite of `/(.*)` to `/`. Nginx: `try_files $uri /index.html;`.
4. Microphone recording needs HTTPS (localhost is exempt).

## Before going live
- Production Quran Foundation credentials approved and tested with real Surahs and audio.
- Attribution still visible. Verify audio URLs play from the deployed site.
- Progress and accounts are stored in your MongoDB database (not on the learner's device). Use a managed database with backups, restrict network access to it, and tell users plainly how their data is stored and that they can delete their account (`DELETE /api/auth/me`).
- Rotate any credential that has ever been pasted into a chat, ticket, screenshot or commit.
