// src/app/api/chat/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { streamChatResponse, moderateContent } from '@/lib/claude'

// GET /api/chat — fetch chat history for current user
export async function GET(request) {
  const { user, error } = await requireAuth(request)
  if (error) return error

  const result = await query(
    `SELECT id, role, content, created_at
     FROM chat_messages
     WHERE user_id = $1
     ORDER BY created_at ASC
     LIMIT 100`,
    [user.sub]
  )
  return NextResponse.json({ messages: result.rows })
}

// POST /api/chat — send a message, get streaming Claude response
export async function POST(request) {
  const { user, error } = await requireAuth(request)
  if (error) return error

  const body = await request.json().catch(() => ({}))
  const { message } = body

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  // ── CLAUDE MIDDLEWARE: moderate user message before processing ──
  const modResult = await moderateContent(message)
  if (!modResult.safe && modResult.severity === 'high') {
    return NextResponse.json({
      error: 'Message flagged: ' + modResult.reason,
      flagged: true,
    }, { status: 422 })
  }

  // Fetch user profile for context
  const userResult = await query(
    `SELECT first_name, last_name, role, department, font_size_pref,
            color_theme, tech_comfort_level
     FROM users WHERE id = $1`,
    [user.sub]
  )
  const userProfile = userResult.rows[0]

  // Fetch recent conversation history (last 20 messages for context)
  const historyResult = await query(
    `SELECT role, content FROM chat_messages
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [user.sub]
  )
  const history = historyResult.rows.reverse()

  // Save the user's message
  await query(
    `INSERT INTO chat_messages (id, user_id, role, content)
     VALUES (gen_random_uuid()::text, $1, 'user', $2)`,
    [user.sub, message]
  )

  // Build messages array for Claude
  const messages = [...history, { role: 'user', content: message }]

  // Stream the response
  const stream = await streamChatResponse(messages, userProfile)

  let fullResponse = ''

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const chunk = event.delta.text
            fullResponse += chunk
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ chunk })}\n\n`))
          }
        }
        // Save complete response to DB
        await query(
          `INSERT INTO chat_messages (id, user_id, role, content)
           VALUES (gen_random_uuid()::text, $1, 'assistant', $2)`,
          [user.sub, fullResponse]
        )
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify({ error: err.message })}\n\n`)
        )
        controller.close()
      }
    },
  })

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// DELETE /api/chat — clear chat history
export async function DELETE(request) {
  const { user, error } = await requireAuth(request)
  if (error) return error

  await query('DELETE FROM chat_messages WHERE user_id = $1', [user.sub])
  return NextResponse.json({ message: 'Chat history cleared' })
}
