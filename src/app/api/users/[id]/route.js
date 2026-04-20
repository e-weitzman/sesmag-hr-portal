// src/app/api/users/[id]/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth'

// GET /api/users/[id]
export async function GET(request, { params }) {
  const { user, error } = await requireAuth(request)
  if (error) return error

  const { id } = params

  if (user.role === 'employee' && id !== user.sub) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const result = await query(
    `SELECT u.id, u.username, u.email, u.role, u.first_name, u.last_name,
            u.pronouns, u.department, u.job_title, u.hire_date, u.bio, u.phone,
            u.font_size_pref, u.color_theme, u.reduce_motion, u.screen_reader_mode,
            u.tech_comfort_level, u.preferred_language, u.is_active, u.created_at,
            m.first_name || ' ' || m.last_name AS manager_name
     FROM users u LEFT JOIN users m ON m.id = u.manager_id
     WHERE u.id = $1`,
    [id]
  )

  if (!result.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ user: result.rows[0] })
}

// DELETE /api/users/[id] — soft delete, admin only
export async function DELETE(request, { params }) {
  const { user, error } = await requireAuth(request)
  if (error) return error
  const roleError = requireRole(user, 'admin')
  if (roleError) return roleError

  await query('UPDATE users SET is_active = FALSE WHERE id = $1', [params.id])
  return NextResponse.json({ message: 'User deactivated' })
}
