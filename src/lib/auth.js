// src/lib/auth.js
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars'
)
const COOKIE_NAME = 'sesmag_token'
const EXPIRES_IN = '24h'

export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(SECRET)
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload
  } catch {
    return null
  }
}

export function setAuthCookie(response, token) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })
  return response
}

export function clearAuthCookie(response) {
  response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
  return response
}

/** Call from API route handlers to get the current user from cookie */
export async function getSessionUser() {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

/** Middleware helper — returns 401 JSON if not authenticated */
export async function requireAuth(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const user = await verifyToken(token)
  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }) }
  }
  return { user, error: null }
}

/** Returns 403 if role not in allowedRoles */
export function requireRole(user, ...allowedRoles) {
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  return null
}
