import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { AppError } from '../utils/AppError.js'
import { isValidTimeZone } from '../utils/dates.js'
import { stringParam } from '../utils/validate.js'
import { User } from '../models/User.js'
import { AuthSession } from '../models/AuthSession.js'
import { Student } from '../models/Student.js'
import { Passage } from '../models/Passage.js'
import { StudyLog } from '../models/StudyLog.js'
import { DailyPlan } from '../models/DailyPlan.js'
import { Milestone } from '../models/Milestone.js'
import { Assessment } from '../models/Assessment.js'
import { RecitationSubmission } from '../models/RecitationSubmission.js'

const scrypt = promisify(crypto.scrypt)
const N = 16384, R = 8, P = 1, KEYLEN = 64

// Passwords are hashed with scrypt (built into Node) and a random salt. Plain text is never stored.
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P })
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(password, stored) {
  const [scheme, n, r, p, salt, hash] = String(stored).split('$')
  if (scheme !== 'scrypt') return false
  const expected = Buffer.from(hash, 'base64')
  const key = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) })
  return crypto.timingSafeEqual(key, expected)
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function createAuthService({ config }) {
  let dummyHash // used so unknown emails take as long to reject as wrong passwords

  async function startSession(userId) {
    const token = crypto.randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + config.auth.sessionDays * 86400000)
    await AuthSession.create({ user: userId, tokenHash: sha256(token), expiresAt })
    return { token, expiresAt }
  }

  const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email })

  return {
    async register({ name, email, password, timezone }) {
      const cleanName = stringParam(name, 'Name', { max: 80 })
      const cleanEmail = stringParam(email, 'Email', { max: 254 }).toLowerCase()
      if (!EMAIL.test(cleanEmail)) throw new AppError('INVALID_PARAMETER', 'Enter a valid email address.', 400)
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        throw new AppError('INVALID_PARAMETER', 'Password must be 8-128 characters.', 400)
      }
      const passwordHash = await hashPassword(password)
      let user
      try {
        user = await User.create({ name: cleanName, email: cleanEmail, passwordHash })
      } catch (err) {
        if (err?.code === 11000) throw new AppError('EMAIL_TAKEN', 'An account with this email already exists.', 409)
        throw err
      }
      await Student.create({ user: user._id, timezone: isValidTimeZone(timezone) ? timezone : 'UTC' })
      return { ...(await startSession(user._id)), user: publicUser(user) }
    },

    async login({ email, password }) {
      const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
      const user = cleanEmail ? await User.findOne({ email: cleanEmail }) : null
      dummyHash ||= await hashPassword('not-a-real-password')
      const ok = await verifyPassword(typeof password === 'string' ? password : '', user ? user.passwordHash : dummyHash)
      if (!user || !ok) throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect.', 401)
      return { ...(await startSession(user._id)), user: publicUser(user) }
    },

    async logout(token) {
      await AuthSession.deleteOne({ tokenHash: sha256(token) })
    },

    // Returns the user for a valid, unexpired token; otherwise null.
    async authenticate(token) {
      if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null
      const s = await AuthSession.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } })
      if (!s) return null
      const user = await User.findById(s.user)
      return user ? publicUser(user) : null
    },

    // Deletes the account and everything stored about the learner.
    async deleteAccount(userId) {
      await Promise.all([
        Student, Passage, StudyLog, DailyPlan, Milestone, Assessment, RecitationSubmission, AuthSession,
      ].map((M) => M.deleteMany({ user: userId })))
      await User.deleteOne({ _id: userId })
    },
  }
}
