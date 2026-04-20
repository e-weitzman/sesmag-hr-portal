// src/app/api/db-admin/route.js — DB stats + safe query runner (admin only)
import { NextResponse } from 'next/server'
import { requireAuth, requireRole } from '@/lib/auth'
import { getDbStats, getUserChanges, runSafeQuery } from '@/lib/db-admin'
import { log } from '@/lib/logger'

const serverError = (err) => {
  console.error('[db-admin]', err)
  return NextResponse.json({ error: err.message }, { status: 500 })
}

export async function GET(request) {
  try {
    const { user, error } = await requireAuth(request)
    if (error) return error
    const roleError = requireRole(user, 'manager', 'admin')
    if (roleError) return roleError

    const { searchParams } = new URL(request.url)
    const type   = searchParams.get('type') || 'stats'
    const userId = searchParams.get('userId') || ''

    if (type === 'stats') {
      const stats = await getDbStats()
      return NextResponse.json(stats)
    }

    if (type === 'changes') {
      const changes = await getUserChanges({ userId: userId || undefined })
      return NextResponse.json({ changes })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (err) { return serverError(err) }
}

export async function POST(request) {
  try {
    const { user, error } = await requireAuth(request)
    if (error) return error
    const roleError = requireRole(user, 'admin')
    if (roleError) return roleError

    const body = await request.json().catch(() => ({}))
    const { sql } = body

    if (!sql?.trim()) return NextResponse.json({ error: 'SQL required' }, { status: 400 })

    const result = await runSafeQuery(sql)

    await log.info({
      category: 'db', action: 'admin_query',
      userId: user.sub, username: user.username,
      message: `Query returned ${result.count} rows in ${result.duration}ms`,
      metadata: { sql: sql.slice(0, 200) },
    })

    return NextResponse.json(result)
  } catch (err) {
    await log.warn({
      category: 'db', action: 'admin_query_blocked',
      message: err.message,
    }).catch(() => {})
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
