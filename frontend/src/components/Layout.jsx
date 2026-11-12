import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/Auth.jsx'
import { Icon } from './Icons.jsx'

// Only pages that really exist. (Anything else would be a dead link.)
const NAV_ITEMS = [
  { to: '/', label: 'Home', short: 'Home', icon: 'home', end: true },
  { to: '/foundation', label: 'Foundation reading', short: 'Reading', icon: 'book' },
  { to: '/tahfidh', label: 'Tahfidh', short: 'Tahfidh', icon: 'star' },
  { to: '/murajaah', label: 'Muraja’ah', short: 'Muraja’ah', icon: 'repeat' },
  { to: '/listen', label: 'Listen & Practise', short: 'Listen', icon: 'headphones' },
]

// Wide screens: a sidebar. Phones: a top bar with a menu drawer, plus the main pages at the bottom within thumb reach.
export default function Layout() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const menuButton = useRef(null)
  const sidebar = useRef(null)

  // Close the drawer after navigating, and with Escape (returning focus to the menu button).
  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); menuButton.current?.focus() } }
    document.addEventListener('keydown', onKey)
    sidebar.current?.querySelector('a')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  async function signOut() {
    setOpen(false)
    navigate('/')
    await auth.logout()
  }
  const authed = auth.status === 'authed'
  const link = (item, className) => (
    <NavLink key={item.to} to={item.to} end={item.end} className={className}>
      <Icon name={item.icon} /><span>{className === 'bottom-link' ? item.short : item.label}</span>
    </NavLink>
  )

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>

      <header className="topbar">
        <button ref={menuButton} type="button" className="icon-btn" aria-label="Open menu" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen(true)}>
          <Icon name="menu" size={24} />
        </button>
        <Link to="/" className="topbar-brand">Riwaq</Link>
      </header>

      {open && <div className="backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside id="sidebar" ref={sidebar} className={`sidebar${open ? ' open' : ''}`} aria-label="Menu">
        <div className="sidebar-head">
          <Link to="/" className="sidebar-brand">
            <span className="logo-mark" aria-hidden="true">R</span>
            <span><strong>Riwaq</strong><small>Your Qur’an Learning Journey</small></span>
          </Link>
          <button type="button" className="icon-btn sidebar-close" aria-label="Close menu" onClick={() => { setOpen(false); menuButton.current?.focus() }}>
            <Icon name="close" size={22} />
          </button>
        </div>
        <nav className="side-nav" aria-label="Main">
          <p className="side-label">Learning</p>
          {NAV_ITEMS.map((item) => link(item, 'side-link'))}
          <p className="side-label">Account</p>
          {authed
            ? <NavLink to="/settings" className="side-link"><Icon name="settings" /><span>Settings</span></NavLink>
            : <NavLink to="/login" className="side-link"><Icon name="login" /><span>Sign in</span></NavLink>}
        </nav>
        {authed && (
          <div className="sidebar-foot">
            <p className="side-user muted small-print">Signed in as {auth.user.name}</p>
            <button type="button" className="signout-btn" onClick={signOut}><Icon name="logout" /><span>Sign out</span></button>
          </div>
        )}
      </aside>

      <div className="shell-main">
        <main id="main" className="container main"><Outlet /></main>
      </div>

      <nav className="nav-bottom" aria-label="Main (mobile)">
        {NAV_ITEMS.map((item) => link(item, 'bottom-link'))}
      </nav>
    </div>
  )
}
