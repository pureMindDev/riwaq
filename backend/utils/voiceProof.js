// A short-lived, signed receipt that the AI letter checker said "correct" for THIS learner and THIS letter.
// The quiz asks the browser to hand it back, so a browser cannot simply claim it passed a spoken question.
// Nothing is stored: the receipt is "<expiry ms>.<HMAC-SHA256 of userId|letterId|expiry>".
import { createHmac, timingSafeEqual } from 'node:crypto'

export const PROOF_TTL_MS = 30 * 60 * 1000

const sign = (secret, userId, letterId, exp) => createHmac('sha256', secret).update(`${userId}|${letterId}|${exp}`).digest('hex')

export function issueProof(secret, userId, letterId, now = Date.now()) {
  const exp = now + PROOF_TTL_MS
  return `${exp}.${sign(secret, userId, letterId, exp)}`
}

export function verifyProof(secret, userId, letterId, proof, now = Date.now()) {
  if (!secret || typeof proof !== 'string' || proof.length > 200) return false
  const parts = proof.split('.')
  if (parts.length !== 2 || !/^\d{1,15}$/.test(parts[0])) return false
  const exp = Number(parts[0])
  if (exp < now) return false
  const want = Buffer.from(sign(secret, userId, letterId, exp))
  const got = Buffer.from(parts[1])
  return want.length === got.length && timingSafeEqual(want, got)
}
