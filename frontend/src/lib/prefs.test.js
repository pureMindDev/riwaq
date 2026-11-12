import test from 'node:test'
import assert from 'node:assert/strict'
import { createPrefs, PREFS_KEY } from './prefs.js'

const fake = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } }

test('defaults, and settings survive a reload', () => {
  const st = fake()
  const a = createPrefs(st)
  assert.deepEqual(a.get(), { reciterId: null, repeat: 1, autoAdvance: true, lastPosition: null })
  a.set({ repeat: 3, reciterId: 7 })
  a.setLastPosition({ surah: 2, surahName: 'x', verse: 5 })
  const b = createPrefs(st)
  assert.deepEqual([b.get().repeat, b.get().reciterId, b.get().lastPosition.verse], [3, 7, 5])
})

test('unreadable or tampered preferences fall back to defaults', () => {
  const st = fake()
  st.setItem(PREFS_KEY, '{nope')
  assert.equal(createPrefs(st).get().repeat, 1)
  st.setItem(PREFS_KEY, JSON.stringify({ repeat: 999, reciterId: 'x', lastPosition: { surah: 'a' } }))
  assert.deepEqual(createPrefs(st).get(), { reciterId: null, repeat: 1, autoAdvance: true, lastPosition: null })
})

test('works without any storage', () => {
  const p = createPrefs(null)
  p.set({ repeat: 5 })
  assert.equal(p.get().repeat, 5)
})
