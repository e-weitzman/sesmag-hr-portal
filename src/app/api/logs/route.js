// src/app/api/logs/route.js
import { NextResponse } from 'next/server'
import { requireAuth, requireRole } from '@/lib/auth'
import { getLogs, getLogStats, clearLogs } from '@/lib/db-admin'
import { log, getRequestInfo } from '@/lib/logger'

const serverError = (err) => {
  console.error('[logs api]', err)
  return NextResponse.json({ error: err.message }, { status: 500 })
}

export async function GET(request) {
  const start = Date.now()
  try {
    const { user, error } = await requireAuth(request)
    if (error) return error
    const roleError = requireRole(user, 'manager', 'admin')
    if (roleError) return roleError

    const { searchParams } = new URL(request.url)
    const type     = searchParams.get('type') || ''
    const { ip, path } = getRequestInfo(request)

    if (type === 'stats') {
      const stats = await getLogStats()
      return NextResponse.json(stats)
    }

    const level    = searchParams.get('level') || ''
    const category = searchParams.get('category') || ''
    const userId   = searchParams.get('userId') || ''
    const search   = searchParams.get('search') || ''
    const limit    = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
    const offset   = parseInt(searchParams.get('offset') || '0')

    const result = await getLogs({ level, category, userId, search, limit, offset })

    await log.info({
      category: 'api', action: 'GET /api/logs',
      userId: user.sub, username: user.username,
      ip, path, statusCode: 200,
      durationMs: Date.now() - start,
    })

    return NextResponse.json(result)
  } catch (err) { return serverError(err) }
}

export async function DELETE(request) {
  try {
    const { user, error } = await requireAuth(request)
    if (error) return error
    const roleError = requireRole(user, 'admin')
    if (roleError) return roleError

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const result = await clearLogs(days)

    await log.warn({
      category: 'api', action: 'DELETE /api/logs',
      userId: user.sub, username: user.username,
      message: `Cleared logs older than ${days} days (${result.deleted} deleted)`,
    })

    return NextResponse.json(result)
  } catch (err) { return serverError(err) }
}
