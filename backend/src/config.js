// All configuration comes from environment variables.
const ENVIRONMENTS = {
  prelive: {
    auth: 'https://prelive-oauth2.quran.foundation',
    api: 'https://apis-prelive.quran.foundation',
  },
  production: {
    auth: 'https://oauth2.quran.foundation',
    api: 'https://apis.quran.foundation',
  },
}

export function loadConfig(env = process.env) {
  const environment = env.QF_ENV === 'production' ? 'production' : 'prelive'
  const urls = ENVIRONMENTS[environment]
  return {
    port: Number(env.PORT) || 4000,
    corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    qf: {
      environment,
      clientId: env.QF_CLIENT_ID || '',
      clientSecret: env.QF_CLIENT_SECRET || '',
      authUrl: (env.QF_AUTH_URL || urls.auth).replace(/\/$/, ''),
      apiUrl: (env.QF_API_URL || urls.api).replace(/\/$/, ''),
      audioBaseUrl: env.QF_AUDIO_BASE_URL || 'https://verses.quran.com/',
      timeoutMs: 10000,
    },
    recitation: {
      engineUrl: env.RECITATION_ENGINE_URL || '',
      timeoutMs: Number(env.RECITATION_ENGINE_TIMEOUT_MS) || 30000,
      // Only set to true after the engine has been checked against qualified teachers.
      validated: env.RECITATION_ENGINE_VALIDATED === 'true',
    },
  }
}
