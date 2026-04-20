// src/app/api/chat/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { streamChatResponse, moderateContent } from '@/lib/claude'

const serverError = (err) => {
  console.error('[chat]', err)
  return NextResponse.json({ error: 'Internal server error', detail: err.message }, { status: 500 })
}

export async function GET(request) {
  try {
    const { user, error } = await requireAuth(request)
    if (error) return error
    const rows = await query(
      `SELECT id, role, content, created_at FROM chat_messages
       WHERE user_id = $1 ORDER BY created_at ASC LIMIT 100`,
      [user.sub]
    )
    return NextResponse.json({ messages: rows })
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(request) {
  try {
    const { user, error } = await requireAuth(request)
    if (error) return error

    const body = await request.json().catch(() => ({}))
    const { message } = body
    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    const modResult = await moderateContent(message)
    if (!modResult.safe && modResult.severity === 'high') {
      return NextResponse.json({ error: 'Message flagged: ' + modResult.reason, flagged: true }, { status: 422 })
    }

    const userRows = await query(
      `SELECT first_name, last_name, role, department, font_size_pref,
              color_theme, tech_comfort_level FROM users WHERE id = $1`,
      [user.sub]
    )
    const userProfile = userRows[0]

    const historyRows = await query(
      `SELECT role, content FROM chat_messages
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [user.sub]
    )
    const history = [...historyRows].reverse()

    await query(
      `INSERT INTO chat_messages (id, user_id, role, content)
       VALUES (gen_random_uuid()::text, $1, 'user', $2)`,
      [user.sub, message]
    )

    const messages = [...history, { role: 'user', content: message }]
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
          await query(
            `INSERT INTO chat_messages (id, user_id, role, content)
             VALUES (gen_random_uuid()::text, $1, 'assistant', $2)`,
            [user.sub, fullResponse]
          )
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: err.message })}\n\n`))
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
  } catch (err) {
    return serverError(err)
  }
}

export async function DELETE(request) {
  try {
    const { user, error } = await requireAuth(request)
    if (error) return error
    await query('DELETE FROM chat_messages WHERE user_id = $1', [user.sub])
    return NextResponse.json({ message: 'Chat history cleared' })
  } catch (err) {
    return serverError(err)
  }
}
