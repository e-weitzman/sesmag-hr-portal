'use client'
// src/app/dashboard/page.js
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import AppShell from '@/components/AppShell'
import { Badge, RoleBadge } from '@/components/ui'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState([])

  useEffect(() => {
    if (!loading && !user) router.push('/')
  }, [user, loading, router])

  useEffect(() => {
    if (user && (user.role === 'manager' || user.role === 'admin')) {
      fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users || []))
    }
  }, [user])

  if (loading || !user) return null

  const isManager = user.role === 'manager' || user.role === 'admin'

  const stats = [
    { icon: '◉', label: 'Total Employees', value: users.length || 1 },
    { icon: '◈', label: 'Departments', value: new Set(users.map(u => u.department).filter(Boolean)).size || 1 },
    { icon: '♿', label: 'A11y Users', value: users.filter(u => u.reduce_motion || u.screen_reader_mode || u.font_size_pref === 'xlarge').length },
    { icon: '✦', label: 'AI Chat Active', value: 'ON' },
  ]

  return (
    <AppShell>
      <h1 className="page-title">Dashboard</h1>

      {isManager && (
        <div className="grid-3" style={{ marginBottom: '2rem' }}>
          {stats.map((s, i) => (
            <div
              key={s.label} className="stat-card"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div className="stat-icon" aria-hidden="true">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid-2">
        {/* Welcome card */}
        <div className="card">
          <p className="card-title">✦ Welcome</p>
          <p style={{ fontSize: '1.05em', marginBottom: '0.75rem' }}>
            Good to see you, <strong>{user.first_name}</strong>.
          </p>
          <p style={{ color: 'var(--text2)', lineHeight: 1.7, fontSize: '0.9em' }}>
            You're signed in as <strong style={{ color: 'var(--text)' }}>{user.job_title || user.role}</strong>
            {user.department ? ` in ${user.department}` : ''}.
            Use the navigation to explore your HR tools.
          </p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <RoleBadge role={user.role} />
            {user.tech_comfort_level <= 2 && <Badge type="amber">Accessibility Enhanced</Badge>}
          </div>
        </div>

        {/* AI Assistant promo */}
        <div className="card" style={{ borderColor: 'var(--accent)', borderLeftWidth: 3 }}>
          <p className="card-title">✦ AI HR Assistant</p>
          <p style={{ color: 'var(--text2)', lineHeight: 1.7, fontSize: '0.9em', marginBottom: '1rem' }}>
            Your personal HR assistant is powered by Claude AI. Ask about company policies,
            benefits, accessibility features, or anything work-related.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => router.push('/chat')}>
            ✦ Open AI Assistant
          </button>
        </div>

        {/* Current prefs */}
        <div className="card">
          <p className="card-title">⊞ Your Settings</p>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {[
              ['Theme', user.color_theme],
              ['Font Size', user.font_size_pref],
              ['Reduce Motion', user.reduce_motion ? 'On' : 'Off'],
              ['Screen Reader', user.screen_reader_mode ? 'On' : 'Off'],
              ['Tech Level', '★'.repeat(user.tech_comfort_level) + '☆'.repeat(5 - user.tech_comfort_level)],
              ['Language', (user.preferred_language || 'en').toUpperCase()],
            ].map(([k, v]) => (
              <div key={k} style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <dt style={{ fontSize: '0.72em', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{k}</dt>
                <dd style={{ fontWeight: 600, marginTop: '0.15rem', fontFamily: 'var(--font-mono)', fontSize: '0.9em' }}>{v}</dd>
              </div>
            ))}
          </dl>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: '1rem' }} onClick={() => router.push('/accessibility')}>
            ♿ Adjust Accessibility
          </button>
        </div>

        {/* SESMag info */}
        <div className="card">
          <p className="card-title">◈ About SESMag</p>
          <p style={{ color: 'var(--text2)', lineHeight: 1.75, fontSize: '0.9em' }}>
            This portal is built around the <strong style={{ color: 'var(--text)' }}>SESMag framework</strong> —
            ensuring every persona, from DAV (low tech-comfort) to Patricia (expert),
            gets an equally effective experience. All accessibility preferences are
            saved to your profile and applied on every login.
          </p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {['WCAG 2.1 AA', 'Claude AI', 'Neon DB', 'Vercel'].map(t => (
              <Badge key={t} type="blue">{t}</Badge>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
