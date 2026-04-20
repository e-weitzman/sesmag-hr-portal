'use client'
// src/components/ui.js — all small reusable UI primitives

export function Avatar({ user, size = '' }) {
  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase()
  return (
    <div className={`avatar ${size}`} aria-hidden="true">
      {initials}
    </div>
  )
}

export function Badge({ type = 'green', children }) {
  return <span className={`badge badge-${type}`}>{children}</span>
}

export function RoleBadge({ role }) {
  const map = { admin: 'yellow', manager: 'blue', employee: 'green' }
  return <Badge type={map[role] || 'green'}>{role}</Badge>
}

export function Alert({ type = 'info', children, className = '' }) {
  const icons = { error: '✖', success: '✔', info: 'ℹ', amber: '⚠' }
  return (
    <div className={`alert alert-${type} ${className}`} role="alert">
      <span aria-hidden="true">{icons[type]}</span>
      <span>{children}</span>
    </div>
  )
}

export function Toggle({ id, checked, onChange, label }) {
  return (
    <label className="toggle" htmlFor={id} title={label}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        aria-label={label}
      />
      <span className="toggle-slider" />
    </label>
  )
}

export function Spinner({ size = 20 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      style={{ animation: 'spin 0.8s linear infinite' }}
      aria-label="Loading"
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  )
}
