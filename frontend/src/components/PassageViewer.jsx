import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../services/api.js'
import { useAsync } from '../hooks/useAsync.js'
import { usePrefs } from '../hooks/usePrefs.js'
import { prefs } from '../lib/prefs.js'
import AsyncMessage from './AsyncMessage.jsx'
import Attribution from './Attribution.jsx'
import Player from './Player.jsx'
import QuranText from './QuranText.jsx'

// Shows the verses of a passage with audio. Used by Listen, Tahfidh and Muraja'ah.
export default function PassageViewer({ surah, from, to, startVerse, onVerseChange, allowHideText = false }) {
  const settings = usePrefs()
  const [index, setIndex] = useState(0)
  const [hidden, setHidden] = useState(false)
  const activeRef = useRef(null)
  const moved = useRef(false)

  const verses = useAsync(() => api.verses(surah, from, to), [surah, from, to])
  const reciters = useAsync(() => api.reciters(), [])

  const list = verses.data?.verses
  // Jump to the requested starting verse once, when the verses arrive. Until then we must not
  // report a position, or we would overwrite the learner's saved place with verse 1.
  const startRef = useRef(startVerse)
  startRef.current = startVerse
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!list) { setReady(false); return }
    const i = list.findIndex((v) => v.verseNumber === startRef.current)
    setIndex(i >= 0 ? i : 0)
    setReady(true)
  }, [list])

  // Choose the reciter: the saved one if it exists, otherwise the first available (and say so).
  const reciterList = reciters.data
  const saved = reciterList?.find((r) => r.id === settings.reciterId)
  // Reciters from the second source (ids from 100001) cover the Surahs the first source does not serve.
  const otherSource = reciterList?.find((r) => r.id >= 100001)
  const [switched, setSwitched] = useState(false)
  useEffect(() => { setSwitched(false) }, [surah])
  const reciter = (switched && otherSource) || saved || reciterList?.[0]
  const usingFallback = Boolean(reciterList && settings.reciterId && !saved && reciter && !switched)

  const audio = useAsync(() => api.audio(surah, reciter.id), [surah, reciter?.id], { enabled: Boolean(reciter) })
  useEffect(() => { if (audio.status === 'error' && reciter && reciter.id < 100001 && otherSource) setSwitched(true) }, [audio.status, reciter, otherSource])
  const urlByKey = useMemo(() => new Map((audio.data || []).map((a) => [a.verseKey, a.url])), [audio.data])

  const current = list?.[index]
  useEffect(() => {
    if (!ready || !current) return
    if (onVerseChange) onVerseChange(current.verseNumber)
    if (moved.current) activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [ready, current, onVerseChange])

  if (verses.status !== 'success') {
    return <AsyncMessage status={verses.status} error={verses.error} onRetry={verses.retry} loadingText="Loading verses…" />
  }

  const select = (i) => { moved.current = true; setIndex(i) }
  let audioProblem = null
  if (reciters.status === 'error') audioProblem = <AsyncMessage status="error" error={reciters.error} onRetry={reciters.retry} />
  else if (audio.status === 'error') audioProblem = <AsyncMessage status="error" error={audio.error} onRetry={audio.retry} />
  const url = current ? urlByKey.get(current.verseKey) : null
  const audioLoading = reciters.status === 'loading' || audio.status === 'loading'
  let disabledReason = null
  if (audioLoading) disabledReason = 'Loading recitation…'
  else if (!audioProblem && current && !url) disabledReason = 'No audio is available for this verse.'

  return (
    <div className="viewer">
      <div className="viewer-tools">
        {reciterList && reciterList.length > 0 && (
          <div className="field">
            <label htmlFor="viewer-reciter">Reciter</label>
            <select id="viewer-reciter" value={reciter?.id ?? ''} onChange={(e) => { setSwitched(false); prefs.set({ reciterId: Number(e.target.value) }) }}>
              {reciterList.map((r) => <option key={r.id} value={r.id}>{r.name}{r.style ? ` (${r.style})` : ''}</option>)}
            </select>
          </div>
        )}
        <div className="actions">
          {allowHideText && (
            <button type="button" className="btn btn-secondary" aria-pressed={hidden} onClick={() => setHidden(!hidden)}>
              {hidden ? 'Show the text' : 'Hide the text (recite from memory)'}
            </button>
          )}
          {index > 0 && <button type="button" className="btn btn-secondary" onClick={() => select(0)}>Back to first verse</button>}
        </div>
        <p className="muted small-print">Text: Uthmani script. Recitation: {reciter ? reciter.name : 'loading…'}.</p>
      </div>
      <ol className="verse-list" aria-label="Verses">
        {list.map((v, i) => (
          <li key={v.verseKey}>
            <button
              type="button"
              ref={i === index ? activeRef : null}
              className={`verse ${i === index ? 'verse-active' : ''}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => select(i)}
            >
              <span className="verse-number">{v.verseNumber}</span>
              {hidden ? <span className="muted">Verse {v.verseNumber} (hidden)</span> : <QuranText>{v.textUthmani}</QuranText>}
            </button>
          </li>
        ))}
      </ol>

      {usingFallback && <p className="status-note" role="note">Your saved reciter isn&rsquo;t available, so {reciter.name} is shown instead.</p>}
      {audioProblem}
      <Attribution reciterName={reciter?.name} />

      <div className="player-bar">
        <Player
          url={url || null}
          verseLabel={`${verses.data.chapter.nameSimple} · verse ${current?.verseNumber}`}
          hasPrev={index > 0}
          hasNext={index < list.length - 1}
          onPrev={() => select(index - 1)}
          onNext={() => select(index + 1)}
          repeat={settings.repeat}
          autoAdvance={settings.autoAdvance}
          onSettings={prefs.set}
          disabledReason={disabledReason}
        />
      </div>
    </div>
  )
}
