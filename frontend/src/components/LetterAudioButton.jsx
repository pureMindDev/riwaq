import { useEffect, useState, useSyncExternalStore } from 'react'
import { Icon } from './Icons.jsx'
import { letterAudioUrl, loadLetterAudio, letterPlayer } from '../lib/letterAudio.js'

// State of one letter's recording. `url` is null when no recording is listed (then nothing audio-related is shown).
export function useLetterAudio(id) {
  const [url, setUrl] = useState(null)
  const snap = useSyncExternalStore(letterPlayer.subscribe, letterPlayer.getSnapshot)
  useEffect(() => {
    let live = true
    loadLetterAudio().then((files) => { if (live) setUrl(letterAudioUrl(files, id)) })
    return () => { live = false; if (letterPlayer.getSnapshot().playing === id) letterPlayer.stop() }
  }, [id])
  // Silence the recording when the tab/app goes to the background (phones).
  useEffect(() => {
    const hide = () => { if (document.hidden) letterPlayer.stop() }
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [])
  return { url, playing: snap.playing === id, failed: snap.failed.includes(id) }
}

// Play / stop button for one letter. Renders nothing unless a recording is listed, so it is never decorative.
// If the listed file cannot be loaded the button stays visible but disabled and says so.
export default function LetterAudioButton({ id, name }) {
  const { url, playing, failed } = useLetterAudio(id)
  if (!url) return null
  const label = failed ? `Recording of ${name} is not available` : playing ? `Stop ${name}` : `Hear ${name}`
  return (
    <button type="button" className={`audio-btn${playing ? ' is-playing' : ''}${failed ? ' is-error' : ''}`}
      onClick={() => letterPlayer.toggle(id, url)} disabled={failed} aria-pressed={failed ? undefined : playing} aria-label={label} title={label}>
      <Icon name={failed ? 'alert' : playing ? 'stop' : 'volume'} size={20} />
      {failed && <span className="sr-only">{label}</span>}
    </button>
  )
}

// The big letter itself. When a recording exists, tapping it plays it again from the start (replay); otherwise
// it is plain text. Same recording as the button next to the letter name: one letter, one recording.
export function LetterGlyph({ id, name, children }) {
  const { url, playing, failed } = useLetterAudio(id)
  if (!url || failed) return children
  return (
    <button type="button" className={`glyph-btn${playing ? ' is-playing' : ''}`} onClick={() => letterPlayer.replay(id, url)}
      aria-label={`${playing ? 'Replay' : 'Hear'} ${name}`} title={`${playing ? 'Replay' : 'Hear'} ${name}`}>
      {children}
    </button>
  )
}

// Attribution required by the recordings' licences (CC BY / CC BY-SA / GFDL). Shown only when recordings are listed.
export function AudioCredit() {
  const [on, setOn] = useState(false)
  useEffect(() => { let live = true; loadLetterAudio().then((f) => { if (live) setOn(Object.keys(f).length > 0) }); return () => { live = false } }, [])
  if (!on) return null
  return (
    <p className="muted small-print audio-credit">
      Letter names are spoken by native Arabic speakers (Lingua Libre, via Wikimedia Commons; CC0, CC BY and CC BY-SA; Bā&rsquo; is a temporary clip from a recording by Ibraheem alex, GFDL 1.2+). They say the letter&rsquo;s name and are not Tajweed-checked.{' '}
      <a href="/audio/letters/CREDITS.txt" target="_blank" rel="noreferrer">Credits and licences</a>
    </p>
  )
}
