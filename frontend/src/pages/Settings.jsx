import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import AsyncMessage from '../components/AsyncMessage.jsx'
import Attribution from '../components/Attribution.jsx'
import { useAuth } from '../context/Auth.jsx'
import { useChapters } from '../context/Chapters.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { usePrefs } from '../hooks/usePrefs.js'
import { api } from '../services/api.js'
import { prefs } from '../lib/prefs.js'

export default function Settings() {
  const auth = useAuth()
  const navigate = useNavigate()
  const chapters = useChapters()
  const reciters = useAsync(() => api.reciters(), [])
  const pref = usePrefs()
  const s = auth.student
  const [programme, setProgramme] = useState(s.programme)
  const [form, setForm] = useState({ newVerses: s.dailyTarget.newVerses, revisionVerses: s.dailyTarget.revisionVerses, direction: s.tahfidhPlan.direction, surah: String(s.tahfidhPlan.start.surah), verse: String(s.tahfidhPlan.start.verse) })
  const [msg, setMsg] = useState(null)
  useEffect(() => { setProgramme(s.programme) }, [s.programme])

  async function save(e) {
    e.preventDefault()
    setMsg(null)
    try {
      if (programme !== s.programme) await api.setProgramme(programme)
      const body = { newVerses: Number(form.newVerses), revisionVerses: Number(form.revisionVerses), direction: form.direction }
      if (startValid) body.start = { surah: Number(form.surah), verse: Number(form.verse) || 1 }
      await api.updateSettings(body)
      await auth.refresh()
      setMsg({ ok: true, text: 'Saved. Today’s plan updates the next time you open Home.' })
    } catch (err) { setMsg({ ok: false, text: err.message }) }
  }
  // Go home first: once signed out, this page's sign-in guard would otherwise send people to /login.
  async function signOut() { navigate('/'); await auth.logout() }
  async function remove() {
    if (!window.confirm('Delete your account and ALL your progress, history and settings? This cannot be undone.')) return
    navigate('/')
    await auth.deleteAccount()
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  // The saved starting Surah may not be one the provider currently offers: then show an explicit choice.
  const startValid = chapters.status === 'success' && Boolean(chapters.byId(Number(form.surah)))

  return (
    <>
      <PageHeader title="Settings" />
      <section className="card" aria-labelledby="acct">
        <h2 id="acct">Account</h2>
        <p>{auth.user.name} · {auth.user.email}</p>
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={signOut}>Sign out</button>
          <button type="button" className="btn btn-link" onClick={remove}>Delete my account and data</button>
        </div>
      </section>

      <form className="card stack" id="programme" onSubmit={save} aria-labelledby="prog">
        <h2 id="prog">Programme and daily targets</h2>
        <fieldset className="field">
          <legend>Your programme</legend>
          {[['foundation', 'Foundation reading'], ['tahfidh', 'Tahfidh (memorisation with revision)'], ['murajaah_only', 'Muraja’ah only (for Hafiz / Hafidah)']].map(([v, l]) => (
            <label key={v} className="radio"><input type="radio" name="programme" checked={programme === v} onChange={() => setProgramme(v)} /> {l}</label>
          ))}
          <span className="muted small-print">Switching never deletes your progress.</span>
        </fieldset>
        <div className="range-fields">
          <div className="field"><label htmlFor="nv">New verses per day (Tahfidh)</label><input id="nv" type="number" min="1" max="20" value={form.newVerses} onChange={set('newVerses')} /></div>
          <div className="field"><label htmlFor="rv">Revision verses per day (Muraja’ah only)</label><input id="rv" type="number" min="10" max="600" value={form.revisionVerses} onChange={set('revisionVerses')} /></div>
        </div>
        {chapters.status === 'success' && (
          <div className="range-fields">
            <div className="field"><label htmlFor="ss">Next new passage starts in</label>
              <select id="ss" value={startValid ? form.surah : ''} onChange={(e) => setForm({ ...form, surah: e.target.value, verse: '1' })}>
                {!startValid && <option value="">Choose a Surah…</option>}
                {chapters.chapters.map((c) => <option key={c.id} value={c.id}>{c.id}. {c.nameSimple}</option>)}
              </select></div>
            <div className="field"><label htmlFor="sv">From verse</label><input id="sv" type="number" min="1" value={form.verse} onChange={set('verse')} /></div>
          </div>
        )}
        <p className="muted small-print">The starting point is used only until your first assigned passage; after that the plan continues from where you finished.</p>
        <fieldset className="field">
          <legend>New passages continue</legend>
          <label className="radio"><input type="radio" name="dir" checked={form.direction === 'descending'} onChange={() => setForm({ ...form, direction: 'descending' })} /> Towards the beginning (Surah numbers going down)</label>
          <label className="radio"><input type="radio" name="dir" checked={form.direction === 'ascending'} onChange={() => setForm({ ...form, direction: 'ascending' })} /> Towards the end (Surah numbers going up)</label>
        </fieldset>
        <p className={msg?.ok ? 'form-ok' : 'form-error'} role="status" aria-live="polite">{msg?.text}</p>
        <div><button type="submit" className="btn btn-primary">Save</button></div>
      </form>

      <section className="card" aria-labelledby="reciter">
        <h2 id="reciter">Reciter (this device)</h2>
        <AsyncMessage status={reciters.status} error={reciters.error} onRetry={reciters.retry} loadingText="Loading reciters…" />
        {reciters.status === 'success' && (
          <div className="field">
            <label htmlFor="reciter-select">Reference recitation</label>
            <select id="reciter-select" value={pref.reciterId ?? ''} onChange={(e) => prefs.set({ reciterId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">First available</option>
              {reciters.data.map((r) => <option key={r.id} value={r.id}>{r.name}{r.style ? ` (${r.style})` : ''}</option>)}
            </select>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="privacy">
        <h2 id="privacy">Your data and privacy</h2>
        <p>Your progress is saved to your account on this site’s server, so it follows you to other devices. Passwords are stored only as salted hashes. You can delete your account and all your data above.</p>
        <p>Recordings made in Recitation Check stay in your browser unless you choose to analyse them. If analysis is available and you choose it, the recording is sent to the recognition service only for that analysis. Recordings are never stored; only the outcome of a check is saved.</p>
        <p>The reciter, repeat settings and last listening position are kept on this device only.</p>
      </section>
      <Attribution />
    </>
  )
}
