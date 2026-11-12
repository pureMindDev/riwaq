import test from 'node:test'
import assert from 'node:assert/strict'
import { createStore, STORAGE_KEY } from './store.js'

const fakeStorage = () => {
  const m = new Map()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), _m: m }
}
const day = (s) => () => new Date(`${s}T12:00:00`)
const base = { surah: 2, surahName: 'Test Surah B', from: 1, to: 5, status: 'learning' }

test('adding a passage persists and survives a reload', () => {
  const storage = fakeStorage()
  const a = createStore(storage, day('2026-10-21'))
  assert.equal(a.addPassage(base, 60).ok, true)
  const b = createStore(storage, day('2026-10-21')) // simulates a page refresh
  assert.equal(b.getState().passages.length, 1)
  assert.equal(b.getState().passages[0].status, 'learning')
})

test('overlapping or invalid passages are rejected', () => {
  const s = createStore(fakeStorage(), day('2026-10-21'))
  s.addPassage(base, 60)
  assert.equal(s.addPassage({ ...base, from: 5, to: 8 }, 60).ok, false) // overlaps verse 5
  assert.equal(s.addPassage({ ...base, from: 6, to: 8 }, 60).ok, true) // adjacent is fine
  assert.equal(s.addPassage({ ...base, from: 9, to: 99 }, 60).ok, false) // beyond the Surah
  assert.equal(s.addPassage({ ...base, from: 9, to: 8 }, 60).ok, false)
  assert.equal(s.getState().passages.length, 2)
})

test('marking memorised creates a schedule due tomorrow and a history entry; never "verified"', () => {
  const s = createStore(fakeStorage(), day('2026-10-21'))
  const { passage } = s.addPassage(base, 60)
  s.markMemorised(passage.id)
  const p = s.getState().passages[0]
  assert.equal(p.status, 'memorised')
  assert.equal(p.schedule.dueDate, '2026-10-22')
  assert.equal(s.getState().sessions[0].type, 'memorise')
})

test('already-memorised passages are due today', () => {
  const s = createStore(fakeStorage(), day('2026-10-21'))
  const { passage } = s.addPassage({ ...base, status: 'memorised' }, 60)
  assert.equal(passage.schedule.dueDate, '2026-10-21')
})

test('revision: difficult flags needs_review; easy later restores memorised', () => {
  const s = createStore(fakeStorage(), day('2026-10-21'))
  const { passage } = s.addPassage({ ...base, status: 'memorised' }, 60)
  s.completeRevision(passage.id, 'difficult')
  assert.equal(s.getState().passages[0].status, 'needs_review')
  assert.equal(s.getState().passages[0].schedule.dueDate, '2026-10-22')
  s.completeRevision(passage.id, 'easy')
  assert.equal(s.getState().passages[0].status, 'memorised')
  assert.equal(s.getState().sessions.filter((x) => x.type === 'revise').length, 2)
})

test('learning passages cannot be revised', () => {
  const s = createStore(fakeStorage(), day('2026-10-21'))
  const { passage } = s.addPassage(base, 60)
  assert.equal(s.completeRevision(passage.id, 'easy'), null)
})

test('the learner can change a due date', () => {
  const s = createStore(fakeStorage(), day('2026-10-21'))
  const { passage } = s.addPassage({ ...base, status: 'memorised' }, 60)
  s.setDueDate(passage.id, '2026-11-01')
  assert.equal(s.getState().passages[0].schedule.dueDate, '2026-11-01')
})

test('unreadable saved data is backed up, not destroyed', () => {
  const storage = fakeStorage()
  storage.setItem(STORAGE_KEY, '{not json')
  const s = createStore(storage)
  assert.equal(s.getStorageStatus(), 'recovered')
  assert.equal(storage.getItem(`${STORAGE_KEY}:unreadable-backup`), '{not json')
})

test('a failing save is reported, and in-memory state still works', () => {
  const storage = fakeStorage()
  storage.setItem = () => { throw new Error('quota') }
  const s = createStore(storage)
  s.addPassage(base, 60)
  assert.equal(s.getStorageStatus(), 'save-failed')
  assert.equal(s.getState().passages.length, 1)
})

test('without any storage the store still works and says so', () => {
  const s = createStore(null)
  assert.equal(s.getStorageStatus(), 'unavailable')
  assert.equal(s.addPassage(base, 60).ok, true)
})

test('setStatus moves between statuses without duplicating records', () => {
  const s = createStore(fakeStorage(), day('2026-10-21'))
  const { passage } = s.addPassage(base, 60)
  s.setStatus(passage.id, 'memorised')
  assert.equal(s.getState().passages[0].schedule.dueDate, '2026-10-22')
  s.setStatus(passage.id, 'needs_review')
  assert.equal(s.getState().passages[0].status, 'needs_review')
  s.setStatus(passage.id, 'memorised')
  assert.equal(s.getState().passages[0].status, 'memorised')
  s.setStatus(passage.id, 'learning')
  assert.equal(s.getState().passages[0].schedule, null)
  assert.equal(s.getState().passages.length, 1)
})

test('learning -> needs_review gets a schedule due today', () => {
  const s = createStore(fakeStorage(), day('2026-10-21'))
  const { passage } = s.addPassage(base, 60)
  s.setStatus(passage.id, 'needs_review')
  assert.equal(s.getState().passages[0].schedule.dueDate, '2026-10-21')
})

test('passage resume position is stored only inside its range', () => {
  const s = createStore(fakeStorage(), day('2026-10-21'))
  const { passage } = s.addPassage(base, 60) // verses 1-5
  s.setPassagePosition(passage.id, 3)
  assert.equal(s.getState().passages[0].lastVerse, 3)
  s.setPassagePosition(passage.id, 9)
  assert.equal(s.getState().passages[0].lastVerse, 3)
})

test('export then import restores everything; bad backups are refused without changing data', () => {
  const a = createStore(fakeStorage(), day('2026-10-21'))
  const { passage } = a.addPassage({ ...base, status: 'memorised' }, 60)
  a.completeRevision(passage.id, 'easy')
  const backup = a.exportJson()
  const b = createStore(fakeStorage(), day('2026-10-21'))
  assert.equal(b.importJson(backup).ok, true)
  assert.equal(b.getState().passages.length, 1)
  assert.equal(b.getState().sessions.length, 1)
  assert.equal(b.importJson('nope').ok, false)
  assert.equal(b.importJson(JSON.stringify({ version: 1, passages: [{ id: 'x' }], sessions: [] })).ok, false)
  const overlap = { version: 1, sessions: [], passages: [
    { id: 'a', surah: 1, from: 1, to: 3, status: 'learning' }, { id: 'b', surah: 1, from: 3, to: 5, status: 'learning' }] }
  assert.equal(b.importJson(JSON.stringify(overlap)).ok, false)
  assert.equal(b.getState().passages.length, 1)
})
