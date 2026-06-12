# Supabase setup

Run SQL in the **Supabase SQL Editor** ([supabase.com](https://supabase.com) → your project → SQL).

## Fresh install (new project)

Run these two files in order:

1. **`schema.sql`** — opportunities, applications, submission_logs, RLS
2. **`profile.sql`** — user profiles and resume metadata

Then create Storage buckets (below).

## Existing install (upgrading)

If you already ran an older `schema.sql` without `submission_logs`:

```bash
# Run only this file:
supabase/submission_logs.sql
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
