'use client'
// src/app/profile/page.js
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import AppShell from '@/components/AppShell'
import { Avatar, RoleBadge, Badge, Alert } from '@/components/ui'

// useSearchParams() MUST live inside a Suspense boundary — isolated here
function ProfileContent() {
  const { user, loading, updateUser } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const targetId = searchParams.get('id')

  const [profile, setProfile] = useState(null)
  const [changes, setChanges] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)

  useEffect(() => {
    if (!loading && !user) router.push('/')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    const id = targetId || user.id
    fetch(`/api/users/${id}`)
      .then(r => r.json())
      .then(d => { if (d.user) setProfile(d.user) })
  }, [user, targetId])

  useEffect(() => {
    if (!profile || !user) return
    const isManager = user.role === 'manager' || user.role === 'admin'
    if (isManager) {
      fetch(`/api/users/${profile.id}/changes`)
        .then(r => r.json())
        .then(d => setChanges(d.changes || []))
    }
  }, [profile, user])

  function startEdit() {
    setForm({
      first_name: profile.first_name,
      last_name: profile.last_name,
      pronouns: profile.pronouns || '',
      phone: profile.phone || '',
      bio: profile.bio || '',
      department: profile.department || '',
      job_title: profile.job_title || '',
    })
    setEditing(true)
  }

  async function saveProfile() {
    setSaving(true)
    setAlert(null)
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: profile.id, ...form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProfile(data.user)
      if (profile.id === user.id) updateUser(data.user)
      setEditing(false)
      setAlert({ type: 'success', msg: data.note || 'Profile updated successfully.' })
    } catch (err) {
      setAlert({ type: 'error', msg: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading || !user || !profile) return null

  const isSelf = profile.id === user.id
  const canEdit = isSelf || user.role === 'admin' || user.role === 'manager'

  return (
    <AppShell>
      <h1 className="page-title">
        {isSelf ? 'My Profile' : `${profile.first_name} ${profile.last_name}`}
      </h1>

      {alert && <Alert type={alert.type}>{alert.msg}</Alert>}

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="profile-header">
          <Avatar user={profile} size="avatar-lg" />
          <div style={{ flex: 1 }}>
            <div className="profile-name">{profile.first_name} {profile.last_name}</div>
            {profile.pronouns && (
              <div style={{ color: 'var(--text3)', fontSize: '0.82em' }}>{profile.pronouns}</div>
            )}
            <div className="profile-role">
              {profile.job_title}{profile.department ? ` · ${profile.department}` : ''}
            </div>
            <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <RoleBadge role={profile.role} />
              {profile.is_active ? <Badge type="green">Active</Badge> : <Badge type="red">Inactive</Badge>}
              {profile.tech_comfort_level <= 2 && <Badge type="amber">Accessibility Enhanced</Badge>}
            </div>
          </div>
          {canEdit && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {editing ? (
                <>
                  <button className="btn btn-primary btn-sm" onClick={saveProfile} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={startEdit}>Edit Profile</button>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div className="grid-2" style={{ marginTop: '1.5rem' }}>
            {[
              ['first_name', 'First Name', 'text'],
              ['last_name',  'Last Name',  'text'],
              ['pronouns',   'Pronouns',   'text'],
              ['phone',      'Phone',      'tel'],
              ['department', 'Department', 'text'],
              ['job_title',  'Job Title',  'text'],
            ].map(([key, label, type]) => (
              <div className="form-group" key={key}>
                <label className="form-label" htmlFor={`field-${key}`}>{label}</label>
                <input
                  id={`field-${key}`} type={type} className="form-input"
                  value={form[key] || ''}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" htmlFor="field-bio">
                Bio{' '}
                <span style={{ color: 'var(--accent)', fontSize: '0.85em', fontWeight: 400,
                  textTransform: 'none', letterSpacing: 0 }}>
                  ✦ AI will professionally polish this on save
                </span>
              </label>
              <textarea
                id="field-bio" className="form-input" rows={3}
                style={{ resize: 'vertical' }}
                value={form.bio || ''}
                onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
              />
            </div>
          </div>
        ) : (
          <div className="grid-2" style={{ marginTop: '1.5rem' }}>
            {[
              ['Email',       profile.email],
              ['Phone',       profile.phone || '—'],
              ['Hire Date',   profile.hire_date ? new Date(profile.hire_date).toLocaleDateString() : '—'],
              ['Manager',     profile.manager_name || '—'],
              ['Tech Comfort','★'.repeat(profile.tech_comfort_level) + '☆'.repeat(5 - profile.tech_comfort_level)],
              ['Theme',       profile.color_theme],
            ].map(([k, v]) => (
              <div key={k} style={{ paddingBottom: '0.6rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72em', color: 'var(--text3)',
                  textTransform: 'uppercase', letterSpacing: '0.07em' }}>{k}</div>
                <div style={{ marginTop: '0.2rem', fontWeight: 500 }}>{v}</div>
              </div>
            ))}
            {profile.bio && (
              <div style={{ gridColumn: '1 / -1', paddingBottom: '0.6rem',
                borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72em', color: 'var(--text3)',
                  textTransform: 'uppercase', letterSpacing: '0.07em' }}>Bio</div>
                <div style={{ marginTop: '0.3rem', color: 'var(--text2)', lineHeight: 1.7 }}>
                  {profile.bio}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {changes.length > 0 && (
        <div className="card">
          <p className="card-title">⟳ Profile Change Log</p>
          <div role="log" aria-label="Profile change history">
            {changes.map(c => (
              <div key={c.id} style={{
                display: 'flex', gap: '1rem', padding: '0.75rem 0',
                borderBottom: '1px solid var(--border)', fontSize: '0.88em',
              }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, color: 'var(--accent)',
                    fontFamily: 'var(--font-mono)' }}>{c.field_name}</span>
                  <span style={{ color: 'var(--text3)' }}> → </span>
                  <span style={{ color: 'var(--green)', fontWeight: 600 }}>{c.new_value}</span>
                  <span style={{ color: 'var(--text3)' }}> (was: {c.old_value})</span>
                  <div style={{ fontSize: '0.82em', color: 'var(--text3)', marginTop: '0.15rem' }}>
                    by {c.changed_by_name} · {new Date(c.changed_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileContent />
    </Suspense>
  )
}
