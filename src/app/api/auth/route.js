// src/app/api/auth/route.js
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { signToken, setAuthCookie, clearAuthCookie, requireAuth } from '@/lib/auth'
import { logAuth, getRequestInfo } from '@/lib/logger'

const serverError = (err) => {
  console.error('[auth]', err)
  return NextResponse.json({ error: 'Internal server error', detail: err.message }, { status: 500 })
}

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    if (action === 'login')    return await handleLogin(request)
    if (action === 'logout')   return await handleLogout(request)
    if (action === 'register') return await handleRegister(request)
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) { return serverError(err) }
}

export async function GET(request) {
  try {
    const { user, error } = await requireAuth(request)
    if (error) return error
    const rows = await query(
      `SELECT id, username, email, role, first_name, last_name, pronouns,
              department, job_title, hire_date, bio, phone,
              font_size_pref, color_theme, reduce_motion, screen_reader_mode,
              tech_comfort_level, preferred_language, is_active, manager_id
       FROM users WHERE id = $1 AND is_active = TRUE`,
      [user.sub]
    )
    if (!rows.length) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    return NextResponse.json({ user: rows[0] })
  } catch (err) { return serverError(err) }
}

async function handleLogin(request) {
  const { ip, path } = getRequestInfo(request)
  const body = await request.json().catch(() => ({}))
  const { username, password } = body

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }

  const rows = await query(
    `SELECT id, username, email, role, first_name, last_name, pronouns,
            department, job_title, hire_date, bio, phone,
            font_size_pref, color_theme, reduce_motion, screen_reader_mode,
            tech_comfort_level, preferred_language, manager_id, password_hash, is_active
     FROM users WHERE username = $1`,
    [username]
  )

  const user = rows[0]
  if (!user || !user.is_active) {
    await logAuth('login_failed', { username, ip, path, success: false, message: 'User not found or inactive' })
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    await logAuth('login_failed', { username, ip, path, success: false, message: 'Wrong password' })
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await signToken({ sub: user.id, role: user.role, username: user.username })
  await logAuth('login_success', { userId: user.id, username, ip, path, success: true })

  const { password_hash, ...safeUser } = user
  const response = NextResponse.json({ user: safeUser })
  return setAuthCookie(response, token)
}

async function handleLogout(request) {
  const { ip, path } = getRequestInfo(request)
  const { user } = await requireAuth(request).catch(() => ({ user: null }))
  await logAuth('logout', { userId: user?.sub, username: user?.username, ip, path, success: true })
  const response = NextResponse.json({ message: 'Logged out' })
  return clearAuthCookie(response)
}

async function handleRegister(request) {
  const { ip, path } = getRequestInfo(request)
  const body = await request.json().catch(() => ({}))
  const { username, email, password, first_name, last_name, role = 'employee' } = body

  if (!username || !email || !password || !first_name || !last_name) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const hash = await bcrypt.hash(password, 12)
  try {
    const rows = await query(
      `INSERT INTO users (id, username, email, password_hash, first_name, last_name, role)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, role, first_name, last_name`,
      [username, email, hash, first_name, last_name, role]
    )
    await logAuth('register_success', { userId: rows[0].id, username, ip, path, success: true })
    return NextResponse.json({ user: rows[0] }, { status: 201 })
  } catch (err) {
    if (err.code === '23505') {
      await logAuth('register_failed', { username, ip, path, success: false, message: 'Duplicate username/email' })
      return NextResponse.json({ error: 'Username or email already exists' }, { status: 409 })
    }
    throw err
  }
}
