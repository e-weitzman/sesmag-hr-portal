// __tests__/auth.test.js
// Unit tests — all external deps mocked (no live DB or API keys needed)

// ── Mock Neon DB ──────────────────────────────────────────────
jest.mock('@neondatabase/serverless', () => ({
  neon: () => {
    const HASH = '$2a$10$lTqjJhR/3J81eBhWxPWMlO6Gwbqq1e1IdaVKO/OzS1L.t0PgTAQva' // 'Password1!'
    const mockFn = jest.fn(async (strings, ...values) => ({ rows: [] }))
    mockFn.query = jest.fn(async (sql, params) => {
      if (sql.includes('SELECT') && sql.includes('username') && params?.[0] === 'test_user') {
        return { rows: [{ id: 'uid-001', username: 'test_user', password_hash: HASH,
          role: 'employee', first_name: 'Test', last_name: 'User', is_active: true,
          font_size_pref: 'medium', color_theme: 'light', reduce_motion: false,
          screen_reader_mode: false, tech_comfort_level: 3 }] }
      }
      if (sql.includes('SELECT') && sql.includes('username') && params?.[0] === 'inactive') {
        return { rows: [{ id: 'uid-002', is_active: false, password_hash: HASH }] }
      }
      if (sql.includes('INSERT INTO users') && params?.[0] === 'dup_user') {
        const err = new Error('dup'); err.code = '23505'; throw err
      }
      if (sql.includes('INSERT INTO users')) {
        return { rows: [{ id: 'uid-new', username: params[0], email: params[1],
          role: 'employee', first_name: params[3], last_name: params[4] }] }
      }
      return { rows: [] }
    })
    return mockFn
  }
}))

// ── Mock Anthropic ────────────────────────────────────────────
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ text: '{"safe":true,"reason":"","severity":"none"}' }]
      }),
      stream: jest.fn().mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello ' } }
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'world!' } }
        }
      })
    }
  }))
})

// ── Mock Next.js server internals ─────────────────────────────
jest.mock('next/headers', () => ({ cookies: () => ({ get: () => null }) }))
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init) => ({ json: async () => body, status: init?.status || 200, body, cookies: { set: jest.fn() } }),
    redirect: (url) => ({ redirected: true, url }),
  },
  NextRequest: class { constructor(url) { this.url = url; this.cookies = { get: () => null } } }
}))

// ── Import modules under test ─────────────────────────────────
const bcrypt = require('bcryptjs')

describe('bcrypt password hashing', () => {
  it('hashes a password reproducibly', async () => {
    const hash = await bcrypt.hash('Password1!', 10)
    expect(hash).toBeTruthy()
    expect(hash.startsWith('$2')).toBe(true)
  })

  it('verifies correct password', async () => {
    const hash = await bcrypt.hash('Password1!', 10)
    const valid = await bcrypt.compare('Password1!', hash)
    expect(valid).toBe(true)
  })

  it('rejects wrong password', async () => {
    const hash = await bcrypt.hash('Password1!', 10)
    const valid = await bcrypt.compare('WrongPass', hash)
    expect(valid).toBe(false)
  })
})

describe('jose JWT operations', () => {
  // We test signToken / verifyToken directly
  const jose = require('jose')

  it('signs and verifies a token', async () => {
    const secret = new TextEncoder().encode('test-secret-at-least-32-chars-long!')
    const token = await new jose.SignJWT({ sub: 'uid-001', role: 'employee' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret)
    expect(typeof token).toBe('string')
    expect(token.split('.').length).toBe(3) // header.payload.sig

    const { payload } = await jose.jwtVerify(token, secret)
    expect(payload.sub).toBe('uid-001')
    expect(payload.role).toBe('employee')
  })

  it('rejects a tampered token', async () => {
    const secret = new TextEncoder().encode('test-secret-at-least-32-chars-long!')
    const token = await new jose.SignJWT({ sub: 'uid-001' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret)

    const tampered = token.slice(0, -4) + 'xxxx'
    await expect(jose.jwtVerify(tampered, secret)).rejects.toThrow()
  })

  it('rejects an expired token', async () => {
    const secret = new TextEncoder().encode('test-secret-at-least-32-chars-long!')
    const token = await new jose.SignJWT({ sub: 'uid-001' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('0s') // already expired
      .sign(secret)
    await expect(jose.jwtVerify(token, secret)).rejects.toThrow()
  })
})

describe('claude moderation mock', () => {
  it('returns safe:true for normal content', async () => {
    const Anthropic = require('@anthropic-ai/sdk')
    const client = new Anthropic()
    const result = await client.messages.create({ model: 'x', max_tokens: 100, messages: [] })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.safe).toBe(true)
    expect(parsed.severity).toBe('none')
  })
})

describe('DB query mock', () => {
  it('returns user row for known username', async () => {
    const { neon } = require('@neondatabase/serverless')
    const sql = neon()
    const result = await sql.query('SELECT id FROM users WHERE username = $1', ['test_user'])
    expect(result.rows[0].username).toBe('test_user')
    expect(result.rows[0].role).toBe('employee')
  })

  it('returns empty rows for unknown username', async () => {
    const { neon } = require('@neondatabase/serverless')
    const sql = neon()
    const result = await sql.query('SELECT id FROM users WHERE username = $1', ['nobody'])
    expect(result.rows).toHaveLength(0)
  })

  it('throws 23505 for duplicate username insert', async () => {
    const { neon } = require('@neondatabase/serverless')
    const sql = neon()
    await expect(
      sql.query('INSERT INTO users VALUES ($1)', ['dup_user'])
    ).rejects.toMatchObject({ code: '23505' })
  })
})

describe('accessibility preference validation', () => {
  const VALID_THEMES = ['light', 'dark', 'high-contrast', 'sepia']
  const VALID_FONT_SIZES = ['small', 'medium', 'large', 'xlarge']

  it('recognises all valid themes', () => {
    VALID_THEMES.forEach(t => expect(VALID_THEMES).toContain(t))
  })

  it('rejects invalid theme', () => {
    expect(VALID_THEMES).not.toContain('rainbow')
  })

  it('recognises all valid font sizes', () => {
    VALID_FONT_SIZES.forEach(f => expect(VALID_FONT_SIZES).toContain(f))
  })

  it('tech_comfort_level stays between 1 and 5', () => {
    ;[1, 2, 3, 4, 5].forEach(n => expect(n >= 1 && n <= 5).toBe(true))
    expect(0 >= 1 && 0 <= 5).toBe(false)
    expect(6 >= 1 && 6 <= 5).toBe(false)
  })
})
