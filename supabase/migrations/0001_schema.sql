-- Taalib schema: replaces the old single-row `taalib_state` jsonb blob with
-- normalized, per-record tables so cross-device sync can work at row
-- granularity instead of last-write-wins on the entire state.
--
-- Run this in the Supabase SQL editor on a fresh project (or after dropping
-- the old `taalib_state` table — see README.md for the migration path).

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ===== subjects (topics) =====
create table subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null check (color in ('sky','coral','amber','mint','violet','rose','lime','peach')),
  archived boolean not null default false,
  target_sessions integer not null default 3 check (target_sessions between 1 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subjects_user_idx on subjects(user_id);
create index subjects_user_updated_idx on subjects(user_id, updated_at);
create trigger subjects_updated_at before update on subjects
  for each row execute function set_updated_at();

alter table subjects enable row level security;
create policy subjects_select_own on subjects for select using (auth.uid() = user_id);
create policy subjects_insert_own on subjects for insert with check (auth.uid() = user_id);
create policy subjects_update_own on subjects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== sessions (learning sessions / summaries) =====
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete restrict,
  date date not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  title text not null default '' check (char_length(title) <= 120),
  summary text not null check (char_length(summary) >= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz  -- soft-delete tombstone so other devices can diff it out on pull
);
create index sessions_user_idx on sessions(user_id);
create index sessions_user_updated_idx on sessions(user_id, updated_at);
create index sessions_user_subject_idx on sessions(user_id, subject_id) where deleted_at is null;
create index sessions_user_date_idx on sessions(user_id, date);
create trigger sessions_updated_at before update on sessions
  for each row execute function set_updated_at();

alter table sessions enable row level security;
create policy sessions_select_own on sessions for select using (auth.uid() = user_id);
create policy sessions_insert_own on sessions for insert with check (auth.uid() = user_id);
create policy sessions_update_own on sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== per-user settings & small singletons (low collaboration risk) =====
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lang text not null default 'id' check (lang in ('id','en')),
  theme text not null default 'auto' check (theme in ('auto','light','dark')),
  canvas_id text not null default 'v1-default',
  canvas_start_date date not null default current_date,
  active_session jsonb,
  seen_affirmations integer[] not null default '{}',
  seen_aspirations integer[] not null default '{}',
  seen_scripture integer[] not null default '{}',
  updated_at timestamptz not null default now()
);
create trigger user_settings_updated_at before update on user_settings
  for each row execute function set_updated_at();

alter table user_settings enable row level security;
create policy settings_select_own on user_settings for select using (auth.uid() = user_id);
create policy settings_insert_own on user_settings for insert with check (auth.uid() = user_id);
create policy settings_update_own on user_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
