// src/lib/db-admin.js
// Higher-level database functions used by the logs/admin panel
// All functions return plain objects — no NextResponse here
import { query } from './db'

// ── LOG QUERIES ────────────────────────────────────────────────

export async function getLogs({ level, category, userId, search, limit = 100, offset = 0 } = {}) {
  const conditions = []
  const params = []

  if (level)    { params.push(level);    conditions.push(`level = $${params.length}`) }
  if (category) { params.push(category); conditions.push(`category = $${params.length}`) }
  if (userId)   { params.push(userId);   conditions.push(`user_id = $${params.length}`) }
  if (search)   { params.push(`%${search}%`); conditions.push(`(message ILIKE $${params.length} OR action ILIKE $${params.length} OR username ILIKE $${params.length})`) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(limit, offset)

  const rows = await query(
    `SELECT id, level, category, action, user_id, username, ip, path,
            method, status_code, message, metadata, duration_ms, created_at
     FROM system_logs
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  const countRows = await query(
    `SELECT COUNT(*) AS total FROM system_logs ${where}`,
    params.slice(0, -2)
  )

  return { logs: rows, total: parseInt(countRows[0]?.total || 0) }
}

export async function getLogStats() {
  const [byLevel, byCategory, byHour, errorRate] = await Promise.all([
    query(`SELECT level, COUNT(*) AS cnt FROM system_logs
           WHERE created_at > NOW() - INTERVAL '24 hours'
           GROUP BY level ORDER BY cnt DESC`, []),
    query(`SELECT category, COUNT(*) AS cnt FROM system_logs
           WHERE created_at > NOW() - INTERVAL '24 hours'
           GROUP BY category ORDER BY cnt DESC`, []),
    query(`SELECT DATE_TRUNC('hour', created_at) AS hour, COUNT(*) AS cnt
           FROM system_logs
           WHERE created_at > NOW() - INTERVAL '24 hours'
           GROUP BY hour ORDER BY hour`, []),
    query(`SELECT
             COUNT(*) FILTER (WHERE level = 'error') AS errors,
             COUNT(*) FILTER (WHERE level = 'warn')  AS warnings,
             COUNT(*) AS total
           FROM system_logs
           WHERE created_at > NOW() - INTERVAL '24 hours'`, []),
  ])
  return { byLevel, byCategory, byHour, errorRate: errorRate[0] }
}

export async function clearLogs(olderThanDays = 30) {
  const rows = await query(
    `DELETE FROM system_logs
     WHERE created_at < NOW() - INTERVAL '${parseInt(olderThanDays)} days'
     RETURNING id`,
    []
  )
  return { deleted: rows.length }
}

// ── USER QUERIES ───────────────────────────────────────────────

export async function getAllUsers() {
  return query(
    `SELECT u.id, u.username, u.email, u.role, u.first_name, u.last_name,
            u.department, u.job_title, u.hire_date, u.is_active,
            u.font_size_pref, u.color_theme, u.reduce_motion,
            u.screen_reader_mode, u.tech_comfort_level, u.created_at,
            m.first_name || ' ' || m.last_name AS manager_name,
            (SELECT COUNT(*) FROM profile_changes pc WHERE pc.user_id = u.id) AS change_count,
            (SELECT COUNT(*) FROM chat_messages cm WHERE cm.user_id = u.id) AS chat_count
     FROM users u LEFT JOIN users m ON m.id = u.manager_id
     ORDER BY u.created_at DESC`,
    []
  )
}

export async function getUserChanges({ userId, limit = 50 } = {}) {
  const where = userId ? 'WHERE pc.user_id = $1' : ''
  const params = userId ? [userId] : []
  params.push(limit)
  return query(
    `SELECT pc.*, u.first_name || ' ' || u.last_name AS changed_by_name,
            t.first_name || ' ' || t.last_name AS target_name
     FROM profile_changes pc
     JOIN users u ON u.id = pc.changed_by
     JOIN users t ON t.id = pc.user_id
     ${where}
     ORDER BY pc.changed_at DESC
     LIMIT $${params.length}`,
    params
  )
}

export async function getDbStats() {
  const [tables, userStats, chatStats, logStats] = await Promise.all([
    query(`SELECT schemaname, tablename,
             pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
             pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
           FROM pg_tables
           WHERE schemaname = 'public'
           ORDER BY size_bytes DESC`, []),
    query(`SELECT
             COUNT(*) AS total_users,
             COUNT(*) FILTER (WHERE is_active) AS active_users,
             COUNT(*) FILTER (WHERE role = 'admin') AS admins,
             COUNT(*) FILTER (WHERE role = 'manager') AS managers,
             COUNT(*) FILTER (WHERE role = 'employee') AS employees
           FROM users`, []),
    query(`SELECT COUNT(*) AS total_messages,
                  COUNT(DISTINCT user_id) AS users_with_chats
           FROM chat_messages`, []),
    query(`SELECT COUNT(*) AS total_logs,
                  COUNT(*) FILTER (WHERE level = 'error') AS error_count,
                  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS last_hour
           FROM system_logs`, []).catch(() => [{ total_logs: 'N/A', error_count: 'N/A', last_hour: 'N/A' }]),
  ])
  return {
    tables,
    users: userStats[0],
    chats: chatStats[0],
    logs: logStats[0],
  }
}

export async function runSafeQuery(sql, params = []) {
  // Whitelist — only allow SELECT statements from admin panel
  const trimmed = sql.trim().toUpperCase()
  if (!trimmed.startsWith('SELECT')) {
    throw new Error('Only SELECT queries are permitted in the query runner')
  }
  if (trimmed.includes('PASSWORD') || trimmed.includes('PASSWORD_HASH')) {
    throw new Error('Querying password fields is not permitted')
  }
  const start = Date.now()
  const rows = await query(sql, params)
  const duration = Date.now() - start
  return { rows, duration, count: rows.length }
}
