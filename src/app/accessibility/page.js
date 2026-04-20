'use client'
// src/app/accessibility/page.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import AppShell from '@/components/AppShell'
import { Toggle, Alert, Spinner } from '@/components/ui'

const THEMES = [
  { value: 'light',         label: 'Light',         desc: 'Standard light background, easy for most users' },
  { value: 'dark',          label: 'Dark',           desc: 'Reduced eye strain in low-light environments' },
  { value: 'high-contrast', label: 'High Contrast',  desc: 'Maximum readability — WCAG AAA standard' },
  { value: 'sepia',         label: 'Sepia',          desc: 'Warm amber tones, great for long reading sessions' },
]
const FONT_SIZES = [
  { value: 'small',  label: 'Small',   pct: '87.5%' },
  { value: 'medium', label: 'Medium',  pct: '100% — Default' },
  { value: 'large',  label: 'Large',   pct: '120%' },
  { value: 'xlarge', label: 'X-Large', pct: '145%' },
]

export default function AccessibilityPage() {
  const { user, loading, updateUser } = useAuth()
  const router = useRouter()

  const [prefs, setPrefs] = useState(null)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)

  // AI advisor state
  const [aiQuery, setAiQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState(null)

  useEffect(() => {
    if (!loading && !user) router.push('/')
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      setPrefs({
        font_size_pref: user.font_size_pref,
        color_theme: user.color_theme,
        reduce_motion: user.reduce_motion,
        screen_reader_mode: user.screen_reader_mode,
        tech_comfort_level: user.tech_comfort_level,
        preferred_language: user.preferred_language || 'en',
      })
    }
  }, [user])

  function updatePref(key, val) {
    const next = { ...prefs, [key]: val }
    setPrefs(next)
    // Apply live preview
    const html = document.documentElement
    if (key === 'color_theme') html.setAttribute('data-theme', val)
    if (key === 'font_size_pref') html.setAttribute('data-fs', val)
    if (key === 'reduce_motion') html.setAttribute('data-reduce-motion', String(val))
  }

  async function savePrefs() {
    setSaving(true)
    setAlert(null)
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      updateUser(prefs)
      setAlert({ type: 'success', msg: 'Accessibility preferences saved.' })
    } catch (err) {
      setAlert({ type: 'error', msg: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function askAI() {
    if (!aiQuery.trim()) return
    setAiLoading(true)
    setAiResult(null)
    try {
      const res = await fetch('/api/ai-middleware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accessibility-advice',
          difficulty: aiQuery,
          currentSettings: prefs,
        }),
      })
      const data = await res.json()
      setAiResult(data)
    } catch {
      setAiResult({ message: 'Could not reach the AI. Please try again.', recommendations: [] })
    } finally {
      setAiLoading(false)
    }
  }

  function applyRecommendation(rec) {
    let val = rec.value
    if (val === 'true') val = true
    if (val === 'false') val = false
    updatePref(rec.setting, val)
  }

  if (loading || !user || !prefs) return null

  return (
    <AppShell>
      <h1 className="page-title">Accessibility Settings</h1>

      {alert && <Alert type={alert.type}>{alert.msg}</Alert>}

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Color Theme */}
        <div className="card">
          <p className="card-title">◑ Color Theme</p>
          <fieldset style={{ border: 'none', padding: 0 }}>
            <legend style={{ display: 'none' }}>Select color theme</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {THEMES.map(t => (
                <label
                  key={t.value}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.7rem', borderRadius: '8px', cursor: 'pointer',
                    border: `1.5px solid ${prefs.color_theme === t.value ? 'var(--accent)' : 'var(--border)'}`,
                    background: prefs.color_theme === t.value ? 'var(--accentbg)' : 'transparent',
                    transition: 'all var(--transition)',
                  }}
                >
                  <input
                    type="radio" name="theme" value={t.value}
                    checked={prefs.color_theme === t.value}
                    onChange={() => updatePref('color_theme', t.value)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9em' }}>{t.label}</div>
                    <div style={{ fontSize: '0.78em', color: 'var(--text3)' }}>{t.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Font size */}
        <div className="card">
          <p className="card-title">Aa Font Size</p>
          <fieldset style={{ border: 'none', padding: 0 }}>
            <legend style={{ display: 'none' }}>Select font size</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {FONT_SIZES.map(f => (
                <label
                  key={f.value}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.7rem', borderRadius: '8px', cursor: 'pointer',
                    border: `1.5px solid ${prefs.font_size_pref === f.value ? 'var(--accent)' : 'var(--border)'}`,
                    background: prefs.font_size_pref === f.value ? 'var(--accentbg)' : 'transparent',
                    transition: 'all var(--transition)',
                  }}
                >
                  <input
                    type="radio" name="fontsize" value={f.value}
                    checked={prefs.font_size_pref === f.value}
                    onChange={() => updatePref('font_size_pref', f.value)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.9em' }}>{f.label}</span>
                    <span style={{ color: 'var(--text3)', fontSize: '0.8em', marginLeft: '0.5rem' }}>{f.pct}</span>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Motion & interaction */}
        <div className="card">
          <p className="card-title">⚡ Motion & Interaction</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {[
              { key: 'reduce_motion', label: 'Reduce Motion', desc: 'Disables all animations and transitions' },
              { key: 'screen_reader_mode', label: 'Screen Reader Mode', desc: 'Optimises layout for assistive technology' },
            ].map(item => (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92em' }}>{item.label}</div>
                  <div style={{ fontSize: '0.8em', color: 'var(--text3)', marginTop: '0.15rem' }}>{item.desc}</div>
                </div>
                <Toggle
                  id={item.key}
                  checked={!!prefs[item.key]}
                  onChange={v => updatePref(item.key, v)}
                  label={`Toggle ${item.label}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Tech comfort */}
        <div className="card">
          <p className="card-title">★ Tech Comfort Level</p>
          <p style={{ color: 'var(--text2)', fontSize: '0.88em', marginBottom: '1rem', lineHeight: 1.6 }}>
            Helps us tailor help text and interface complexity to your experience.
          </p>
          <fieldset style={{ border: 'none', padding: 0 }}>
            <legend style={{ display: 'none' }}>Select tech comfort level 1 to 5</legend>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <label key={n} style={{ cursor: 'pointer', flex: 1 }}>
                  <input
                    type="radio" name="comfort" value={n}
                    checked={prefs.tech_comfort_level === n}
                    onChange={() => updatePref('tech_comfort_level', n)}
                    style={{ display: 'none' }}
                  />
                  <div style={{
                    textAlign: 'center', padding: '0.75rem 0',
                    borderRadius: '8px', fontWeight: 700, fontSize: '1.1em',
                    border: `2px solid ${prefs.tech_comfort_level >= n ? 'var(--accent)' : 'var(--border)'}`,
                    background: prefs.tech_comfort_level >= n ? 'var(--accentbg)' : 'transparent',
                    color: prefs.tech_comfort_level >= n ? 'var(--accent)' : 'var(--text3)',
                    transition: 'all var(--transition)',
                  }} aria-label={`Level ${n}`}>{n}</div>
                </label>
              ))}
            </div>
            <div style={{ marginTop: '0.75rem', fontSize: '0.82em', color: 'var(--text3)', fontStyle: 'italic' }}>
              {['', 'Beginner — rarely use technology', 'Novice — basic tasks only',
                'Intermediate — comfortable with most apps',
                'Advanced — power user', 'Expert — developer or IT'][prefs.tech_comfort_level]}
            </div>
          </fieldset>
        </div>
      </div>

      <button
        className="btn btn-primary"
        onClick={savePrefs}
        disabled={saving}
        style={{ marginBottom: '2rem' }}
      >
        {saving ? <Spinner size={16} /> : '♿'} {saving ? 'Saving…' : 'Save Preferences'}
      </button>

      {/* Claude AI Accessibility Advisor */}
      <div className="card" style={{ borderColor: 'var(--accent)', borderLeftWidth: 3 }}>
        <p className="card-title">✦ AI Accessibility Advisor</p>
        <p style={{ color: 'var(--text2)', fontSize: '0.88em', lineHeight: 1.7, marginBottom: '1rem' }}>
          Describe any difficulty you're experiencing with the interface, and Claude will
          recommend specific setting changes for you.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            style={{ flex: 1, minWidth: 200 }}
            placeholder='e.g. "The text is too small and hurts my eyes"'
            value={aiQuery}
            onChange={e => setAiQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && askAI()}
          />
          <button className="btn btn-primary" onClick={askAI} disabled={aiLoading || !aiQuery.trim()}>
            {aiLoading ? <Spinner size={16} /> : '✦ Ask AI'}
          </button>
        </div>

        {aiResult && (
          <div style={{ marginTop: '1.25rem' }}>
            <p style={{ color: 'var(--text)', marginBottom: '0.75rem', lineHeight: 1.7, fontSize: '0.9em' }}>
              {aiResult.message}
            </p>
            {aiResult.recommendations?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {aiResult.recommendations.map((rec, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.75rem', borderRadius: '8px',
                    background: 'var(--accentbg)', border: '1px solid var(--accent)', gap: '1rem',
                  }}>
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.88em', color: 'var(--accent)' }}>
                        {rec.setting}
                      </span>
                      <span style={{ color: 'var(--text3)', fontSize: '0.82em', margin: '0 0.4rem' }}>→</span>
                      <span style={{ fontWeight: 600, fontSize: '0.88em' }}>{String(rec.value)}</span>
                      <div style={{ fontSize: '0.78em', color: 'var(--text2)', marginTop: '0.15rem' }}>{rec.reason}</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => applyRecommendation(rec)}>
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
