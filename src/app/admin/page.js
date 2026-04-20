'use client'
// src/app/admin/page.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import AppShell from '@/components/AppShell'
import { Avatar, RoleBadge, Badge, Alert, Spinner } from '@/components/ui'

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [fetching, setFetching] = useState(true)
  const [alert, setAlert] = useState(null)

  useEffect(() => {
    if (!loading && !user) router.push('/')
    if (!loading && user && user.role !== 'admin') router.push('/dashboard')
  }, [user, loading, router])

  useEffect(() => {
    if (!user || user.role !== 'admin') return
    fetch('/api/users')
      .then(r => r.json())
      .then(d => setUsers(d.users || []))
      .finally(() => setFetching(false))
  }, [user])

  async function toggleActive(u) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: u.is_active ? 'DELETE' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      ...(u.is_active ? {} : { body: JSON.stringify({ is_active: true }) }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(p => p.id === u.id ? { ...p, is_active: !u.is_active } : p))
      setAlert({ type: 'success', msg: `${u.first_name} ${u.last_name} ${u.is_active ? 'deactivated' : 'reactivated'}.` })
    }
  }

  if (loading || !user) return null

  return (
    <AppShell>
      <h1 className="page-title">Admin Panel</h1>
      {alert && <Alert type={alert.type}>{alert.msg}</Alert>}

      {/* Stats row */}
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Users',    value: users.length,                               icon: '◉' },
          { label: 'Active',         value: users.filter(u => u.is_active).length,       icon: '✔' },
          { label: 'With A11y Needs',value: users.filter(u => u.reduce_motion || u.screen_reader_mode || u.font_size_pref === 'xlarge').length, icon: '♿' },
        ].map((s, i) => (
          <div key={s.label} className="stat-card" style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="stat-icon" aria-hidden="true">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <p className="card-title">⚙ All Users</p>
        {fetching ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><Spinner size={32} /></div>
        ) : (
          <div className="table-wrap">
            <table aria-label="All system users">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Role</th>
                  <th scope="col">Department</th>
                  <th scope="col">Tech</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Avatar user={u} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.first_name} {u.last_name}</div>
                          <div style={{ fontSize: '0.76em', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td><RoleBadge role={u.role} /></td>
                    <td style={{ color: 'var(--text2)', fontSize: '0.88em' }}>{u.department || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82em' }}>
                      {'★'.repeat(u.tech_comfort_level)}
                    </td>
                    <td>
                      {u.is_active
                        ? <Badge type="green">Active</Badge>
                        : <Badge type="red">Inactive</Badge>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => router.push(`/profile?id=${u.id}`)}
                          aria-label={`View ${u.first_name}'s profile`}
                        >
                          View
                        </button>
                        <button
                          className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-primary'}`}
                          onClick={() => toggleActive(u)}
                          aria-label={`${u.is_active ? 'Deactivate' : 'Reactivate'} ${u.first_name}`}
                        >
                          {u.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}
