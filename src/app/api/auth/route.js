// src/app/api/auth/route.js
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { signToken, setAuthCookie, clearAuthCookie, requireAuth } from '@/lib/auth'

// POST /api/auth?action=login|logout|register|me
export async function POST(request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'login') return handleLogin(request)
  if (action === 'logout') return handleLogout(request)
  if (action === 'register') return handleRegister(request)
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function GET(request) {
  // GET /api/auth — return current session user
  const { user, error } = await requireAuth(request)
  if (error) return error

  const result = await query(
    `SELECT id, username, email, role, first_name, last_name, pronouns,
            department, job_title, hire_date, bio, phone,
            font_size_pref, color_theme, reduce_motion, screen_reader_mode,
            tech_comfort_level, preferred_language, is_active, manager_id
     FROM users WHERE id = $1 AND is_active = TRUE`,
    [user.sub]
  )
  if (!result.rows.length) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  return NextResponse.json({ user: result.rows[0] })
}

async function handleLogin(request) {
  const body = await request.json().catch(() => ({}))
  const { username, password } = body

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }

  const result = await query(
    `SELECT id, username, email, role, first_name, last_name, pronouns,
            department, job_title, hire_date, bio, phone,
            font_size_pref, color_theme, reduce_motion, screen_reader_mode,
            tech_comfort_level, preferred_language, manager_id, password_hash, is_active
     FROM users WHERE username = $1`,
    [username]
  )

  const user = result.rows[0]
  if (!user || !user.is_active) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await signToken({
    sub: user.id,
    role: user.role,
    username: user.username,
  })

  const { password_hash, ...safeUser } = user
  const response = NextResponse.json({ user: safeUser })
  return setAuthCookie(response, token)
}

async function handleLogout(request) {
  const response = NextResponse.json({ message: 'Logged out' })
  return clearAuthCookie(response)
}

async function handleRegister(request) {
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
    const result = await query(
      `INSERT INTO users (id, username, email, password_hash, first_name, last_name, role)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, role, first_name, last_name`,
      [username, email, hash, first_name, last_name, role]
    )
    return NextResponse.json({ user: result.rows[0] }, { status: 201 })
  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json({ error: 'Username or email already exists' }, { status: 409 })
    }
    throw err
  }
}
