import { useChapters } from '../context/Chapters.jsx'
import AsyncMessage from './AsyncMessage.jsx'

// Choose a Surah and a verse range. Controlled: value = { surah, from, to } (strings allowed while typing).
export default function SurahRange({ value, onChange, idPrefix = 'range' }) {
  const ch = useChapters()
  if (ch.status !== 'success') {
    return <AsyncMessage status={ch.status} error={ch.error} onRetry={ch.retry} loadingText="Loading Surahs…" />
  }
  const chapter = ch.byId(Number(value.surah))
  const set = (patch) => onChange({ ...value, ...patch })

  return (
    <div className="range-fields">
      <div className="field">
        <label htmlFor={`${idPrefix}-surah`}>Surah</label>
        <select
          id={`${idPrefix}-surah`}
          value={value.surah}
          onChange={(e) => {
            const c = ch.byId(Number(e.target.value))
            set({ surah: e.target.value, from: c ? '1' : '', to: c ? String(c.versesCount) : '' })
          }}
        >
          <option value="">Choose a Surah…</option>
          {ch.chapters.map((c) => (
            <option key={c.id} value={c.id}>{c.id}. {c.nameSimple}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-from`}>From verse</label>
        <input id={`${idPrefix}-from`} type="number" inputMode="numeric" min="1" max={chapter?.versesCount}
          value={value.from} onChange={(e) => set({ from: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-to`}>To verse</label>
        <input id={`${idPrefix}-to`} type="number" inputMode="numeric" min="1" max={chapter?.versesCount}
          value={value.to} onChange={(e) => set({ to: e.target.value })} />
      </div>
      {chapter && <p className="muted field-hint">This Surah has {chapter.versesCount} verses.</p>}
    </div>
  )
}
