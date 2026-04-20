// src/app/api/users/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth'
import { moderateContent, enhanceBio } from '@/lib/claude'

const USER_SELECT = `
  SELECT u.id, u.username, u.email, u.role, u.first_name, u.last_name,
         u.pronouns, u.department, u.job_title, u.hire_date, u.bio, u.phone,
         u.font_size_pref, u.color_theme, u.reduce_motion, u.screen_reader_mode,
         u.tech_comfort_level, u.preferred_language, u.is_active, u.manager_id,
         u.created_at, u.updated_at,
         m.first_name || ' ' || m.last_name AS manager_name
  FROM users u
  LEFT JOIN users m ON m.id = u.manager_id
`

// GET /api/users — list users (role-filtered)
export async function GET(request) {
  const { user, error } = await requireAuth(request)
  if (error) return error

  let result
  if (user.role === 'employee') {
    result = await query(`${USER_SELECT} WHERE u.id = $1`, [user.sub])
  } else if (user.role === 'manager') {
    result = await query(
      `${USER_SELECT} WHERE (u.manager_id = $1 OR u.id = $1) AND u.is_active = TRUE ORDER BY u.last_name`,
      [user.sub]
    )
  } else {
    // admin sees all
    result = await query(`${USER_SELECT} WHERE u.is_active = TRUE ORDER BY u.last_name`)
  }

  return NextResponse.json({ users: result.rows })
}

// PATCH /api/users — update current user's profile (with Claude middleware)
export async function PATCH(request) {
  const { user, error } = await requireAuth(request)
  if (error) return error

  const body = await request.json().catch(() => ({}))
  const { targetId, ...fields } = body

  // Determine which user to update
  const updateId = targetId || user.sub

  // Employees can only edit themselves
  if (user.role === 'employee' && updateId !== user.sub) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Fields employees can update
  const EMPLOYEE_FIELDS = new Set([
    'first_name', 'last_name', 'pronouns', 'phone', 'bio',
    'font_size_pref', 'color_theme', 'reduce_motion',
    'screen_reader_mode', 'tech_comfort_level', 'preferred_language',
  ])
  const MANAGER_FIELDS = new Set([...EMPLOYEE_FIELDS, 'department', 'job_title'])

  const allowed = user.role === 'admin' ? null
    : user.role === 'manager' ? MANAGER_FIELDS
    : EMPLOYEE_FIELDS

  // ── CLAUDE MIDDLEWARE: content moderation on bio ──────────────
  let claudeNote = null
  if (fields.bio) {
    const modResult = await moderateContent(fields.bio)
    if (!modResult.safe && modResult.severity !== 'low') {
      return NextResponse.json({
        error: 'Bio content was flagged: ' + modResult.reason,
        flagged: true,
      }, { status: 422 })
    }

    // ── CLAUDE MIDDLEWARE: enhance bio automatically ──────────────
    const { rows: targetUser } = await query(
      'SELECT job_title FROM users WHERE id = $1', [updateId]
    )
    const jobTitle = targetUser[0]?.job_title || fields.job_title || ''
    const enhanced = await enhanceBio(fields.bio, jobTitle)
    if (enhanced !== fields.bio) {
      fields.bio = enhanced
      claudeNote = 'Your bio was professionally polished by AI.'
    }
  }

  // Build update query
  const updates = []
  const values = [updateId]

  // Fetch current values for change log
  const { rows: current } = await query('SELECT * FROM users WHERE id = $1', [updateId])
  if (!current.length) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  const oldRow = current[0]

  for (const [key, val] of Object.entries(fields)) {
    if (allowed && !allowed.has(key)) continue
    updates.push(`${key} = $${values.length + 1}`)
    values.push(val)
  }

  if (!updates.length) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { rows } = await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    values
  )

  // Log changes for manager visibility
  for (const [key, val] of Object.entries(fields)) {
    if (allowed && !allowed.has(key)) continue
    if (String(oldRow[key]) !== String(val)) {
      await query(
        `INSERT INTO profile_changes (id, user_id, changed_by, field_name, old_value, new_value)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)`,
        [updateId, user.sub, key, String(oldRow[key] ?? ''), String(val ?? '')]
      )
    }
  }

  const { password_hash, ...safeUser } = rows[0]
  return NextResponse.json({ user: safeUser, ...(claudeNote && { note: claudeNote }) })
}
