// Letter pronunciation audio. No recordings ship with the app, and a speech synthesiser is NOT used: it cannot be
// trusted to pronounce Qur'anic letters correctly. Recordings by a qualified reader are listed in
// public/audio/letters/manifest.json (letter id -> file in the same folder), either "ba": "ba.mp3" or
// "ba": { "file": "ba.mp3", "reader": "...", "verifiedBy": "..." } (run `npm run check:audio` to validate it).
// A letter gets a play button only if it is listed, so no button is ever decorative.
const BASE = '/audio/letters/'
let manifest

export function loadLetterAudio() {
  manifest ||= fetch(`${BASE}manifest.json`, { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : {}))
    .then((m) => (m && typeof m === 'object' && !Array.isArray(m) ? m : {}))
    .catch(() => ({}))
  return manifest
}

export const entryFile = (entry) => (typeof entry === 'string' ? entry : entry && typeof entry === 'object' ? entry.file : undefined)
export const letterAudioUrl = (files, id) => {
  const file = entryFile(files?.[id])
  return typeof file === 'string' && /^[\w.-]+$/.test(file) ? BASE + file : null
}

import { createLetterPlayer } from './letterPlayer.js'
export const letterPlayer = createLetterPlayer()
