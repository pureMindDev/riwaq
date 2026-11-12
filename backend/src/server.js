import { loadConfig } from './config.js'
import { createApp } from './app.js'
import { createQuranService } from './services/quranFoundation.js'
import { createRecitationEngine } from './recitation/engine.js'

const config = loadConfig()
const quran = createQuranService({ config })
const engine = createRecitationEngine({ config })
const app = createApp({ config, quran, engine })

app.listen(config.port, () => {
  console.log(`Digital Tahfidh API on http://localhost:${config.port}`)
  console.log(`Qur'an provider: ${quran.configured ? `configured (${quran.environment})` : 'NOT configured (set QF_CLIENT_ID / QF_CLIENT_SECRET)'}`)
  console.log(`Recitation engine: ${engine.available ? 'configured' : 'not configured'}`)
})
