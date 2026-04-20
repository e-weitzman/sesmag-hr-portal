# SESMag HR Portal — Vercel Edition
**CPS*3500 | Next.js · Neon PostgreSQL · Claude AI · Vercel**

> A fully serverless, Vercel-hosted HR portal for all SESMag personas.  
> No local database. No local server. Deploy in under 15 minutes.

---

## Architecture

```
Browser → Vercel Edge (Next.js)
                │
                ├── /app/*         React Server + Client Components
                ├── /api/auth      Login / logout / session (httpOnly cookie JWT)
                ├── /api/users     CRUD with Claude content-moderation middleware
                ├── /api/chat      Streaming Claude HR assistant (SSE)
                └── /api/ai-middleware
                       ├── accessibility-advice  (Claude recommends settings)
                       └── smart-search          (Claude parses natural language)
                             │
                 ┌───────────┼───────────────┐
           Neon DB        Claude API      Vercel KV (optional)
        (serverless PG) (claude-sonnet-4)
```

---

## Live Demo Accounts

| Username | Password | Role | Persona |
|---|---|---|---|
| `admin` | `Password1!` | Admin | Full access |
| `patricia_m` | `Password1!` | Manager | Team view + change log |
| `dav_persona` | `Password1!` | Employee | High-contrast · XL font · DAV |
| `tim_c` | `Password1!` | Employee | Large font · mobile-first |
| `abi_k` | `Password1!` | Employee | Screen reader · high-contrast |
| `gary_w` | `Password1!` | Employee | XL font · reduced motion |

---

## Deploy to Vercel (15 min)

### Step 1 — Set Up Neon Database (free)

1. Go to **https://console.neon.tech** and create a free account
2. Click **"New Project"** → name it `sesmag-hr`
3. In your project, click **"SQL Editor"**
4. Paste the entire contents of **`sql/schema.sql`** and click **Run**
5. You should see `INSERT 0 6` at the bottom — seed data is included
6. Go to **"Dashboard"** → **"Connection string"**
7. Copy the **connection string** — it looks like:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/sesmag_hr?sslmode=require
   ```

### Step 2 — Get an Anthropic API Key

1. Go to **https://console.anthropic.com**
2. Sign in or create an account
3. Navigate to **"API Keys"** → **"Create Key"**
4. Copy the key (starts with `sk-ant-api03-...`)
5. Add some credits if your account is new (the app uses claude-sonnet-4)

### Step 3 — Push to GitHub

```bash
# In the sesmag-vercel/ directory:
git init
git add .
git commit -m "Initial SESMag HR Portal"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/sesmag-hr-portal.git
git push -u origin main
```

### Step 4 — Deploy on Vercel

1. Go to **https://vercel.com** → sign in with GitHub
2. Click **"Add New Project"**
3. Import your `sesmag-hr-portal` repository
4. Vercel auto-detects Next.js — leave all settings as-is
5. Click **"Environment Variables"** and add these three:

| Name | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string from Step 1 |
| `ANTHROPIC_API_KEY` | Your Anthropic API key from Step 2 |
| `JWT_SECRET` | Any random 64-char string (generate below) |

**Generate a JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

6. Click **"Deploy"** — Vercel builds and deploys in ~2 minutes
7. Your app is live at `https://your-project.vercel.app` 🎉

---

## Local Development

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/sesmag-hr-portal.git
cd sesmag-hr-portal
npm install

# Configure environment
cp .env.example .env.local
# Fill in DATABASE_URL, ANTHROPIC_API_KEY, JWT_SECRET

# Run dev server (Next.js, no local DB needed — uses Neon)
npm run dev
# → http://localhost:3000
```

---

## Claude AI Features

### 1. Chat Interface (`/chat`)
- Full HR assistant powered by `claude-sonnet-4`
- **Streaming responses** via SSE — text appears word-by-word
- **Conversation history** persisted in Neon DB per user
- Adapts communication style to the user's `tech_comfort_level` (1–5)
- Suggested questions for low-tech users (DAV, Gary)

### 2. Content Moderation Middleware (`/api/users PATCH`)
- Every bio update is **moderated by Claude** before saving
- High-severity content is blocked with a clear error message
- Low-severity is allowed through with a warning flag

### 3. Bio Enhancement Middleware (`/api/users PATCH`)
- When a user saves their bio, Claude **automatically polishes it** to be professional
- Original intent preserved; grammar and tone improved
- User sees a note: *"Your bio was professionally polished by AI"*

### 4. Accessibility Advisor (`/accessibility`)
- User types a difficulty in plain English (e.g. "the text hurts my eyes")
- Claude returns **structured JSON recommendations** with one-click Apply buttons
- Each recommendation shows the setting name, new value, and reasoning

### 5. Smart Team Search (`/team`)
- Natural language search: "engineers in product" or "find managers"
- Claude interprets the query into `{name, department, role}` filters
- Falls back to direct text search on API error

---

## Project Structure

```
sesmag-vercel/
├── sql/
│   └── schema.sql          ← Paste into Neon SQL Editor
├── src/
│   ├── app/
│   │   ├── layout.js       ← Root layout + Google Fonts
│   │   ├── globals.css     ← Theme system (light/dark/high-contrast/sepia + font tiers)
│   │   ├── page.js         ← Login page
│   │   ├── dashboard/      ← Dashboard
│   │   ├── chat/           ← AI chat interface
│   │   ├── profile/        ← Profile view + edit
│   │   ├── team/           ← Team directory (manager+)
│   │   ├── accessibility/  ← Accessibility settings + AI advisor
│   │   ├── admin/          ← Admin panel (admin only)
│   │   └── api/
│   │       ├── auth/       ← Login, logout, register, session
│   │       ├── users/      ← User CRUD + change log
│   │       ├── chat/       ← Streaming Claude chat + history
│   │       └── ai-middleware/ ← Accessibility advice + smart search
│   ├── components/
│   │   ├── AppShell.js     ← Sidebar + topbar layout
│   │   ├── Providers.js    ← Auth context provider
│   │   └── ui.js           ← Avatar, Badge, Alert, Toggle, Spinner
│   ├── hooks/
│   │   └── useAuth.js      ← Auth state + session management
│   ├── lib/
│   │   ├── db.js           ← Neon serverless SQL client
│   │   ├── auth.js         ← JWT (jose) sign/verify + cookie helpers
│   │   └── claude.js       ← All Claude AI integrations
│   └── middleware.js       ← Next.js Edge route protection
├── __tests__/
│   └── auth.test.js        ← 14 unit tests (all pass, no live deps)
├── .env.example
├── .gitignore
├── jsconfig.json
├── next.config.js
├── package.json
└── vercel.json
```

---

## Running Tests

```bash
npm test
# → 14 tests pass, no live DB or API key needed (all mocked)
```

---

## Accessibility Features

| Feature | Implementation |
|---|---|
| 4 color themes | CSS custom properties on `<html data-theme>` |
| 4 font size tiers | CSS custom properties on `<html data-fs>` (87.5%–145%) |
| Reduce motion | `<html data-reduce-motion>` disables all animations |
| Screen reader support | ARIA roles, live regions, skip nav, `scope` on tables |
| Keyboard navigation | Full tab order, visible focus rings (3px solid) |
| Touch targets | All buttons ≥ 44×44px (WCAG 2.5.5) |
| Semantic HTML | `<main>`, `<nav>`, `<header>`, `<section>`, `<dl>` |
| Prefs persistence | Saved to DB, auto-applied on every login |

---

## SESMag Analysis

The portal is designed so that logging in as each persona immediately demonstrates the SESMag framework in action:

- **DAV** — high-contrast theme + XL font activate automatically; AI assistant uses plain short sentences at comfort level 2
- **Gary** — same as DAV + reduce motion; navigation uses plain-English labels only
- **Abi** — high-contrast + screen reader mode; all tables have `scope`, live regions announce updates
- **Tim** — large font + light theme; sidebar collapses to scrollable row on mobile
- **Patricia** — dark theme + full manager dashboard; AI responses are concise and technical at comfort level 5
