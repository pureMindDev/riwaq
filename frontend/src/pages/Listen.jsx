import { useCallback, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import AsyncMessage from '../components/AsyncMessage.jsx'
import PassageViewer from '../components/PassageViewer.jsx'
import { useChapters } from '../context/Chapters.jsx'
import { usePrefs } from '../hooks/usePrefs.js'
import { prefs } from '../lib/prefs.js'

function SurahList() {
  const ch = useChapters()
  const { lastPosition } = usePrefs()
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const shown = ch.chapters.filter((c) => !term || c.nameSimple.toLowerCase().includes(term) || String(c.id) === term)

  return (
    <>
      <PageHeader title="Listen & Practise" intro="Choose a Surah, follow the text, and listen to a reference recitation." />
      {lastPosition && (
        <section className="card">
          <h2>Continue where you left off</h2>
          <p>{lastPosition.surahName || `Surah ${lastPosition.surah}`}, verse {lastPosition.verse}</p>
          <Link className="btn btn-primary" to={`/listen/${lastPosition.surah}?v=${lastPosition.verse}`}>Continue</Link>
        </section>
      )}
      <AsyncMessage status={ch.status} error={ch.error} onRetry={ch.retry} loadingText="Loading Surahs…" />
      {ch.status === 'success' && (
        <>
          <div className="field">
            <label htmlFor="surah-search">Find a Surah</label>
            <input id="surah-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or number" />
          </div>
          {shown.length === 0 && <p className="muted">No Surah matches &ldquo;{q}&rdquo;.</p>}
          <ul className="surah-list">
            {shown.map((c) => (
              <li key={c.id}>
                <Link to={`/listen/${c.id}`} className="surah-link">
                  <span className="surah-num">{c.id}</span>
                  <span className="surah-names">
                    <strong>{c.nameSimple}</strong>
                    <span className="muted">{c.versesCount} verses</span>
                  </span>
                  <span lang="ar" dir="rtl" translate="no" className="surah-arabic">{c.nameArabic}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="muted"><Link to="/recite">Try Recitation Check (experimental)</Link></p>
    </>
  )
}

function SurahView({ id }) {
  const ch = useChapters()
  const [params] = useSearchParams()
  const start = Number(params.get('v')) || 1
  const chapter = ch.byId(id)
  const onVerse = useCallback(
    (verse) => prefs.setLastPosition({ surah: id, surahName: chapter?.nameSimple, verse }),
    [id, chapter?.nameSimple],
  )

  if (ch.status !== 'success') {
    return <><PageHeader title="Listen & Practise" /><AsyncMessage status={ch.status} error={ch.error} onRetry={ch.retry} /></>
  }
  if (!chapter) {
    return <><PageHeader title="Surah not found" /><p><Link to="/listen">Back to all Surahs</Link></p></>
  }
  return (
    <>
      <p><Link to="/listen">&larr; All Surahs</Link></p>
      <PageHeader title={`${chapter.id}. ${chapter.nameSimple}`} intro={`${chapter.versesCount} verses. Tap a verse to select it, then press Play.`} />
      <PassageViewer surah={id} from={1} to={chapter.versesCount} startVerse={start} onVerseChange={onVerse} />
    </>
  )
}

export default function Listen() {
  const { surah } = useParams()
  if (!surah) return <SurahList />
  const id = Number(surah)
  if (!Number.isInteger(id)) return <PageHeader title="Surah not found" />
  return <SurahView id={id} />
}
