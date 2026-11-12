import express, { Router } from 'express'
import { requireAuth, loadStudent } from '../middleware/requireAuth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { requireDb } from '../middleware/requireDb.js'
import { authController } from '../controllers/authController.js'
import { studentController } from '../controllers/studentController.js'
import { assessmentController } from '../controllers/assessmentController.js'
import { foundationController } from '../controllers/foundationController.js'
import { tahfidhController } from '../controllers/tahfidhController.js'
import { murajaahController } from '../controllers/murajaahController.js'
import { planController } from '../controllers/planController.js'
import { milestoneController } from '../controllers/milestoneController.js'
import { quranController } from '../controllers/quranController.js'
import { recitationController } from '../controllers/recitationController.js'

const audioBody = express.raw({ type: ['audio/*', 'video/webm'], limit: '10mb' })

export function createRoutes(services) {
  const { auth, student, config } = services
  const r = Router()
  const dbUp = requireDb(config)
  const signedIn = [dbUp, requireAuth(auth)]
  const learner = [signedIn, loadStudent(student)]
  const limiter = rateLimit({ windowMs: config.auth.rateLimitWindowMs, max: config.auth.rateLimitMax })
  // Keyed by account (these routes are signed-in only), checked before the audio body is read.
  const uploadLimiter = rateLimit({ windowMs: config.uploads.rateLimitWindowMs, max: config.uploads.rateLimitMax, key: (req) => `upload:${req.user.id}` })

  // ---- public: Qur'an content (no account needed to read or listen)
  const quran = quranController(services)
  r.get('/chapters', quran.chapters)
  r.get('/chapters/:id', quran.chapter)
  r.get('/chapters/:id/verses', quran.verses)
  r.get('/chapters/:id/audio', quran.audio)
  r.get('/reciters', quran.reciters)
  r.get('/juzs', quran.juzs)

  // ---- accounts
  const a = authController(services)
  r.post('/auth/register', limiter, dbUp, a.register)
  r.post('/auth/login', limiter, dbUp, a.login)
  r.post('/auth/logout', signedIn, a.logout)
  r.get('/auth/me', signedIn, a.me)
  r.delete('/auth/me', signedIn, a.remove)

  // ---- student profile and progress
  const s = studentController(services)
  r.get('/student', learner, s.profile)
  r.patch('/student/programme', learner, s.setProgramme)
  r.patch('/student/settings', learner, s.updateSettings)
  r.get('/student/progress', learner, s.progress)
  r.get('/student/activity', learner, s.activity)

  // ---- initial assessment
  const as = assessmentController(services)
  r.get('/assessment/questions', as.questions)
  r.post('/assessment', learner, as.submit)
  r.get('/assessment', learner, as.latest)

  // ---- foundation reading programme
  const f = foundationController(services)
  r.get('/foundation/lessons', learner, f.list)
  r.get('/foundation/lessons/:id', learner, f.get)
  r.post('/foundation/lessons/:id/quiz', learner, f.quiz)
  r.post('/foundation/lessons/:id/recitation', learner, uploadLimiter, audioBody, f.recitation)
  r.post('/foundation/lessons/:id/complete', learner, f.complete)

  // ---- daily plan
  r.get('/plan/today', learner, planController(services).today)

  // ---- tahfidh (memorisation)
  const t = tahfidhController(services)
  r.get('/tahfidh/passages', learner, t.list)
  r.post('/tahfidh/passages', learner, t.add)
  r.post('/tahfidh/declare-juz', learner, t.declareJuz)
  r.get('/tahfidh/passages/:id', learner, t.get)
  r.delete('/tahfidh/passages/:id', learner, t.remove)
  r.post('/tahfidh/passages/:id/memorised', learner, t.markMemorised)
  r.patch('/tahfidh/passages/:id/status', learner, t.setStatus)
  r.post('/tahfidh/passages/:id/session', learner, t.session)
  r.patch('/tahfidh/passages/:id/position', learner, t.position)
  r.get('/tahfidh/passages/:id/recitations', learner, t.recitations)
  r.post('/tahfidh/passages/:id/recitations', learner, uploadLimiter, audioBody, t.submitRecitation)

  // ---- muraja'ah (revision)
  const m = murajaahController(services)
  r.get('/murajaah', learner, m.overview)
  r.get('/murajaah/history', learner, m.history)
  r.post('/murajaah/passages/:id/complete', learner, m.complete)
  r.patch('/murajaah/passages/:id/schedule', learner, m.schedule)

  // ---- juz milestones
  const ms = milestoneController(services)
  r.get('/milestones', learner, ms.list)
  r.get('/milestones/:id', learner, ms.get)
  r.post('/milestones/:id/assessment/:itemId', learner, ms.rate)

  // ---- recitation analysis (signed-in only: it forwards audio to a paid/limited engine)
  const rc = recitationController(services)
  r.post('/recitation/analyze', signedIn, uploadLimiter, audioBody, rc.analyze)

  return r
}
