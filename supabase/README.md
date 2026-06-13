# Supabase setup

Run SQL in the **Supabase SQL Editor** ([supabase.com](https://supabase.com) → your project → SQL).

## Fresh install (new project)

Run these two files in order:

1. **`schema.sql`** — opportunities, applications, submission_logs, RLS
2. **`profile.sql`** — user profiles and resume metadata
3. **`career_analysis.sql`** — AI career level column on profiles (optional upgrade)
4. **`subscriptions.sql`** — job alert email subscriptions (optional upgrade)

Then create Storage buckets (below).

## Existing install (upgrading)

If you already ran an older `schema.sql` without `submission_logs`:

```bash
# Run only this file:
supabase/submission_logs.sql
```

If career level / form suggestions are missing after resume upload:

```bash
supabase/career_analysis.sql
```

If job subscriptions fail (`job_subscriptions` table missing):

```bash
supabase/subscriptions.sql
```

If the same jobs repeat in every digest email:

```bash
supabase/notification_deliveries.sql
```

If inserts fail with RLS error `42501`:

```bash
supabase/rls.sql
```

## Storage buckets

Create in **Dashboard → Storage → New bucket**:

| Bucket | Purpose | Public? |
|--------|---------|---------|
| `resumes` | Uploaded CV files (PDF/DOCX) | Private (service role uploads) |
| `screenshots` | Playwright submission screenshots | Public read recommended |

The API uses **`SUPABASE_SERVICE_ROLE_KEY`** for uploads. Never put that key in the Next.js app or commit it to git.

## Verify setup

After running SQL, confirm tables exist under **Table Editor**:

- `opportunities`
- `applications`
- `user_profiles`
- `submission_logs`
- `job_subscriptions` (if you ran `subscriptions.sql`)
