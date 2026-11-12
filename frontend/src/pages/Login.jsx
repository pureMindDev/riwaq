import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../context/Auth.jsx'

export default function Login() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  if (auth.status === 'authed') return <Navigate to={location.state?.from || '/'} replace />

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await auth.login(form)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageHeader title="Sign in" intro="Your lessons, passages and revision history are saved to your account." />
      <form className="card stack narrow" onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <p className="form-error" role="alert">{error}</p>
        <div><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></div>
        <p>New here? <Link to="/register">Create an account</Link>. You can still <Link to="/listen">listen without one</Link>.</p>
      </form>
    </>
  )
}
