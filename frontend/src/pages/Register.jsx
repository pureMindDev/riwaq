import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../context/Auth.jsx'

export default function Register() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  if (auth.status === 'authed') return <Navigate to="/welcome" replace />

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await auth.register(form)
      navigate('/welcome', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  return (
    <>
      <PageHeader title="Create your account" intro="Free. We use it only to save your progress. Next you will answer a few questions so we can suggest where to begin." />
      <form className="card stack narrow" onSubmit={submit}>
        <div className="field"><label htmlFor="name">Your name</label><input id="name" autoComplete="name" required maxLength={80} value={form.name} onChange={set('name')} /></div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} /></div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={form.password} onChange={set('password')} aria-describedby="pw-hint" />
          <span id="pw-hint" className="muted small-print">At least 8 characters.</span>
        </div>
        <p className="form-error" role="alert">{error}</p>
        <div><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button></div>
        <p>Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </>
  )
}
