import { useState } from 'react'
import AsyncMessage from './AsyncMessage.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { api } from '../services/api.js'

// "I have already memorised these Ajza'". The learner's own declaration: it is never marked as verified.
export default function DeclareJuz({ onDone }) {
  const juzs = useAsync(() => api.juzs(), [])
  const [picked, setPicked] = useState(new Set())
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const toggle = (n) => setPicked((s) => { const t = new Set(s); if (t.has(n)) t.delete(n); else t.add(n); return t })

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      const r = await api.declareJuz([...picked])
      setMsg({ ok: true, text: r.created === 0 ? 'These are already in your record.' : `Added ${r.created} passages (${r.verses} verses) to your revision.` })
      setPicked(new Set())
      onDone?.()
    } catch (err) { setMsg({ ok: false, text: err.message }) } finally { setBusy(false) }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <AsyncMessage status={juzs.status} error={juzs.error} onRetry={juzs.retry} loadingText="Loading Ajza’…" />
      {juzs.data && (
        <fieldset className="field">
          <legend>Whole Ajza’ you have memorised</legend>
          <div className="juz-grid">
            {juzs.data.map((j) => (
              <label key={j.juz} className="check juz-check">
                <input type="checkbox" checked={picked.has(j.juz)} onChange={() => toggle(j.juz)} /> Juz {j.juz}
              </label>
            ))}
          </div>
          <button type="button" className="btn btn-link" onClick={() => setPicked(new Set(juzs.data.map((j) => j.juz)))}>Select all</button>
        </fieldset>
      )}
      <p className="muted small-print">This is your own declaration. It is not verified by a recitation check or a teacher. These passages join your daily revision.</p>
      <div><button type="submit" className="btn btn-primary" disabled={picked.size === 0 || busy}>Add to my revision</button></div>
      <p className={msg?.ok ? 'form-ok' : 'form-error'} role="status" aria-live="polite">{msg?.text}</p>
    </form>
  )
}
