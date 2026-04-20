// src/lib/logger.js
// Server-side structured logger — writes to Neon system_logs table
// and also to console for Vercel function logs
import { query } from './db'

/**
 * Core log writer — non-blocking (errors in logging never crash the app)
 */
async function writeLog({ level, category, action, userId, username, ip,
  path, method, statusCode, message, metadata, durationMs }) {
  // Always write to console (visible in Vercel Function Logs)
  const line = `[${level.toUpperCase()}] [${category}] ${action}${message ? ': ' + message : ''}${metadata ? ' ' + JSON.stringify(metadata) : ''}`
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)

  // Write to DB — fire and forget, never throws
  try {
    await query(
      `INSERT INTO system_logs
         (id, level, category, action, user_id, username, ip, path,
          method, status_code, message, metadata, duration_ms)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        level, category, action,
        userId || null, username || null, ip || null,
        path || null, method || null, statusCode || null,
        message || null,
        metadata ? JSON.stringify(metadata) : null,
        durationMs || null,
      ]
    )
  } catch (e) {
    // Never let logging break the app
    console.error('[logger] Failed to write log to DB:', e.message)
  }
}

/**
 * Extract common request info for logging
 */
export function getRequestInfo(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
  const path = new URL(request.url).pathname
  const method = request.method
  return { ip, path, method }
}

// ── Public logging API ─────────────────────────────────────────

export const log = {
  info:  (opts) => writeLog({ level: 'info',  ...opts }),
  warn:  (opts) => writeLog({ level: 'warn',  ...opts }),
  error: (opts) => writeLog({ level: 'error', ...opts }),
  debug: (opts) => writeLog({ level: 'debug', ...opts }),
}

// ── Pre-built log helpers ──────────────────────────────────────

export async function logAuth(action, { userId, username, ip, path, success, message, metadata } = {}) {
  return log[success === false ? 'warn' : 'info']({
    category: 'auth', action, userId, username, ip, path,
    message, metadata,
  })
}

export async function logUserChange(action, { userId, username, changedBy, field, oldVal, newVal, ip, path } = {}) {
  return log.info({
    category: 'user', action, userId, username, ip, path,
    message: field ? `${field}: "${oldVal}" → "${newVal}"` : undefined,
    metadata: { changedBy, field, oldVal, newVal },
  })
}

export async function logApiRequest({ method, path, statusCode, durationMs, userId, username, ip, error } = {}) {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
  return log[level]({
    category: 'api', action: `${method} ${path}`,
    method, path, statusCode, durationMs, userId, username, ip,
    message: error || undefined,
  })
}

export async function logDbQuery(action, { table, operation, rowCount, durationMs, error } = {}) {
  const level = error ? 'error' : 'debug'
  return log[level]({
    category: 'db', action,
    message: error || `${operation} on ${table}${rowCount !== undefined ? ` (${rowCount} rows)` : ''}`,
    durationMs,
    metadata: { table, operation, rowCount },
  })
}

export async function logMiddleware(action, { userId, username, ip, path, allowed, reason } = {}) {
  return log[allowed ? 'info' : 'warn']({
    category: 'middleware', action, userId, username, ip, path,
    message: reason,
    metadata: { allowed },
  })
}
