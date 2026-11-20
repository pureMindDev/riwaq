// Objective checks on one letter recording (needs ffmpeg on the machine). They find recordings that are broken or
// nearly empty: a short pop with no vowel, silence, clipping, a clip that is far too long. They cannot hear whether
// the RIGHT letter is spoken or whether the makhraj is correct; that still needs a qualified listener (`verifiedBy`).
import { spawnSync } from 'node:child_process'

export const SR = 16000
export const LIMITS = { minVoicedSeconds: 0.1, maxSeconds: 3, minPeak: 0.1, maxClippedPercent: 0.5 }

export function ffmpegAvailable() {
  return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0
}

export function decode(path) {
  const p = spawnSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', String(SR), 'pipe:1'], { maxBuffer: 64 * 1024 * 1024 })
  if (p.status !== 0 || !p.stdout?.length) throw new Error('ffmpeg could not decode this file')
  const b = p.stdout
  return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4))
}

// "Voiced" = 10 ms frames at least a fifth as loud as the loudest frame. A pop of one or two frames is not a letter.
export function measure(w) {
  const frame = SR / 100
  const rms = []
  for (let i = 0; i + frame <= w.length; i += frame) {
    let s = 0
    for (let j = i; j < i + frame; j++) s += w[j] * w[j]
    rms.push(Math.sqrt(s / frame))
  }
  const loudest = Math.max(0, ...rms)
  let peak = 0, clipped = 0
  for (const x of w) { const a = Math.abs(x); if (a > peak) peak = a; if (a > 0.99) clipped++ }
  return {
    seconds: w.length / SR,
    voicedSeconds: rms.filter((r) => r >= 0.2 * loudest && loudest > 0).length / 100,
    peak,
    clippedPercent: w.length ? (clipped / w.length) * 100 : 0,
  }
}

export function problemsFor(m, limits = LIMITS) {
  const out = []
  if (m.peak < limits.minPeak) out.push('almost silent')
  else if (m.voicedSeconds < limits.minVoicedSeconds) out.push(`only ${m.voicedSeconds.toFixed(2)} s of actual sound (a pop with no vowel; a letter needs at least ${limits.minVoicedSeconds} s)`)
  if (m.seconds > limits.maxSeconds) out.push(`${m.seconds.toFixed(1)} s long (more than ${limits.maxSeconds} s: trim it to the one letter)`)
  if (m.clippedPercent > limits.maxClippedPercent) out.push(`${m.clippedPercent.toFixed(2)}% of the samples are clipped (distorted)`)
  return out
}

export const assessFile = (path) => { const m = measure(decode(path)); return { ...m, problems: problemsFor(m) } }
