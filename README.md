# Taalib — Belajar harian

A small, honest personal learning PWA. Daily session loop, mandatory summary, hidden pixel-art calendar, Qur'an/hadith + motivational reminders. An account is required — Postgres (Supabase) is the source of truth, with an IndexedDB cache on-device so the app keeps working between syncs.

## Run locally

Requires a Supabase project (see **Account setup** below) — without it the app shows a "not configured" screen instead of starting.

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's URL + anon key
npm run dev                  # http://localhost:5173
```

## Build

```bash
npm run build
npm run preview    # try the production build with PWA active
```

---

## Account setup (required, ~10 min)

Taalib needs a Supabase project before it will run at all — there's no local-only mode. Data lives in Postgres (synced per-record, not as one blob) with an IndexedDB cache on-device for offline use between syncs.

### 1. Create a Supabase project

1. Sign up free at <https://supabase.com> (GitHub login is fastest).
2. Click **New project** → pick any name/region → create.
3. Wait ~1 minute for provisioning.
4. In the project dashboard, go to **Settings → API** and copy:
   - **Project URL** → this is `VITE_SUPABASE_URL`
   - **anon public** key → this is `VITE_SUPABASE_ANON_KEY`

### 2. Create the schema

In the Supabase dashboard, open **SQL Editor** → **New query** → paste and run the contents of [`supabase/migrations/0001_schema.sql`](supabase/migrations/0001_schema.sql).

This creates three tables — `subjects` (topics), `sessions` (learning sessions / summaries), and `user_settings` (language/theme/preferences) — each with row-level security scoped to `auth.uid()`, so every user only ever sees their own rows. `sessions` use a soft-delete column (`deleted_at`) rather than a hard `DELETE`, so a deletion on one device propagates as a tombstone to your other signed-in devices instead of silently reappearing on next sync.

If you have an older deployment still using the single `taalib_state` blob table, keep it in place until you've confirmed users have migrated (the app does this automatically on first sign-in per browser — see `src/migrate-legacy.js`), then run [`supabase/migrations/0002_drop_legacy_blob_table.sql`](supabase/migrations/0002_drop_legacy_blob_table.sql).

### 3. Enable email magic-link auth

**Settings → Authentication → Providers → Email**: make sure Email is ON. Magic Link is enabled by default.

**Settings → Authentication → URL Configuration**:
- **Site URL**: `http://localhost:5173` (for dev). After you deploy, add your Vercel URL here too.
- **Redirect URLs**: add both `http://localhost:5173/*` and your Vercel URL (e.g. `https://taalib.vercel.app/*`).

**Authentication → Email Templates → Magic Link**: on iOS, tapping the link from Mail/Gmail opens a separate in-app browser whose storage isn't shared with Safari or an installed PWA, so the sign-in can land somewhere other than where the user asked for it. The app also shows a "6-digit code" fallback that avoids this entirely — add `{{ .Token }}` somewhere in the template body (e.g. `Or enter this code: {{ .Token }}`) so that code is actually included in the email.

### 4. Paste the keys locally

```bash
cp .env.example .env.local
# edit .env.local and paste your Project URL + anon key
npm run dev
```

Opening the app now shows a sign-in screen — enter your email, check your inbox, click the link (or use the 6-digit code fallback) and you're in. Once signed in, the Settings sync pill turns green ("Tersinkron") whenever your laptop and phone agree.

Sync is per-record (each subject/session/settings row syncs independently), not a single whole-state blob — editing a summary on your phone and a different one on your laptop no longer risks one overwriting the other. A row with unsaved local edits is never clobbered by an incoming sync until it's confirmed pushed.

---

## Deploy to Vercel

### Easiest path (CLI)

```bash
npm install -g vercel
vercel login
vercel        # follow prompts; accept defaults
```

After the first deploy, add your env vars in the Vercel dashboard: **Project → Settings → Environment Variables** → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` → then `vercel --prod` to rebuild with sync enabled.

### Or: deploy from GitHub

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** → import the repo. Framework autodetects as Vite.
3. Under **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy.

Then back in Supabase: add your Vercel URL to **Settings → Authentication → URL Configuration** (Site URL + Redirect URLs) so magic-link emails redirect correctly.

### Install on your phone

Open the deployed URL in Safari (iOS) or Chrome (Android) → tap Share / menu → **Add to Home Screen**. Launches full-screen like a native app, works offline, syncs when online.

---

## Tech

Vanilla JS + Vite + `vite-plugin-pwa` (Workbox). `@supabase/supabase-js` for auth + Postgres sync (required). IndexedDB (native, no library) as the on-device cache.

Bundle: ~55 KB gz JS (includes the Supabase client, which is required).
