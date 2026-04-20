// src/app/api/users/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth'
import { moderateContent, enhanceBio } from '@/lib/claude'

const serverError = (err) => {
  console.error('[users]', err)
  return NextResponse.json({ error: 'Internal server error', detail: err.message }, { status: 500 })
}

const USER_SELECT = `
  SELECT u.id, u.username, u.email, u.role, u.first_name, u.last_name,
         u.pronouns, u.department, u.job_title, u.hire_date, u.bio, u.phone,
         u.font_size_pref, u.color_theme, u.reduce_motion, u.screen_reader_mode,
         u.tech_comfort_level, u.preferred_language, u.is_active, u.manager_id,
         u.created_at, u.updated_at,
         m.first_name || ' ' || m.last_name AS manager_name
  FROM users u LEFT JOIN users m ON m.id = u.manager_id
`

export async function GET(request) {
  try {
    const { user, error } = await requireAuth(request)
    if (error) return error

    let rows
    if (user.role === 'employee') {
      rows = await query(`${USER_SELECT} WHERE u.id = $1`, [user.sub])
    } else if (user.role === 'manager') {
      rows = await query(
        `${USER_SELECT} WHERE (u.manager_id = $1 OR u.id = $1) AND u.is_active = TRUE ORDER BY u.last_name`,
        [user.sub]
      )
    } else {
      rows = await query(`${USER_SELECT} WHERE u.is_active = TRUE ORDER BY u.last_name`)
    }
    return NextResponse.json({ users: rows })
  } catch (err) {
    return serverError(err)
  }
}

export async function PATCH(request) {
  try {
    const { user, error } = await requireAuth(request)
    if (error) return error

    const body = await request.json().catch(() => ({}))
    const { targetId, ...fields } = body
    const updateId = targetId || user.sub

    if (user.role === 'employee' && updateId !== user.sub) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const EMPLOYEE_FIELDS = new Set([
      'first_name','last_name','pronouns','phone','bio',
      'font_size_pref','color_theme','reduce_motion',
      'screen_reader_mode','tech_comfort_level','preferred_language',
    ])
    const MANAGER_FIELDS = new Set([...EMPLOYEE_FIELDS,'department','job_title'])
    const allowed = user.role === 'admin' ? null
      : user.role === 'manager' ? MANAGER_FIELDS : EMPLOYEE_FIELDS

    // Claude middleware: moderate + enhance bio
    let claudeNote = null
    if (fields.bio) {
      const modResult = await moderateContent(fields.bio)
      if (!modResult.safe && modResult.severity !== 'low') {
        return NextResponse.json({ error: 'Bio content was flagged: ' + modResult.reason, flagged: true }, { status: 422 })
      }
      const targetRows = await query('SELECT job_title FROM users WHERE id = $1', [updateId])
      const jobTitle = targetRows[0]?.job_title || fields.job_title || ''
      const enhanced = await enhanceBio(fields.bio, jobTitle)
      if (enhanced !== fields.bio) { fields.bio = enhanced; claudeNote = 'Your bio was professionally polished by AI.' }
    }

    const currentRows = await query('SELECT * FROM users WHERE id = $1', [updateId])
    if (!currentRows.length) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const oldRow = currentRows[0]

    const updates = []
    const values = [updateId]
    for (const [key, val] of Object.entries(fields)) {
      if (allowed && !allowed.has(key)) continue
      updates.push(`${key} = $${values.length + 1}`)
      values.push(val)
    }
    if (!updates.length) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })

    const updated = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      values
    )

    // Log changes
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

    const { password_hash, ...safeUser } = updated[0]
    return NextResponse.json({ user: safeUser, ...(claudeNote && { note: claudeNote }) })
  } catch (err) {
    return serverError(err)
  }
}
