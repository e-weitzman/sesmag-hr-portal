// src/lib/db.js
// Neon serverless PostgreSQL — works in both Node.js and Vercel Edge runtimes
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// neon() returns a tagged-template SQL function
// Usage: const rows = await sql`SELECT * FROM users WHERE id = ${id}`
export const sql = neon(process.env.DATABASE_URL)

/**
 * Helper that wraps neon's tagged template for positional params.
 * Usage: query('SELECT * FROM users WHERE id = $1', [id])
 */
export async function query(text, params = []) {
  // neon supports both tagged templates and .query() method
  return sql.query(text, params)
}
