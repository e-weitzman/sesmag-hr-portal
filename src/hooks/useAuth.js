'use client'
// src/hooks/useAuth.js
import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { useRouter } from 'next/navigation'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Apply accessibility prefs to <html> element
  const applyPrefs = useCallback((u) => {
    if (!u) return
    const html = document.documentElement
    html.setAttribute('data-theme', u.color_theme || 'light')
    html.setAttribute('data-fs', u.font_size_pref || 'medium')
    html.setAttribute('data-reduce-motion', String(u.reduce_motion || false))
  }, [])

  // Fetch session on mount
  useEffect(() => {
    fetch('/api/auth')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) { setUser(data.user); applyPrefs(data.user) }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [applyPrefs])

  const login = useCallback(async (username, password) => {
    const res = await fetch('/api/auth?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    setUser(data.user)
    applyPrefs(data.user)
    return data.user
  }, [applyPrefs])

  const logout = useCallback(async () => {
    await fetch('/api/auth?action=logout', { method: 'POST' })
    setUser(null)
    document.documentElement.setAttribute('data-theme', 'light')
    document.documentElement.setAttribute('data-fs', 'medium')
    document.documentElement.setAttribute('data-reduce-motion', 'false')
    router.push('/')
  }, [router])

  const updateUser = useCallback((patch) => {
    setUser(prev => {
      const next = { ...prev, ...patch }
      applyPrefs(next)
      return next
    })
  }, [applyPrefs])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
