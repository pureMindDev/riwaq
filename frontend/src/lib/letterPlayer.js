// One shared player for all letter recordings: only one clip can play at a time, and a clip that fails to load
// is remembered as unavailable. Framework-free so it can be tested with a fake Audio.
export function createLetterPlayer(AudioCtor = globalThis.Audio) {
  let snapshot = { playing: null, failed: [] }
  let audio = null
  const listeners = new Set()
  const set = (next) => { snapshot = { ...snapshot, ...next }; listeners.forEach((l) => l()) }

  function release() {
    if (!audio) return
    audio.onended = audio.onerror = null
    audio.pause()
    audio = null
  }
  const fail = (id) => { release(); set({ playing: null, failed: snapshot.failed.includes(id) ? snapshot.failed : [...snapshot.failed, id] }) }

  return {
    subscribe(l) { listeners.add(l); return () => listeners.delete(l) },
    getSnapshot: () => snapshot,
    stop() { release(); if (snapshot.playing !== null) set({ playing: null }) },
    // Called from a tap/click handler (mobile browsers only allow audio started by a user gesture).
    toggle(id, url) {
      if (snapshot.failed.includes(id)) return
      const wasPlaying = snapshot.playing === id
      release() // always stop whatever is playing first: no overlap
      if (wasPlaying) { set({ playing: null }); return }
      const a = new AudioCtor(url)
      a.preload = 'auto'
      audio = a
      a.onended = () => { if (audio === a) { release(); set({ playing: null }) } }
      a.onerror = () => { if (audio === a) fail(id) }
      set({ playing: id })
      try {
        Promise.resolve(a.play()).catch(() => { if (audio === a) fail(id) })
      } catch { fail(id) }
    },
  }
}
