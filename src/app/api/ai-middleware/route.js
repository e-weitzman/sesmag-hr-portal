// src/app/api/ai-middleware/route.js
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAccessibilityRecommendations, interpretSearchQuery } from '@/lib/claude'

export async function POST(request) {
  try {
    const { user, error } = await requireAuth(request)
    if (error) return error

    const body = await request.json().catch(() => ({}))
    const { action } = body

    if (action === 'accessibility-advice') {
      const { difficulty, currentSettings } = body
      if (!difficulty) return NextResponse.json({ error: 'difficulty required' }, { status: 400 })
      const result = await getAccessibilityRecommendations(difficulty, currentSettings)
      return NextResponse.json(result)
    }

    if (action === 'smart-search') {
      const { q } = body
      if (!q) return NextResponse.json({ name: '', department: '', role: '' })
      const result = await interpretSearchQuery(q)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[ai-middleware]', err)
    return NextResponse.json({ error: 'Internal server error', detail: err.message }, { status: 500 })
  }
}
