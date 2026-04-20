// src/lib/auth-edge.js
// Edge Runtime safe — ONLY jose, NO next/headers, NO bcryptjs
// Used exclusively by src/middleware.js
import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars'
)

export const COOKIE_NAME = 'sesmag_token'

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload
  } catch {
    return null
  }
}
