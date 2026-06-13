# ApplAI backlog

Gradual issue list for the project. Copy items into [GitHub Issues](https://github.com/YOUR_USERNAME/applai/issues/new/choose) as you pick them up, or reference by ID in PRs (`Closes #12`).

**Priority:** P0 = do first · P1 = high value · P2 = medium · P3 = later / nice-to-have

---

## Epic — Profile intelligence, form assist & subscriptions (in progress)

| Feature | Status | Notes |
|---------|--------|-------|
| AI career level from resume | **Done (Phase 1)** | Runs on upload; `career_analysis` JSON on profile |
| Profile-based search queries | **Done** | Uses target roles + level prefix in Tavily queries |
| Seniority-aware match scoring | **Done** | Penalizes intern/senior mismatches |
| Form field scan + AI suggestions | **Done (Phase 1)** | `POST /api/opportunities/:id/scan-form` + dashboard button |
| Job email subscriptions | **Done (Phase 1)** | `POST /api/subscribe`; digest sends to subscribers |
| Auto-fill from suggestions | **Backlog #26** | Preview shows suggestions; Playwright fill not wired yet |
| Per-subscriber profile crawl | **Backlog #27** | Today: one global profile; subs get filtered digest |
| Multi-user auth + own profile | **Backlog #21** | Required for true SaaS subscriptions |

### #26 Auto-fill application forms from AI suggestions
- **Labels:** `auto-apply`, `ai`
- **Status:** open
- **Description:** Scan suggests answers but approve flow still uses hardcoded heuristics in `formFill.ts`.
- **Acceptance criteria:**
  - [ ] Use suggestions from scan when filling during approve/preview
  - [ ] User can edit suggestions in dashboard before confirm submit
  - [ ] Log which fields used AI vs profile

### #27 Per-subscriber profile & crawl
- **Labels:** `search`, `subscriptions`, `multi-user`
- **Status:** open
- **Description:** Subscribers get digest filtered by min score only; crawl uses single active profile.
- **Acceptance criteria:**
  - [ ] Link subscription to uploaded profile or invite flow
  - [ ] Search pipeline keyed to profile id
  - [ ] Digest deduped per subscriber preferences + career level

---

## P0 — Personal setup & daily use

### #1 Fix Gmail notification credentials
- **Labels:** `notifications`, `setup`, `bug`
- **Status:** open
- **Description:** Email digest and test send fail with Gmail `535 BadCredentials`. App uses Nodemailer with `service: 'gmail'` and requires a Google App Password.
- **Acceptance criteria:**
  - [ ] 2FA enabled on Google account
  - [ ] New App Password in `EMAIL_PASS`
  - [ ] `POST /api/send-digest` `{ "test": true }` succeeds
  - [ ] **Send test** on `/status` shows success
- **Docs:** [README — Gmail notifications](../README.md#gmail-notifications-optional)

### #2 End-to-end dogfood run
- **Labels:** `testing`, `setup`
- **Status:** open
- **Description:** Validate the full pipeline on real data before relying on it or publishing.
- **Acceptance criteria:**
  - [ ] Resume uploaded at `/profile`
  - [ ] Search finds ATS apply URLs (not listing pages)
  - [ ] Match scores look reasonable after **Rescore all**
  - [ ] **Approve & Preview** fills form and saves screenshot
  - [ ] Entry appears on `/history`
  - [ ] `submission_logs` table exists in Supabase

### #3 Replace `YOUR_USERNAME` placeholders
- **Labels:** `oss`, `docs`
- **Status:** open
- **Description:** README and `package.json` still use `YOUR_USERNAME` for repo URLs and CI badge.
- **Acceptance criteria:**
  - [ ] README clone/badge/remote URLs updated
  - [ ] `package.json` `repository`, `bugs`, `homepage` updated
  - [ ] `docs/BACKLOG.md` issue links updated

### #4 Tune scheduler for real use
- **Labels:** `notifications`, `scheduler`, `config`
- **Status:** open
- **Description:** Default 6 AM / 8 AM cron may not match timezone or score threshold. Digest hardcodes min score 60 while dashboard defaults to “Any score”.
- **Acceptance criteria:**
  - [ ] `CRON_SEARCH`, `CRON_DIGEST`, `CRON_TZ` set in `.env`
  - [ ] `DIGEST_MIN_SCORE` aligned with how you filter opportunities
  - [ ] Scheduler log on startup shows correct expressions
  - [ ] API kept running (or documented) when cron should fire

---

## P1 — Security & reliability

### #5 API authentication for mutating endpoints
- **Labels:** `security`, `api`
- **Status:** open
- **Description:** `/approve`, `/reject`, `/submit`, `/clear`, `/run-search`, `/send-digest` are unauthenticated. Risky if API is exposed beyond localhost.
- **Acceptance criteria:**
  - [ ] `API_SECRET` (or similar) env var
  - [ ] Middleware rejects missing/invalid secret on POST mutating routes
  - [ ] Dashboard sends secret via header or env
  - [ ] README documents setup; dev mode optional bypass for local only
- **Depends on:** #2 (know which routes matter)

### #6 Generic SMTP support
- **Labels:** `notifications`, `enhancement`
- **Status:** open
- **Description:** Email is Gmail-only (`service: 'gmail'`). Support Outlook, SendGrid, Mailgun, self-hosted SMTP.
- **Acceptance criteria:**
  - [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` in `.env.example`
  - [ ] Fallback to Gmail preset when `SMTP_HOST` unset
  - [ ] `verifyEmailTransport()` works for generic SMTP
  - [ ] README updated with examples (Gmail app password + SendGrid)

### #7 Instant notifications on new matches
- **Labels:** `notifications`, `enhancement`
- **Status:** open
- **Description:** `sendNotification()` exists but is never called. Users only get the 8 AM digest.
- **Acceptance criteria:**
  - [ ] After search/filter pipeline, notify when new opportunities ≥ `NOTIFY_MIN_SCORE`
  - [ ] Env flag `NOTIFY_ON_MATCH=true` (default off for noisy local dev)
  - [ ] Single consolidated message per pipeline run (not one email per job)
  - [ ] No duplicate alerts for already-notified IDs

### #8 Unit tests for core logic
- **Labels:** `testing`, `ci`
- **Status:** open
- **Description:** No tests today; CI only builds TypeScript.
- **Acceptance criteria:**
  - [ ] Test runner added (e.g. Vitest or Node test runner)
  - [ ] Tests for `matchScore.ts`, `applicationUrls.ts`, cron validation in `scheduler.ts`
  - [ ] CI job runs `npm test`
- **Suggested first files:** `src/utils/matchScore.ts`, `src/utils/applicationUrls.ts`

### #9 API integration tests (smoke)
- **Labels:** `testing`, `api`
- **Status:** open
- **Description:** Lightweight HTTP tests for `/health`, `/api/opportunities`, error shapes.
- **Acceptance criteria:**
  - [ ] Mock or skip Supabase/Tavily in CI
  - [ ] `/health` returns expected JSON shape including `notifications` and `scheduler`
  - [ ] 404/400 responses are consistent

---

## P1 — Product & UX

### #10 Dashboard: Run search from home
- **Labels:** `dashboard`, `ux`
- **Status:** open
- **Description:** Search is only via API/CLI today; dashboard should trigger pipeline and show live progress.
- **Acceptance criteria:**
  - [ ] Button on opportunities home calls `POST /api/run-search`
  - [ ] Subscribes to `/api/pipeline/stream` or polls status
  - [ ] Shows phase, logs, summary (found / shortlisted / drafts)
  - [ ] Disabled while pipeline running

### #11 Dashboard: digest min score control
- **Labels:** `dashboard`, `notifications`
- **Status:** open
- **Description:** Status page can send digest but min score is only via API body or env.
- **Acceptance criteria:**
  - [ ] Optional min score input on `/status` before **Send digest now**
  - [ ] Shows count preview or clear message when zero results

### #12 Static README screenshots
- **Labels:** `docs`, `oss`
- **Status:** open
- **Description:** Demo GIF exists; PNGs for key screens improve GitHub README rendering.
- **Acceptance criteria:**
  - [ ] `docs/screenshots/dashboard-home.png`
  - [ ] `docs/screenshots/opportunity-detail.png`
  - [ ] `docs/screenshots/status.png`
  - [ ] README Screenshots section uncommented/updated

### #13 Opportunity detail: submission screenshot preview
- **Labels:** `dashboard`, `ux`
- **Status:** open
- **Description:** After approve/preview, show Playwright screenshot inline if `screenshotUrl` is returned.
- **Acceptance criteria:**
  - [ ] Image renders on opportunity detail page
  - [ ] Graceful fallback when URL missing or bucket not configured

---

## P2 — Auto-apply & search quality

### #14 More ATS / form-fill coverage
- **Labels:** `auto-apply`, `enhancement`
- **Status:** open
- **Description:** Form fill works best on Greenhouse, Lever, Ashby. Many sites use login walls, CAPTCHA, or opaque iframes.
- **Acceptance criteria:**
  - [ ] Document supported ATS list in README
  - [ ] Improve iframe detection in `formFill.ts`
  - [ ] Better “Apply” button navigation before fill
  - [ ] Clear `pageNote` when blocked (login/CAPTCHA)

### #15 LLM-assisted unknown form fields
- **Labels:** `auto-apply`, `ai`
- **Status:** open
- **Description:** When heuristics miss fields, ask Ollama to map label → profile value.
- **Acceptance criteria:**
  - [ ] Opt-in via env `FORM_FILL_LLM=true`
  - [ ] Never auto-submit sensitive fields without preview
  - [ ] Log filled vs missed fields as today

### #16 Search query improvements
- **Labels:** `search`, `enhancement`
- **Status:** open
- **Description:** Resume-driven queries may be too broad or narrow depending on CV quality.
- **Acceptance criteria:**
  - [ ] Cap queries per run to control Tavily cost
  - [ ] Deduplicate by domain + title
  - [ ] Optional user preferences from profile (remote-only, regions)

### #17 Scholarship-specific pipeline tuning
- **Labels:** `search`, `scholarships`
- **Status:** open
- **Description:** Scholarship flow shares job logic; essay prompts and deadlines may need different scoring/writing.
- **Acceptance criteria:**
  - [ ] Separate min score or weight for `type=scholarship`
  - [ ] Writer agent uses scholarship prompt when type is scholarship
  - [ ] Digest groups jobs vs scholarships

---

## P2 — Infrastructure & deploy

### #18 Docker Compose: full local stack
- **Labels:** `docker`, `docs`
- **Status:** open
- **Description:** Compose exists for API + dashboard; Ollama and env wiring may need polish.
- **Acceptance criteria:**
  - [ ] Documented `docker compose up` flow
  - [ ] Optional Ollama service or clear “host Ollama” instructions
  - [ ] Playwright chromium in API image or documented install step
  - [ ] `.env` template for compose

### #19 Deployment guide (VPS / PaaS)
- **Labels:** `docs`, `deploy`
- **Status:** open
- **Description:** No guide for running 24/7 so cron and notifications actually fire.
- **Acceptance criteria:**
  - [ ] `docs/DEPLOY.md` with one VPS path (e.g. systemd + reverse proxy)
  - [ ] Note on keeping API process alive for scheduler
  - [ ] Secrets checklist (never commit service role key)

### #20 GitHub Actions: test job + optional release
- **Labels:** `ci`, `oss`
- **Status:** open
- **Description:** CI builds only; add test step when #8 lands; optional tagged releases.
- **Acceptance criteria:**
  - [ ] `npm test` in workflow after #8
  - [ ] Optional `workflow_dispatch` for manual CI
  - [ ] (Optional) Release workflow for Docker images

---

## P3 — Future / larger bets

### #21 Multi-user profiles & auth
- **Labels:** `auth`, `database`, `breaking`
- **Status:** open
- **Description:** Single global profile today; RLS and Supabase Auth for multiple users.
- **Acceptance criteria:**
  - [ ] User sign-in on dashboard
  - [ ] Profile + opportunities scoped per user
  - [ ] Migration path documented for existing single-user setup

### #22 Application lifecycle tracking
- **Labels:** `dashboard`, `enhancement`
- **Status:** open
- **Description:** Status is new/reviewed/applied/rejected only; no interview/offer tracking.
- **Acceptance criteria:**
  - [ ] Extended status enum or tags
  - [ ] UI to update status and notes
  - [ ] History reflects status changes

### #23 LinkedIn / Indeed adapters
- **Labels:** `search`, `auto-apply`, `research`
- **Status:** open
- **Description:** High demand but login walls, anti-bot, and ToS constraints.
- **Acceptance criteria:**
  - [ ] Spike doc: feasibility, risks, legal/ToS note
  - [ ] No implementation until approach agreed

### #24 Browser extension for form fill
- **Labels:** `auto-apply`, `research`
- **Status:** open
- **Description:** Playwright cannot reach every site; extension could fill on user’s logged-in session.
- **Acceptance criteria:**
  - [ ] Architecture doc
  - [ ] MVP: read profile from API, fill current tab

### #25 Cost & rate-limit dashboard
- **Labels:** `dashboard`, `ops`
- **Status:** open
- **Description:** Tavily and Ollama usage are invisible to the user.
- **Acceptance criteria:**
  - [ ] Log Tavily calls per pipeline run
  - [ ] Show last run stats on status or pipeline UI

---

## Completed (reference)

| ID | Title | Notes |
|----|-------|-------|
| — | Resume-driven search | No hardcoded skills |
| — | Hybrid match scoring + rescore | `matchScore.ts`, `POST /rescore` |
| — | Dry-run default on approve | Confirm & Submit separate |
| — | Application history | `submission_logs`, `/history` |
| — | Health + status page | `/health`, `/status` |
| — | `POST /api/send-digest` + test send | Status page buttons |
| — | Env-based cron schedules | `CRON_SEARCH`, `CRON_DIGEST`, `CRON_TZ` |
| — | Demo GIF in README | `docs/screenshots/demo.gif` |
| — | Docker + CI scaffold | `docker-compose.yml`, `.github/workflows/ci.yml` |

---

## How to use this backlog

1. Pick one **P0** item if notifications or daily use are still broken.
2. Create a GitHub issue from the template and paste the acceptance criteria.
3. Branch → PR → `Closes #N`.
4. Move completed rows to **Completed** or close the GitHub issue.

Suggested order for a solo maintainer:

```
#1 → #2 → #3 → #5 → #6 → #7 → #10 → #8 → #18 → #19
```
