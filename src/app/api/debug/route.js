// src/app/api/debug/route.js
import { NextResponse } from 'next/server'

export async function GET() {
  const results = {}

  results.DATABASE_URL = !!process.env.DATABASE_URL ? 'SET' : 'MISSING'
  results.ANTHROPIC_API_KEY = !!process.env.ANTHROPIC_API_KEY ? 'SET' : 'MISSING'
  results.JWT_SECRET = !!process.env.JWT_SECRET ? 'SET' : 'MISSING'

  try {
    const { SignJWT } = await import('jose')
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'test')
    const token = await new SignJWT({ sub: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secret)
    results.jose = 'OK - token length ' + token.length
  } catch (e) { results.jose = 'ERROR: ' + e.message }

  try {
    const bcrypt = (await import('bcryptjs')).default
    const hash = await bcrypt.hash('test', 8)
    results.bcryptjs = 'OK - compare: ' + await bcrypt.compare('test', hash)
  } catch (e) { results.bcryptjs = 'ERROR: ' + e.message }

  try {
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(process.env.DATABASE_URL)
    const rows = await sql('SELECT 1 AS val', [])
    results.neon = 'OK - rows: ' + JSON.stringify(rows)
  } catch (e) { results.neon = 'ERROR: ' + e.message }

  try {
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(process.env.DATABASE_URL)
    const rows = await sql('SELECT COUNT(*) AS cnt FROM users', [])
    results.users_table = 'OK - count: ' + JSON.stringify(rows)
  } catch (e) { results.users_table = 'ERROR: ' + e.message }

  // Step 1: fetch the user row
  try {
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(process.env.DATABASE_URL)
    const rows = await sql(
      `SELECT id, username, password_hash, role, is_active FROM users WHERE username = $1`,
      ['dav_persona']
    )
    results.fetch_user = 'OK - got ' + rows.length + ' row(s), keys: ' + Object.keys(rows[0] || {}).join(', ')

    // Step 2: bcrypt compare
    if (rows.length > 0) {
      const bcrypt = (await import('bcryptjs')).default
      const valid = await bcrypt.compare('Password1!', rows[0].password_hash)
      results.bcrypt_compare = 'OK - valid: ' + valid
    }
  } catch (e) { results.fetch_user = 'ERROR: ' + e.message }

  // Step 3: signToken
  try {
    const { SignJWT } = await import('jose')
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const token = await new SignJWT({ sub: 'uid-test', role: 'employee', username: 'dav_persona' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret)
    results.sign_token = 'OK - length: ' + token.length
  } catch (e) { results.sign_token = 'ERROR: ' + e.message }

  // Step 4: simulate full handleLogin
  try {
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(process.env.DATABASE_URL)
    const rows = await sql(
      `SELECT id, username, email, role, first_name, last_name, pronouns,
              department, job_title, hire_date, bio, phone,
              font_size_pref, color_theme, reduce_motion, screen_reader_mode,
              tech_comfort_level, preferred_language, manager_id, password_hash, is_active
       FROM users WHERE username = $1`,
      ['dav_persona']
    )
    const user = rows[0]
    const { password_hash, ...safeUser } = user
    results.full_login_sim = 'OK - safeUser keys: ' + Object.keys(safeUser).join(', ')
  } catch (e) { results.full_login_sim = 'ERROR: ' + e.message }

  return NextResponse.json(results)
}
