// Account is required: Postgres (Supabase) is the source of truth. This
// module owns auth (unchanged from before) and per-table incremental sync
// between the IndexedDB cache (src/db.js, read through src/save.js's
// `state`) and the `subjects` / `sessions` / `user_settings` tables.
//
// Conflict rule: a row marked `dirty` locally is never overwritten by an
// incoming pull until it has been confirmed pushed — "pending local write
// wins until synced," scoped per-row instead of to the whole blob.
import { createClient } from "@supabase/supabase-js";
import * as db from "./db.js";
import { state, applySettingsFromServer } from "./save.js";

const URL_ENV = import.meta.env.VITE_SUPABASE_URL;
const KEY_ENV = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const syncAvailable = Boolean(URL_ENV && KEY_ENV);
export const supabase = syncAvailable
  ? createClient(URL_ENV, KEY_ENV, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

const listeners = new Set();

export function onAuthChange(cb) {
  if (!syncAvailable) return () => {};
  listeners.add(cb);
  const sub = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user || null);
  });
  supabase.auth.getUser().then(({ data }) => cb(data?.user || null));
  return () => {
    listeners.delete(cb);
    sub.data?.subscription?.unsubscribe?.();
  };
}

export async function getUser() {
  if (!syncAvailable) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

export async function signInWithEmail(email, redirectTo) {
  if (!syncAvailable) throw new Error("sync not configured");
  const target = redirectTo || window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: target }
  });
  if (error) throw error;
}

export async function verifyEmailCode(email, token) {
  if (!syncAvailable) throw new Error("sync not configured");
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
}

export async function signOut() {
  if (!syncAvailable) return;
  await supabase.auth.signOut();
}

/* ===== timestamp helpers (exported for testing — pure, deterministic) ===== */
export const toIso = (ms) => (ms ? new Date(ms).toISOString() : null);
export const fromIso = (iso) => (iso ? new Date(iso).getTime() : 0);

/* ===== subjects ===== */

export function subjectToRow(s, userId) {
  return {
    id: s.id, user_id: userId, name: s.name, color: s.color,
    archived: s.archived, target_sessions: s.targetSessions,
    created_at: toIso(s.createdAt) || new Date().toISOString(),
  };
}
export function rowToSubject(r) {
  return {
    id: r.id, userId: r.user_id, name: r.name, color: r.color,
    archived: r.archived, targetSessions: r.target_sessions,
    createdAt: fromIso(r.created_at), updatedAt: fromIso(r.updated_at),
    dirty: false,
  };
}

async function pushSubjects(userId) {
  const dirty = await db.getDirty("subjects");
  if (!dirty.length) return;
  const rows = dirty.map(s => subjectToRow(s, userId));
  const { error } = await supabase.from("subjects").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  await db.clearDirty("subjects", dirty.map(s => s.id));
  for (const s of dirty) { const live = state.subjects.find(x => x.id === s.id); if (live) live.dirty = false; }
}

async function pullSubjects(userId) {
  const since = (await db.getMeta("subjectsLastPulledAt")) || "1970-01-01T00:00:00Z";
  const { data, error } = await supabase
    .from("subjects").select("*")
    .eq("user_id", userId).gt("updated_at", since)
    .order("updated_at", { ascending: true });
  if (error) throw error;
  if (!data?.length) return false;

  const dirtyIds = new Set((await db.getDirty("subjects")).map(s => s.id));
  let changed = false;
  for (const row of data) {
    if (dirtyIds.has(row.id)) continue; // pending local write wins until synced
    const subj = rowToSubject(row);
    await db.put("subjects", subj);
    const idx = state.subjects.findIndex(s => s.id === subj.id);
    if (idx >= 0) state.subjects[idx] = subj; else state.subjects.push(subj);
    changed = true;
  }
  const latest = data[data.length - 1].updated_at;
  await db.setMeta("subjectsLastPulledAt", latest);
  return changed;
}

/* ===== sessions ===== */

export function sessionToRow(s, userId) {
  return {
    id: s.id, user_id: userId, subject_id: s.subjectId, date: s.date,
    started_at: toIso(s.startedAt) || new Date().toISOString(),
    finished_at: toIso(s.finishedAt),
    title: s.title || "", summary: s.summary,
    created_at: toIso(s.createdAt) || new Date().toISOString(),
    deleted_at: toIso(s.deletedAt),
  };
}
export function rowToSession(r) {
  return {
    id: r.id, userId: r.user_id, subjectId: r.subject_id, date: r.date,
    startedAt: fromIso(r.started_at), finishedAt: fromIso(r.finished_at),
    title: r.title || "", summary: r.summary,
    createdAt: fromIso(r.created_at), updatedAt: fromIso(r.updated_at),
    deletedAt: fromIso(r.deleted_at) || null,
    dirty: false,
  };
}

async function pushSessions(userId) {
  const dirty = await db.getDirty("sessions");
  if (!dirty.length) return;
  const rows = dirty.map(s => sessionToRow(s, userId));
  const { error } = await supabase.from("sessions").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  await db.clearDirty("sessions", dirty.map(s => s.id));
  for (const s of dirty) { const live = state.sessions.find(x => x.id === s.id); if (live) live.dirty = false; }
}

async function pullSessions(userId) {
  const since = (await db.getMeta("sessionsLastPulledAt")) || "1970-01-01T00:00:00Z";
  const { data, error } = await supabase
    .from("sessions").select("*")
    .eq("user_id", userId).gt("updated_at", since)
    .order("updated_at", { ascending: true });
  if (error) throw error;
  if (!data?.length) return false;

  const dirtyIds = new Set((await db.getDirty("sessions")).map(s => s.id));
  let changed = false;
  for (const row of data) {
    if (dirtyIds.has(row.id)) continue;
    const sess = rowToSession(row);
    await db.put("sessions", sess);
    const idx = state.sessions.findIndex(s => s.id === sess.id);
    if (sess.deletedAt) {
      if (idx >= 0) { state.sessions.splice(idx, 1); changed = true; }
    } else if (idx >= 0) {
      state.sessions[idx] = sess; changed = true;
    } else {
      state.sessions.push(sess); changed = true;
    }
  }
  const latest = data[data.length - 1].updated_at;
  await db.setMeta("sessionsLastPulledAt", latest);
  return changed;
}

/* ===== settings (single row per user) ===== */

function settingsToRow(row, userId) {
  return {
    user_id: userId, lang: row.lang, theme: row.theme,
    canvas_id: row.canvasId, canvas_start_date: row.canvasStartDate,
    active_session: row.activeSession,
    seen_affirmations: row.seenAffirmations, seen_aspirations: row.seenAspirations,
    seen_scripture: row.seenScripture,
  };
}

async function pushSettings(userId) {
  const row = await db.get("settings", userId);
  if (!row || !row.dirty) return;
  const { error } = await supabase.from("user_settings").upsert(settingsToRow(row, userId), { onConflict: "user_id" });
  if (error) throw error;
  row.dirty = false;
  await db.put("settings", row);
}

async function pullSettings(userId) {
  const { data, error } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return false;
  const local = await db.get("settings", userId);
  if (local && local.dirty) return false; // pending local write wins until synced
  const localUpdated = local ? local.updatedAt || 0 : 0;
  const remoteUpdated = fromIso(data.updated_at);
  if (remoteUpdated <= localUpdated) return false;
  await applySettingsFromServer({
    lang: data.lang, theme: data.theme, canvasId: data.canvas_id, canvasStartDate: data.canvas_start_date,
    activeSession: data.active_session,
    seenAffirmations: data.seen_affirmations, seenAspirations: data.seen_aspirations, seenScripture: data.seen_scripture,
  });
  return true;
}

/* ===== public sync entry points ===== */

/** Push every dirty local row, in dependency order (subjects before sessions). */
export async function pushAll() {
  if (!syncAvailable || !state.userId) return;
  await pushSubjects(state.userId);
  await pushSessions(state.userId);
  await pushSettings(state.userId);
}

/** Pull everything changed since the last pull. Returns true if anything changed. */
export async function pullAll() {
  if (!syncAvailable || !state.userId) return false;
  const a = await pullSubjects(state.userId);
  const b = await pullSessions(state.userId);
  const c = await pullSettings(state.userId);
  return a || b || c;
}

/** Push local changes, then pull remote changes. Used after every mutation and on reconnect. */
export async function syncNow() {
  if (!syncAvailable || !state.userId) return false;
  await pushAll();
  return pullAll();
}
