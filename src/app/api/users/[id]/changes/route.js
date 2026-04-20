// src/app/api/users/[id]/changes/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth'

export async function GET(request, { params }) {
  try {
    const { user, error } = await requireAuth(request)
    if (error) return error
    const roleError = requireRole(user, 'manager', 'admin')
    if (roleError) return roleError
    const rows = await query(
      `SELECT pc.*, u.first_name || ' ' || u.last_name AS changed_by_name
       FROM profile_changes pc
       JOIN users u ON u.id = pc.changed_by
       WHERE pc.user_id = $1
       ORDER BY pc.changed_at DESC LIMIT 50`,
      [params.id]
    )
    return NextResponse.json({ changes: rows })
  } catch (err) {
    console.error('[changes]', err)
    return NextResponse.json({ error: 'Internal server error', detail: err.message }, { status: 500 })
  }
}
