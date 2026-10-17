# Taalib — Belajar harian

A small, honest personal learning PWA. Daily session loop, mandatory summary, hidden pixel-art calendar, Qur'an/hadith + motivational reminders. Local-first; optional cross-device sync.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build

```bash
npm run build
npm run preview    # try the production build with PWA active
```

---

## Cross-device sync (optional, ~10 min setup)

Taalib works 100% local by default. To sync across devices (phone + laptop, etc.):

### 1. Create a Supabase project

1. Sign up free at <https://supabase.com> (GitHub login is fastest).
2. Click **New project** → pick any name/region → create.
3. Wait ~1 minute for provisioning.
4. In the project dashboard, go to **Settings → API** and copy:
   - **Project URL** → this is `VITE_SUPABASE_URL`
   - **anon public** key → this is `VITE_SUPABASE_ANON_KEY`

### 2. Create the storage table

In the Supabase dashboard, open **SQL Editor** → **New query** → paste and run:

```sql
create table if not exists taalib_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table taalib_state enable row level security;

create policy "own data select" on taalib_state
  for select using (auth.uid() = user_id);

create policy "own data insert" on taalib_state
  for insert with check (auth.uid() = user_id);

create policy "own data update" on taalib_state
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

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

Open the app → click the gear ⚙ → scroll to **Sinkron antar perangkat** → enter your email → check inbox → click the link → done. The sync pill turns green ("Tersinkron") whenever your laptop and phone agree.

Last-write-wins by server timestamp. Local-only usage is preserved: whatever you did offline is pushed up on next sign-in.

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

Vanilla JS + Vite + `vite-plugin-pwa` (Workbox). Optional `@supabase/supabase-js` for sync.

Bundle: ~20 KB gz JS (without sync) / ~55 KB gz (with Supabase client).
