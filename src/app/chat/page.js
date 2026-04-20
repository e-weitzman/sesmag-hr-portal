'use client'
// src/app/chat/page.js — AI HR Assistant with streaming Claude responses
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import AppShell from '@/components/AppShell'
import { Avatar, Spinner } from '@/components/ui'

const SUGGESTIONS = [
  'What are my PTO benefits?',
  'How do I update my accessibility settings?',
  'Explain the SESMag personas',
  'What does the high-contrast mode do?',
  'How do I contact HR?',
  'What is my tech comfort level for?',
]

function MarkdownText({ text }) {
  // Simple inline markdown renderer (bold, code, line breaks)
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i}>{part.slice(1, -1)}</code>
        if (part === '\n') return <br key={i} />
        return part
      })}
    </>
  )
}

export default function ChatPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [historyLoading, setHistoryLoading] = useState(true)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (!loading && !user) router.push('/')
  }, [user, loading, router])

  // Load chat history
  useEffect(() => {
    if (!user) return
    fetch('/api/chat')
      .then(r => r.json())
      .then(d => setMessages(d.messages || []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [user])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: user?.reduce_motion ? 'instant' : 'smooth' })
  }, [messages, streamBuffer, user?.reduce_motion])

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg || streaming) return

    setInput('')
    setStreaming(true)
    setStreamBuffer('')

    // Optimistically add user message
    const userMsg = { role: 'user', content: msg, created_at: new Date().toISOString(), id: Date.now() }
    setMessages(prev => [...prev, userMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMessages(prev => [...prev, {
          role: 'assistant', content: `Sorry, I couldn't process that: ${err.error || 'Unknown error'}`,
          created_at: new Date().toISOString(), id: Date.now() + 1,
        }])
        setStreaming(false)
        return
      }

      // Read SSE stream
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const { chunk, error } = JSON.parse(data)
            if (chunk) { full += chunk; setStreamBuffer(full) }
            if (error) console.error('Stream error:', error)
          } catch {}
        }
      }

      // Commit streamed message to list
      setMessages(prev => [...prev, {
        role: 'assistant', content: full,
        created_at: new Date().toISOString(), id: Date.now() + 1,
      }])
      setStreamBuffer('')
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant', content: 'I had trouble connecting. Please try again.',
        created_at: new Date().toISOString(), id: Date.now() + 1,
      }])
    } finally {
      setStreaming(false)
      textareaRef.current?.focus()
    }
  }, [input, streaming])

  async function clearHistory() {
    if (!confirm('Clear your entire chat history?')) return
    await fetch('/api/chat', { method: 'DELETE' })
    setMessages([])
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Auto-resize textarea
  function handleInput(e) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
  }

  if (loading || !user) return null

  const allMessages = messages
  const showEmpty = allMessages.length === 0 && !historyLoading

  return (
    <AppShell>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>AI HR Assistant</h1>
        {messages.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={clearHistory} aria-label="Clear chat history">
            Clear history
          </button>
        )}
      </div>

      <div className="chat-shell" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Messages area */}
        <div
          className="chat-messages"
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
          aria-atomic="false"
          style={{
            flex: 1, overflowY: 'auto',
            background: 'var(--bg)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            marginBottom: '1rem',
          }}
        >
          {showEmpty && (
            <div className="chat-empty">
              <div className="chat-empty-icon" aria-hidden="true">✦</div>
              <h3>Your AI HR Assistant</h3>
              <p style={{ fontSize: '0.88em', maxWidth: 380, lineHeight: 1.7 }}>
                Ask me anything about HR policies, benefits, accessibility features,
                or how to use this portal. I adapt to your tech comfort level.
              </p>
              <div className="chat-suggestions" role="list" aria-label="Suggested questions">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s} className="chat-suggestion" role="listitem"
                    onClick={() => sendMessage(s)}
                    disabled={streaming}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {allMessages.map((msg) => (
            <div
              key={msg.id || msg.created_at}
              className={`chat-bubble-wrap ${msg.role}`}
            >
              {msg.role === 'assistant' && (
                <div
                  className="avatar"
                  style={{ background: 'var(--accent)', flexShrink: 0, marginTop: 2 }}
                  aria-hidden="true"
                >
                  ✦
                </div>
              )}
              <div>
                <div className={`chat-bubble ${msg.role}`}>
                  <MarkdownText text={msg.content} />
                </div>
                <div className="chat-timestamp">
                  {msg.role === 'assistant' ? 'AI Assistant' : 'You'} ·{' '}
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {msg.role === 'user' && <Avatar user={user} />}
            </div>
          ))}

          {/* Streaming indicator */}
          {streaming && streamBuffer === '' && (
            <div className="chat-bubble-wrap assistant">
              <div className="avatar" style={{ background: 'var(--accent)' }} aria-hidden="true">✦</div>
              <div className="chat-typing" aria-label="AI is typing">
                <span /><span /><span />
              </div>
            </div>
          )}

          {/* Live streaming text */}
          {streaming && streamBuffer !== '' && (
            <div className="chat-bubble-wrap assistant">
              <div className="avatar" style={{ background: 'var(--accent)' }} aria-hidden="true">✦</div>
              <div className="chat-bubble assistant">
                <MarkdownText text={streamBuffer} />
                <span style={{ opacity: 0.5, animation: 'pulse 1s infinite' }}>▊</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div
          className="chat-input-bar"
          style={{
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={`Ask anything, ${user.first_name}… (Enter to send, Shift+Enter for new line)`}
            disabled={streaming}
            rows={1}
            aria-label="Message input"
          />
          <button
            className="btn btn-primary"
            onClick={() => sendMessage()}
            disabled={!input.trim() || streaming}
            aria-label="Send message"
            style={{ alignSelf: 'flex-end', minWidth: 80 }}
          >
            {streaming ? <Spinner size={16} /> : '↑ Send'}
          </button>
        </div>

        <p style={{ fontSize: '0.72em', color: 'var(--text3)', textAlign: 'center', marginTop: '0.5rem' }}>
          Powered by Claude · Conversations are saved to your profile
        </p>
      </div>
    </AppShell>
  )
}
