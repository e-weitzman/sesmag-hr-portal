// src/app/api/debug/route.js
// Temporary diagnostic endpoint — remove after confirming login works
import { NextResponse } from 'next/server'

export async function GET() {
  const results = {}

  // 1. Env vars present?
  results.DATABASE_URL = !!process.env.DATABASE_URL ? 'SET' : 'MISSING'
  results.ANTHROPIC_API_KEY = !!process.env.ANTHROPIC_API_KEY ? 'SET' : 'MISSING'
  results.JWT_SECRET = !!process.env.JWT_SECRET ? 'SET' : 'MISSING'

  // 2. Can we import jose?
  try {
    const { SignJWT } = await import('jose')
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'test')
    const token = await new SignJWT({ sub: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secret)
    results.jose = 'OK - token length ' + token.length
  } catch (e) {
    results.jose = 'ERROR: ' + e.message
  }

  // 3. Can we import bcryptjs?
  try {
    const bcrypt = (await import('bcryptjs')).default
    const hash = await bcrypt.hash('test', 8)
    const valid = await bcrypt.compare('test', hash)
    results.bcryptjs = 'OK - compare: ' + valid
  } catch (e) {
    results.bcryptjs = 'ERROR: ' + e.message
  }

  // 4. Can we reach Neon?
  try {
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(process.env.DATABASE_URL)
    const rows = await sql('SELECT 1 AS val', [])
    results.neon = 'OK - rows: ' + JSON.stringify(rows)
  } catch (e) {
    results.neon = 'ERROR: ' + e.message
  }

  // 5. Can we query users table?
  try {
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(process.env.DATABASE_URL)
    const rows = await sql('SELECT COUNT(*) AS cnt FROM users', [])
    results.users_table = 'OK - count: ' + JSON.stringify(rows)
  } catch (e) {
    results.users_table = 'ERROR: ' + e.message
  }

  return NextResponse.json(results)
}
