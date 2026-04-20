// src/middleware.js — Next.js Edge Middleware
// Runs before every matched request; redirects unauthenticated users to login.

import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const COOKIE_NAME = 'sesmag_token'

const PROTECTED_PATHS = ['/dashboard', '/profile', '/team', '/chat', '/accessibility', '/admin']
const PUBLIC_PATHS = ['/', '/login']

export async function middleware(request) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p))
  const isPublic = PUBLIC_PATHS.includes(pathname)

  if (!isProtected) return NextResponse.next()

  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const user = await verifyToken(token)
  if (!user) {
    const response = NextResponse.redirect(new URL('/', request.url))
    response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
    return response
  }

  // Admin guard
  if (pathname.startsWith('/admin') && user.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Team directory — manager and admin only
  if (pathname.startsWith('/team') && user.role === 'employee') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*', '/team/:path*',
            '/chat/:path*', '/accessibility/:path*', '/admin/:path*'],
}
