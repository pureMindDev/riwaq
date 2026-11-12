import { useEffect, useState, useSyncExternalStore } from 'react'
import { Icon } from './Icons.jsx'
import { letterAudioUrl, loadLetterAudio, letterPlayer } from '../lib/letterAudio.js'

// Plays the recording of one letter. Renders nothing unless a recording is listed, so it is never decorative.
// If the listed file cannot be loaded the button stays visible but disabled and says so.
export default function LetterAudioButton({ id, name }) {
  const [url, setUrl] = useState(null)
  const snap = useSyncExternalStore(letterPlayer.subscribe, letterPlayer.getSnapshot)
  const playing = snap.playing === id
  const failed = snap.failed.includes(id)

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

  if (!url) return null
  const label = failed ? `Recording of ${name} is not available` : playing ? `Stop ${name}` : `Hear ${name}`
  return (
    <button type="button" className={`audio-btn${playing ? ' is-playing' : ''}${failed ? ' is-error' : ''}`}
      onClick={() => letterPlayer.toggle(id, url)} disabled={failed} aria-pressed={failed ? undefined : playing} aria-label={label} title={label}>
      <Icon name={failed ? 'alert' : playing ? 'stop' : 'volume'} size={20} />
    </button>
  )
}
