// src/lib/claude.js
// Claude AI integration — used as intelligent middleware throughout the app.
// All calls are server-side only (API routes / server components).

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = 'claude-sonnet-4-20250514'

// ── SYSTEM PROMPTS ─────────────────────────────────────────────

const HR_ASSISTANT_SYSTEM = `You are an HR assistant for the SESMag HR Portal — an inclusive HR system designed to serve users across all technology comfort levels, from beginners to experts. You help employees with HR-related questions, company policies, benefits, accessibility features, and general workplace topics.

SESMag (Self-Efficacy Survey for Marginalized Groups) personas you may be helping:
- DAV: Lower tech comfort, needs plain language, prefers large text and high contrast
- Gary: Older adult, low digital confidence, very literal communication preferred
- Tim: Mobile-first user, basic tasks only, brief responses appreciated  
- Abi: Screen reader user, values structure and clarity
- Patricia: High tech comfort, manager, prefers concise professional responses

Adapt your communication style to the user's tech_comfort_level (1=beginner, 5=expert).
For comfort levels 1-2: Use very simple language, short sentences, numbered steps.
For comfort levels 3: Standard helpful tone, moderate detail.
For comfort levels 4-5: Can use technical terms, be concise.

Always be warm, patient, and never condescending. If asked something outside HR/work topics, 
gently redirect to work-related assistance.`

const CONTENT_MODERATION_SYSTEM = `You are a content safety classifier for an HR portal. 
Analyze the user's message and respond with ONLY a JSON object — no markdown, no explanation.
Format: {"safe": true/false, "reason": "brief reason if unsafe, empty string if safe", "severity": "none/low/medium/high"}
Flag as unsafe if the message contains: personal attacks, harassment, discriminatory language, requests to extract all user data, attempts to bypass authentication, or clearly malicious prompts. 
Legitimate HR questions, accessibility questions, and frustrated-but-civil messages should be SAFE.`

const PROFILE_ENHANCEMENT_SYSTEM = `You are a professional bio writer for an HR system.
Given a user's raw bio text and their job title, rewrite the bio to be professional, warm, and 2-3 sentences.
Preserve the core facts. Do not add information that wasn't provided.
Respond with ONLY the improved bio text — no quotes, no explanation.`

const ACCESSIBILITY_ADVISOR_SYSTEM = `You are an accessibility advisor for the SESMag HR Portal.
Given a user's current accessibility settings and their described difficulty, 
recommend specific setting changes from: font_size_pref (small/medium/large/xlarge), 
color_theme (light/dark/high-contrast/sepia), reduce_motion (true/false), screen_reader_mode (true/false).
Respond with ONLY a JSON object: {"recommendations": [{"setting": "...", "value": "...", "reason": "..."}], "message": "friendly explanation"}`

// ── PUBLIC API ─────────────────────────────────────────────────

/**
 * Main chat endpoint — conversational HR assistant.
 * Returns a streaming response for the chat UI.
 */
export async function streamChatResponse(messages, userProfile) {
  const systemPrompt = `${HR_ASSISTANT_SYSTEM}

Current user context:
- Name: ${userProfile.first_name} ${userProfile.last_name}
- Role: ${userProfile.role}
- Department: ${userProfile.department || 'unknown'}
- Tech comfort level: ${userProfile.tech_comfort_level}/5
- Accessibility: font=${userProfile.font_size_pref}, theme=${userProfile.color_theme}`

  return anthropic.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  })
}

/**
 * Content moderation middleware — called before saving any user-submitted content.
 * Returns { safe: bool, reason: string, severity: string }
 */
export async function moderateContent(text) {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: CONTENT_MODERATION_SYSTEM,
      messages: [{ role: 'user', content: `Classify this message: "${text}"` }],
    })
    const raw = response.content[0].text.trim()
    return JSON.parse(raw)
  } catch {
    // Fail open — if moderation errors, allow the content
    return { safe: true, reason: '', severity: 'none' }
  }
}

/**
 * Profile bio enhancement — improves raw bio text professionally.
 * Used as middleware when a user saves their profile bio.
 */
export async function enhanceBio(rawBio, jobTitle) {
  if (!rawBio || rawBio.trim().length < 10) return rawBio
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: PROFILE_ENHANCEMENT_SYSTEM,
      messages: [{
        role: 'user',
        content: `Job title: ${jobTitle || 'Employee'}\nRaw bio: ${rawBio}`,
      }],
    })
    return response.content[0].text.trim()
  } catch {
    return rawBio // Fall back to original on error
  }
}

/**
 * Accessibility advisor — suggests settings based on described difficulty.
 * Returns structured recommendations.
 */
export async function getAccessibilityRecommendations(difficulty, currentSettings) {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: ACCESSIBILITY_ADVISOR_SYSTEM,
      messages: [{
        role: 'user',
        content: `Current settings: ${JSON.stringify(currentSettings)}\nDescribed difficulty: ${difficulty}`,
      }],
    })
    const raw = response.content[0].text.trim()
    return JSON.parse(raw)
  } catch {
    return { recommendations: [], message: 'I had trouble analyzing your settings. Please try adjusting them manually.' }
  }
}

/**
 * Smart search — uses Claude to interpret a natural language search query
 * into structured filters for the team directory.
 */
export async function interpretSearchQuery(query) {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: `Convert natural language HR search queries to JSON filters. 
Respond ONLY with JSON: {"name": "partial name or empty", "department": "department or empty", "role": "role or empty"}
Examples: "engineers in product" → {"name":"","department":"product","role":""}
"find patricia" → {"name":"patricia","department":"","role":""}`,
      messages: [{ role: 'user', content: query }],
    })
    return JSON.parse(response.content[0].text.trim())
  } catch {
    return { name: query, department: '', role: '' }
  }
}
