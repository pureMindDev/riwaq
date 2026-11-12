// Small preferences kept on THIS device only (never sent to the server):
// the player's repeat settings, the chosen reciter, and the last verse listened to.
// Learning progress lives on the server, in the learner's account.
export const PREFS_KEY = 'digital-tahfidh:prefs:v1'
const defaults = () => ({ reciterId: null, repeat: 1, autoAdvance: true, lastPosition: null })

export function createPrefs(storage) {
  const listeners = new Set()
  let state = defaults()
  try {
    const raw = storage?.getItem(PREFS_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      state = {
        reciterId: Number.isInteger(data.reciterId) ? data.reciterId : null,
        repeat: [0, 1, 3, 5, 10].includes(data.repeat) ? data.repeat : 1,
        autoAdvance: data.autoAdvance !== false,
        lastPosition: data.lastPosition && Number.isInteger(data.lastPosition.surah) && Number.isInteger(data.lastPosition.verse) ? data.lastPosition : null,
      }
    }
  } catch { state = defaults() } // unreadable preferences are not worth keeping

  const commit = (next) => {
    state = next
    try { storage?.setItem(PREFS_KEY, JSON.stringify(state)) } catch { /* preferences are optional */ }
    listeners.forEach((l) => l())
  }
  return {
    get: () => state,
    subscribe(l) { listeners.add(l); return () => listeners.delete(l) },
    set: (patch) => commit({ ...state, ...patch }),
    setLastPosition(pos) {
      const c = state.lastPosition
      if (!c || c.surah !== pos.surah || c.verse !== pos.verse) commit({ ...state, lastPosition: pos })
    },
    clear: () => commit(defaults()),
  }
}

const safe = (() => {
  try { const s = globalThis.localStorage; s.setItem('__p', '1'); s.removeItem('__p'); return s } catch { return null }
})()
export const prefs = createPrefs(safe)
