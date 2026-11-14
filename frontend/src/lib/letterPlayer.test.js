import test from 'node:test'
import assert from 'node:assert/strict'
import { createLetterPlayer } from './letterPlayer.js'

// A fake Audio: records what is playing, lets the test finish or break a clip.
function fakeAudio() {
  const made = []
  class FakeAudio {
    constructor(url) { this.url = url; this.paused = true; made.push(this) }
    play() { if (this.rejectPlay) return Promise.reject(new Error('NotAllowedError')); this.paused = false; return Promise.resolve() }
    pause() { this.paused = true }
  }
  return { FakeAudio, made, playingNow: () => made.filter((a) => !a.paused).length }
}

test('only one clip plays at a time: starting another stops the first', async () => {
  const { FakeAudio, made, playingNow } = fakeAudio()
  const p = createLetterPlayer(FakeAudio)
  p.toggle('alif', '/a.mp3'); await Promise.resolve()
  assert.equal(p.getSnapshot().playing, 'alif'); assert.equal(playingNow(), 1)
  p.toggle('ba', '/b.mp3'); await Promise.resolve()
  assert.equal(p.getSnapshot().playing, 'ba'); assert.equal(playingNow(), 1)
  assert.equal(made[0].paused, true)
})

test('the same button stops its own clip; stop() silences everything', async () => {
  const { FakeAudio, playingNow } = fakeAudio()
  const p = createLetterPlayer(FakeAudio)
  p.toggle('ba', '/b.mp3'); await Promise.resolve()
  p.toggle('ba', '/b.mp3')
  assert.equal(p.getSnapshot().playing, null); assert.equal(playingNow(), 0)
  p.toggle('ta', '/t.mp3'); await Promise.resolve(); p.stop()
  assert.deepEqual([p.getSnapshot().playing, playingNow()], [null, 0])
})

test('a finished clip returns to idle', async () => {
  const { FakeAudio, made } = fakeAudio()
  const p = createLetterPlayer(FakeAudio)
  p.toggle('ba', '/b.mp3'); await Promise.resolve()
  made[0].onended()
  assert.equal(p.getSnapshot().playing, null)
})

test('a missing or unplayable file is marked unavailable and cannot be started again', async () => {
  const { FakeAudio, made } = fakeAudio()
  const p = createLetterPlayer(FakeAudio)
  p.toggle('ba', '/missing.mp3'); await Promise.resolve()
  made[0].onerror()
  assert.deepEqual([p.getSnapshot().playing, p.getSnapshot().failed], [null, ['ba']])
  p.toggle('ba', '/missing.mp3'); assert.equal(made.length, 1)
  // a browser that refuses to play (autoplay rules) also ends in "unavailable", never a stuck "playing"
  class Rejecting extends FakeAudio { constructor(u) { super(u); this.rejectPlay = true } }
  const q = createLetterPlayer(Rejecting)
  q.toggle('ta', '/t.mp3'); await new Promise((r) => setTimeout(r, 0))
  assert.deepEqual([q.getSnapshot().playing, q.getSnapshot().failed], [null, ['ta']])
})

test('listeners are told about every change and can unsubscribe', async () => {
  const { FakeAudio } = fakeAudio()
  const p = createLetterPlayer(FakeAudio); let n = 0
  const off = p.subscribe(() => n++)
  p.toggle('ba', '/b.mp3'); await Promise.resolve(); p.stop()
  assert.ok(n >= 2); off(); const before = n; p.toggle('ta', '/t.mp3'); assert.equal(n, before)
})

test('replay restarts the same letter from the beginning and still never overlaps', async () => {
  const made = []
  class FakeAudio { constructor(u) { this.u = u; this.paused = false; made.push(this) } play() { return Promise.resolve() } pause() { this.paused = true } }
  const { createLetterPlayer } = await import('./letterPlayer.js')
  const p = createLetterPlayer(FakeAudio)
  p.toggle('ba', '/b.mp3'); p.replay('ba', '/b.mp3')
  assert.equal(made.length, 2)
  assert.equal(made[0].paused, true) // the first playback was stopped, not left running
  assert.equal(p.getSnapshot().playing, 'ba')
  p.toggle('ba', '/b.mp3') // the button still stops
  assert.equal(p.getSnapshot().playing, null)
})
