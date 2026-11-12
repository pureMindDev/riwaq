import { useEffect, useRef, useState } from 'react'

// Plays ONE verse at a time. Never autoplays on page load: audio only starts
// after the learner presses a button (or continues a playback they started).
export default function Player({ url, verseLabel, hasPrev, hasNext, onPrev, onNext, repeat, autoAdvance, onSettings, disabledReason }) {
  const audioRef = useRef(null)
  const autoplayRef = useRef(false)
  const playsDone = useRef(0)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  // Load the new verse's audio whenever the URL changes.
  useEffect(() => {
    const a = audioRef.current
    playsDone.current = 0
    setFailed(false)
    if (!url) {
      a.removeAttribute('src')
      a.load()
      setPlaying(false)
      setLoading(false)
      return
    }
    a.src = url
    a.load()
    setLoading(true)
    if (autoplayRef.current) {
      autoplayRef.current = false
      a.play().catch(() => setPlaying(false))
    }
  }, [url])

  function toggle() {
    const a = audioRef.current
    if (failed) {
      setFailed(false)
      setLoading(true)
      a.load()
      return
    }
    if (a.paused) a.play().catch(() => setPlaying(false))
    else a.pause()
  }

  function replay() {
    const a = audioRef.current
    playsDone.current = 0
    a.currentTime = 0
    a.play().catch(() => setPlaying(false))
  }

  function go(fn) {
    autoplayRef.current = playing // keep playing only if it was already playing
    fn()
  }

  function ended() {
    const a = audioRef.current
    playsDone.current += 1
    if (repeat === 0 || playsDone.current < repeat) {
      a.currentTime = 0
      a.play().catch(() => setPlaying(false))
      return
    }
    playsDone.current = 0
    if (autoAdvance && hasNext) {
      autoplayRef.current = true
      onNext()
    } else {
      setPlaying(false)
    }
  }

  const disabled = !url
  let status = ''
  if (disabledReason) status = disabledReason
  else if (failed) status = 'This audio could not be loaded. Press “Try again”.'
  else if (loading) status = 'Loading audio…'
  else if (playing) status = `Playing ${verseLabel}`

  return (
    <div className="player" role="group" aria-label="Audio player">
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onPlaying={() => setLoading(false)}
        onError={() => { if (audioRef.current?.getAttribute('src')) { setFailed(true); setLoading(false); setPlaying(false) } }}
        onEnded={ended}
      />
      <p className="player-status" role="status" aria-live="polite">{status || verseLabel}</p>
      <div className="player-buttons">
        <button type="button" className="btn btn-secondary" aria-label="Previous verse" onClick={() => go(onPrev)} disabled={!hasPrev}>Prev</button>
        <button type="button" className="btn btn-primary" onClick={toggle} disabled={disabled}>
          {failed ? 'Try again' : playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={replay} disabled={disabled}>Replay</button>
        <button type="button" className="btn btn-secondary" aria-label="Next verse" onClick={() => go(onNext)} disabled={!hasNext}>Next</button>
      </div>
      <details className="player-more">
        <summary>Repeat &amp; options{repeat !== 1 ? ` (repeat ${repeat === 0 ? 'until stopped' : `${repeat}×`})` : ''}</summary>
        <div className="player-options">
          <label>
            Repeat each verse{' '}
            <select value={repeat} onChange={(e) => onSettings({ repeat: Number(e.target.value) })}>
              <option value={1}>Play once</option>
              <option value={3}>3 times</option>
              <option value={5}>5 times</option>
              <option value={10}>10 times</option>
              <option value={0}>Until I stop</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={autoAdvance} onChange={(e) => onSettings({ autoAdvance: e.target.checked })} />
            Continue to the next verse
          </label>
        </div>
      </details>
    </div>
  )
}
