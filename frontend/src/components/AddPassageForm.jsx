import { useState } from 'react'
import SurahRange from './SurahRange.jsx'
import { useChapters } from '../context/Chapters.jsx'
import { api } from '../services/api.js'
import { validateRange } from '../lib/passages.js'

// Adds a passage to the learner's record. `fixedStatus` hides the status choice.
export default function AddPassageForm({ fixedStatus, submitLabel = 'Add passage', onAdded }) {
  const ch = useChapters()
  const [range, setRange] = useState({ surah: '', from: '', to: '' })
  const [status, setStatus] = useState(fixedStatus || 'learning')
  const [message, setMessage] = useState(null) // { type: 'error'|'ok', text }
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const chapter = ch.byId(Number(range.surah))
    const problem = validateRange({ surah: Number(range.surah), from: Number(range.from), to: Number(range.to) }, chapter?.versesCount)
    if (problem) return setMessage({ type: 'error', text: problem })
    setBusy(true)
    try {
      await api.addPassage({ surah: Number(range.surah), from: Number(range.from), to: Number(range.to), status: fixedStatus || status })
      setMessage({ type: 'ok', text: 'Added.' })
      setRange({ surah: range.surah, from: '', to: '' })
      onAdded?.()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <SurahRange value={range} onChange={(v) => { setRange(v); setMessage(null) }} idPrefix={fixedStatus ? 'rev' : 'add'} />
      {!fixedStatus && (
        <fieldset className="field">
          <legend>Where are you with this passage?</legend>
          <label className="radio"><input type="radio" name="status" checked={status === 'learning'} onChange={() => setStatus('learning')} /> I am learning it now</label>
          <label className="radio"><input type="radio" name="status" checked={status === 'memorised'} onChange={() => setStatus('memorised')} /> I already know it by heart (the Muallim will test you when you revise it)</label>
        </fieldset>
      )}
      <div><button type="submit" className="btn btn-primary" disabled={ch.status !== 'success' || busy}>{submitLabel}</button></div>
      <p className={message?.type === 'error' ? 'form-error' : 'form-ok'} role="status" aria-live="polite">{message?.text}</p>
    </form>
  )
}
