'use client'
// src/components/AppShell.js
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Avatar, RoleBadge } from './ui'

const NAV = [
  { href: '/dashboard',     icon: '⊞', label: 'Dashboard',      roles: ['employee','manager','admin'] },
  { href: '/profile',       icon: '◉', label: 'My Profile',      roles: ['employee','manager','admin'] },
  { href: '/team',          icon: '◈', label: 'Team Directory',   roles: ['manager','admin'] },
  { href: '/chat',          icon: '✦', label: 'AI Assistant',     roles: ['employee','manager','admin'] },
  { href: '/accessibility', icon: '♿', label: 'Accessibility',    roles: ['employee','manager','admin'] },
  { href: '/logs',          icon: '◎', label: 'Logs & Admin',      roles: ['manager','admin'] },
  { href: '/admin',         icon: '⚙', label: 'Admin Panel',       roles: ['admin'] },
]

export default function AppShell({ children }) {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  if (!user) return null

  const links = NAV.filter(n => n.roles.includes(user.role))

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="shell">
        {/* ── Sidebar ──────────────────────────────── */}
        <nav className="sidebar" aria-label="Main navigation">
          <div className="sidebar-logo" aria-hidden="true">
            SESMag<br />
            <span style={{ fontSize: '0.7em', opacity: 0.6, fontFamily: 'var(--font-body)' }}>
              HR Portal
            </span>
          </div>
          <div className="sidebar-section">Menu</div>
          {links.map(link => (
            <button
              key={link.href}
              className={`nav-btn ${pathname.startsWith(link.href) ? 'active' : ''}`}
              onClick={() => router.push(link.href)}
              aria-current={pathname.startsWith(link.href) ? 'page' : undefined}
            >
              <span className="nav-icon" aria-hidden="true">{link.icon}</span>
              {link.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {/* User info at bottom */}
          <div style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '0.75rem',
          }}>
            <Avatar user={user} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.85em', truncate: true,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.first_name} {user.last_name}
              </div>
              <RoleBadge role={user.role} />
            </div>
          </div>
        </nav>

        {/* ── Main content ─────────────────────────── */}
        <div className="main">
          <header className="topbar" role="banner">
            <span className="topbar-logo" aria-label="SESMag HR Portal">
              SESMag HR Portal
            </span>
            <div className="topbar-right">
              <span className="topbar-user">
                Welcome, <strong>{user.first_name}</strong>
              </span>
              <button className="btn btn-secondary btn-sm" onClick={logout}>
                Sign Out
              </button>
            </div>
          </header>

          <main className="content" id="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </>
  )
}
