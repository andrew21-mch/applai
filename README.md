# ApplAI

An open-source AI agent that searches for jobs and scholarships, scores them against your resume, drafts application materials, and can auto-fill application forms via Playwright — with your approval.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/YOUR_USERNAME/applai/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/applai/actions/workflows/ci.yml)

## Features

- **Resume-driven search** — upload a CV; Tavily queries are built from your skills, role, and experience
- **ATS-focused crawling** — targets Greenhouse, Lever, Ashby, Remotive, and similar apply URLs
- **AI scoring** — hybrid rule-based + Ollama matching against your profile
- **Draft generation** — cover letters and scholarship essays via local Ollama
- **Dashboard** — review, approve, reject, clear crawled results, rescore
- **Safe apply flow** — approve previews form fill first; submit only after explicit confirmation
- **Application history** — audit log of every preview and submission attempt
- **Health dashboard** — check Ollama, Supabase, Tavily, and Playwright at `/status`
- **Docker Compose** — one-command API + dashboard setup
- **Notifications** — optional email digest and Twilio WhatsApp alerts
- **Scheduled pipeline** — daily search at 6 AM, digest at 8 AM

## Architecture

```
Resume upload (/profile)
    ↓
Search Agent (Tavily → ATS job boards)
    ↓
Filter Agent (skill overlap + Ollama score)
    ↓
Writer Agent (cover letter / essay drafts)
    ↓
Dashboard review → Approve & Preview (dry-run)
    ↓
Confirm & Submit (explicit)
```

## Tech stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js, TypeScript |
| LLM | [Ollama](https://ollama.com) (local or cloud models) |
| Search | [Tavily](https://tavily.com) |
| Database | [Supabase](https://supabase.com) (PostgreSQL) |
| API | Express |
| Dashboard | Next.js |
| Browser automation | Playwright |
| Notifications | Nodemailer, Twilio (optional) |

## Quick start

### Prerequisites

- Node.js 20+
- [Ollama](https://ollama.com) running locally (`ollama serve`)
- Tavily API key
- Supabase project

### Install

```bash
git clone https://github.com/YOUR_USERNAME/applai.git
cd applai
npm install
npx playwright install chromium

cd dashboard && npm install && cd ..
cp .env.example .env
cp dashboard/.env.local.example dashboard/.env.local
```

Fill in `.env` and `dashboard/.env.local`. See [Environment variables](#environment-variables).

### Database

Run the SQL files in [supabase/](supabase/README.md), then create Storage buckets `resumes` and `screenshots`.

### Run

```bash
# Terminal 1 — API (port 4000)
npm run dev

# Terminal 2 — Dashboard (port 4001)
npm run dev:dashboard
```

1. Upload your resume at [http://localhost:4001/profile](http://localhost:4001/profile)
2. Click **Run Search** on the home page
3. Review opportunities, click **Approve & Preview** (fills form, no submit)
4. Check screenshot and form fill report, then **Confirm & Submit**

### Docker

```bash
cp .env.example .env   # fill in keys
docker compose up --build
```

API: [http://localhost:4000](http://localhost:4000) · Dashboard: [http://localhost:4001](http://localhost:4001)

Ollama must run on the host (`ollama serve`). The API container connects via `host.docker.internal:11434`.

## Environment variables

Copy `.env.example` to `.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `TAVILY_API_KEY` | Yes | Tavily search API key |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes* | Backend key (bypasses RLS) |
| `SUPABASE_ANON_KEY` | Yes* | Public anon key |
| `OLLAMA_BASE_URL` | No | Default `http://localhost:11434` |
| `OLLAMA_MODEL` | No | Auto-detected from `ollama list` if unset |
| `EMAIL_USER` / `EMAIL_PASS` / `NOTIFICATION_EMAIL` | No | Gmail digest notifications |
| `TWILIO_*` / `WHATSAPP_TO` | No | WhatsApp digest |
| `PLAYWRIGHT_HEADLESS` | No | `true` (default) or `false` to watch the browser |
| `PORT` | No | API port (default `4000`) |
| `DASHBOARD_URL` | No | CORS origin (default `http://localhost:4001`) |

\* Use the service role key for the API server. Never commit it or expose it in the Next.js app.

Dashboard: set `NEXT_PUBLIC_API_URL=http://localhost:4000` in `dashboard/.env.local`.

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/opportunities` | List (filters: `status`, `type`, `minScore`) |
| `GET` | `/api/opportunities/:id` | Detail + application draft |
| `POST` | `/api/opportunities/:id/approve` | Approve + preview form (dry-run) |
| `POST` | `/api/opportunities/:id/approve` `{ "apply": true }` | Approve + submit immediately |
| `GET` | `/api/history` | Submission audit log |
| `GET` | `/health` | Service health (`?deep=true` for full checks) |
| `POST` | `/api/opportunities/:id/reject` | Reject |
| `POST` | `/api/opportunities/clear` | Clear crawled results |
| `POST` | `/api/opportunities/rescore` | Re-run match scoring |
| `POST` | `/api/submit/:id` | Prepare submission (preview) |
| `POST` | `/api/profile/resume` | Upload resume |
| `GET` | `/api/profile` | Active profile |
| `POST` | `/api/run-search` | Run search pipeline |
| `GET` | `/api/pipeline/stream` | Live pipeline logs (SSE) |
| `GET` | `/health` | Health check |

## Project structure

```
applai/
├── prompts/           # LLM prompt templates
├── src/
│   ├── agents/        # search, filter, writer, submission
│   ├── api/           # Express routes
│   ├── config/        # env, sources, defaults
│   ├── services/      # supabase, ollama, profile, notifier
│   └── utils/         # form fill, match scoring, URL filters
├── dashboard/         # Next.js UI
└── supabase/          # SQL schema + setup notes
```

## Customizing your profile

Upload a resume at **/profile** in the dashboard. Skills, experience, and education are extracted automatically and drive search, scoring, and cover letters.

Static fallbacks in `src/config/profile.ts` apply only before a resume is uploaded.

## Auto-apply limitations

- Works best on **direct application URLs** (Greenhouse, Lever, Ashby, etc.)
- Some sites require login, CAPTCHA, or custom question flows that cannot be automated
- Always review the submission screenshot before confirming
- You are responsible for applications submitted through this tool

## Publishing checklist

Before pushing to GitHub:

- [ ] `.env` and `dashboard/.env` are **not** committed (covered by `.gitignore`)
- [ ] No API keys or passwords in source code
- [ ] Rotate any keys that were ever committed or shared
- [ ] Update `package.json` `repository` URL to your fork

```bash
git init
git add .
git status   # verify .env is not listed
git commit -m "Initial open-source release"
git remote add origin https://github.com/YOUR_USERNAME/applai.git
git push -u origin main
```

## Contributing

Contributions welcome. Open an issue or PR on GitHub.

## License

[MIT](LICENSE) — Copyright (c) 2026 ApplAI contributors
