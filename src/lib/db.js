// src/lib/db.js
// Neon serverless PostgreSQL
// neon() returns a function callable two ways:
//   1. Tagged template:  sql`SELECT * FROM users WHERE id = ${id}`
//   2. Plain function:   sql('SELECT * FROM users WHERE id = $1', [id])
// We use option 2 throughout for compatibility with parameterised queries.

import { neon } from '@neondatabase/serverless'

let _sql = null

function getSQL() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    _sql = neon(process.env.DATABASE_URL)
  }
  return _sql
}

/**
 * query(text, params) — executes a parameterised SQL statement.
 * Returns the rows array directly (neon returns rows, not { rows }).
 */
export async function query(text, params = []) {
  const sql = getSQL()
  // Calling neon's function with (string, paramsArray) is the correct
  // API for parameterised queries — returns a Promise<Row[]>
  return sql(text, params)
}
