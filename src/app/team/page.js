'use client'
// src/app/team/page.js
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import AppShell from '@/components/AppShell'
import { Avatar, RoleBadge, Badge, Spinner } from '@/components/ui'

export default function TeamPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [fetching, setFetching] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [aiSearch, setAiSearch] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/')
    if (!loading && user && user.role === 'employee') router.push('/dashboard')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    fetch('/api/users')
      .then(r => r.json())
      .then(d => setUsers(d.users || []))
      .finally(() => setFetching(false))
  }, [user])

  const depts = [...new Set(users.map(u => u.department).filter(Boolean))].sort()

  const filtered = users.filter(u => {
    const name = `${u.first_name} ${u.last_name}`.toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase()) || u.email?.includes(search.toLowerCase())
    const matchDept = !deptFilter || u.department === deptFilter
    return matchSearch && matchDept
  })

  async function runAISearch() {
    if (!aiSearch.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai-middleware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'smart-search', q: aiSearch }),
      })
      const filters = await res.json()
      if (filters.name) setSearch(filters.name)
      if (filters.department) setDeptFilter(filters.department)
    } catch {}
    setAiLoading(false)
  }

  if (loading || !user) return null

  return (
    <AppShell>
      <h1 className="page-title">Team Directory</h1>

      {/* AI smart search */}
      <div className="card" style={{ marginBottom: '1.25rem', borderColor: 'var(--accent)', borderLeftWidth: 3 }}>
        <p className="card-title">✦ AI Smart Search</p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            className="form-input" style={{ flex: 1, minWidth: 200 }}
            placeholder='e.g. "engineers in product" or "find patricia"'
            value={aiSearch}
            onChange={e => setAiSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runAISearch()}
          />
          <button className="btn btn-primary" onClick={runAISearch} disabled={aiLoading || !aiSearch.trim()}>
            {aiLoading ? <Spinner size={16} /> : '✦ Search'}
          </button>
          {(search || deptFilter) && (
            <button className="btn btn-secondary" onClick={() => { setSearch(''); setDeptFilter(''); setAiSearch('') }}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {/* Manual filters */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
            <label className="form-label" htmlFor="search-input">Search by name</label>
            <input
              id="search-input" className="form-input" type="search"
              placeholder="Name or email…" value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ minWidth: 180, marginBottom: 0 }}>
            <label className="form-label" htmlFor="dept-select">Department</label>
            <select
              id="dept-select" className="form-input form-select"
              value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            >
              <option value="">All Departments</option>
              {depts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {fetching ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>
            <Spinner size={32} />
          </div>
        ) : (
          <div className="table-wrap" role="region" aria-label="Team directory">
            <table aria-label="Team members">
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Role</th>
                  <th scope="col">Department</th>
                  <th scope="col">Tech Level</th>
                  <th scope="col">A11y</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Avatar user={u} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.first_name} {u.last_name}</div>
                          <div style={{ fontSize: '0.78em', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><RoleBadge role={u.role} /></td>
                    <td style={{ color: 'var(--text2)' }}>{u.department || '—'}</td>
                    <td aria-label={`Tech comfort ${u.tech_comfort_level} of 5`} style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                      {'★'.repeat(u.tech_comfort_level)}{'☆'.repeat(5 - u.tech_comfort_level)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {u.font_size_pref === 'xlarge'      && <Badge type="amber">XL Font</Badge>}
                        {u.color_theme === 'high-contrast'  && <Badge type="yellow">Hi-Contrast</Badge>}
                        {u.reduce_motion                    && <Badge type="blue">Low Motion</Badge>}
                        {u.screen_reader_mode               && <Badge type="green">Screen Reader</Badge>}
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => router.push(`/profile?id=${u.id}`)}
                        aria-label={`View ${u.first_name} ${u.last_name}'s profile`}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: '2.5rem' }}>
                      No team members found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}
