// src/middleware.js — Next.js Edge Middleware
// Imports ONLY from auth-edge.js (no next/headers, no bcryptjs — Edge safe)
import { NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth-edge'

const PROTECTED_PATHS = ['/dashboard', '/profile', '/team', '/chat', '/accessibility', '/admin', '/logs']

export async function middleware(request) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.redirect(new URL('/', request.url))

  const user = await verifyToken(token)
  if (!user) {
    const response = NextResponse.redirect(new URL('/', request.url))
    response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
    return response
  }

  if (pathname.startsWith('/admin') && user.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  if (pathname.startsWith('/team') && user.role === 'employee') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*', '/team/:path*',
            '/chat/:path*', '/accessibility/:path*', '/admin/:path*', '/logs/:path*'],
}
