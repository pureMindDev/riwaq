// All configuration comes from environment variables. Nothing secret is hard-coded.
const ENVIRONMENTS = {
  prelive: { auth: 'https://prelive-oauth2.quran.foundation', api: 'https://apis-prelive.quran.foundation' },
  production: { auth: 'https://oauth2.quran.foundation', api: 'https://apis.quran.foundation' },
}

// A whole number of proxy hops. Anything else (including "true") is ignored: trusting every X-Forwarded-For
// value would let a client pick its own IP and sidestep the rate limit.
function parseTrustProxy(value) {
  return /^\d{1,2}$/.test(String(value ?? '').trim()) ? Number(value) : 0
}

export function loadConfig(env = process.env) {
  const environment = env.QF_ENV === 'production' ? 'production' : 'prelive'
  const urls = ENVIRONMENTS[environment]
  return {
    nodeEnv: env.NODE_ENV || 'development',
    port: Number(env.PORT) || 4000,
    corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
    mongoUri: env.MONGODB_URI || '',
    // How many reverse proxies sit in front of this server (0 = none). Needed behind Render/Railway/Nginx etc.,
    // otherwise every visitor shares the proxy's IP and the sign-in rate limit counts them all together.
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    auth: {
      sessionDays: Number(env.SESSION_DAYS) || 30,
      // Failed/new-account attempts allowed per IP in the window (set high only in tests).
      rateLimitMax: Number(env.AUTH_RATE_LIMIT_MAX) || 20,
      rateLimitWindowMs: 15 * 60 * 1000,
    },
    database: {
      // Answer 503 immediately while MongoDB is down. Tests that run with no database at all switch it off.
      failFast: env.DB_FAIL_FAST !== 'false',
    },
    uploads: {
      // Recording uploads per signed-in learner in the window (each one may be forwarded to a paid/limited engine).
      rateLimitMax: Number(env.UPLOAD_RATE_LIMIT_MAX) || 60,
      rateLimitWindowMs: 15 * 60 * 1000,
    },
    qf: {
      environment,
      clientId: env.QF_CLIENT_ID || '',
      clientSecret: env.QF_CLIENT_SECRET || '',
      authUrl: (env.QF_AUTH_URL || urls.auth).replace(/\/$/, ''),
      apiUrl: (env.QF_API_URL || urls.api).replace(/\/$/, ''),
      audioBaseUrl: env.QF_AUDIO_BASE_URL || 'https://verses.quran.com/',
      timeoutMs: 10000,
      // Surah/Juz metadata is kept in memory this long (the provider allows up to a week).
      metadataCacheSeconds: env.QF_CACHE_SECONDS === undefined ? 600 : Number(env.QF_CACHE_SECONDS),
    },
    muallim: {
      // DEVELOPMENT ONLY. When true, learners can mark things done without reciting to the Muallim.
      allowSelfDeclaration: env.ALLOW_SELF_DECLARATION === 'true',
    },
    recitation: {
      engineUrl: env.RECITATION_ENGINE_URL || '',
      timeoutMs: Number(env.RECITATION_ENGINE_TIMEOUT_MS) || 30000,
      validated: env.RECITATION_ENGINE_VALIDATED === 'true',
    },
  }
}
