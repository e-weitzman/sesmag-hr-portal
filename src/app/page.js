'use client'
// src/app/page.js — Login page
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Alert, Spinner } from '@/components/ui'

const DEMO_ACCOUNTS = [
  { label: 'Admin',            username: 'admin',       hint: 'Full access' },
  { label: 'Patricia (Mgr)',   username: 'patricia_m',  hint: 'Team view + change log' },
  { label: 'DAV Persona',      username: 'dav_persona', hint: 'High-contrast · XL font' },
  { label: 'Tim (Mobile)',     username: 'tim_c',       hint: 'Large font · basic user' },
  { label: 'Abi (A11y)',       username: 'abi_k',       hint: 'Screen reader · contrast' },
  { label: 'Gary (Low-tech)',  username: 'gary_w',      hint: 'XL font · reduce motion' },
]

export default function LoginPage() {
  const { user, login } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) router.push('/dashboard')
  }, [user, router])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.username, form.password)
      router.push('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Left decorative panel */}
      <div className="login-left" aria-hidden="true">
        <div className="login-left-deco" />
        <div className="login-left-content">
          <div className="login-left-title">
            People-first HR,<br />
            built for everyone.
          </div>
          <p className="login-left-sub">
            The SESMag HR Portal is designed to serve every user equally —
            from beginners to power users — with built-in accessibility and
            an AI assistant to help you every step of the way.
          </p>
          <div style={{
            marginTop: '2.5rem',
            display: 'flex', flexDirection: 'column', gap: '0.6rem',
          }}>
            {['High-contrast & dark modes', 'Adjustable font sizes (87%–145%)',
              'Reduce motion support', 'Screen reader optimized',
              'AI HR assistant powered by Claude'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88em', opacity: 0.8 }}>
                <span style={{ color: 'var(--accent)', fontSize: '0.9em' }}>✦</span> {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="login-right">
        <div className="login-box">
          <div style={{ marginBottom: '0.5rem', fontSize: '0.8em', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            SESMag · HR Portal
          </div>
          <h1 className="login-heading">Welcome back.</h1>
          <p className="login-sub">Sign in to your HR account</p>

          {error && <Alert type="error">{error}</Alert>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <input
                id="username" type="text" className="form-input"
                value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                autoComplete="username" required aria-required="true"
                placeholder="Enter your username"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password" type="password" className="form-input"
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                autoComplete="current-password" required aria-required="true"
                placeholder="Enter your password"
              />
            </div>
            <button
              type="submit" className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? <Spinner size={16} /> : null}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Demo accounts */}
          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.72em', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.6rem' }}>
              Demo accounts — password: <code style={{ fontFamily: 'var(--font-mono)' }}>Password1!</code>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {DEMO_ACCOUNTS.map(d => (
                <button
                  key={d.username}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'space-between' }}
                  onClick={() => setForm({ username: d.username, password: 'Password1!' })}
                >
                  <span style={{ fontWeight: 600 }}>{d.label}</span>
                  <span style={{ fontSize: '0.8em', color: 'var(--text3)' }}>{d.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
