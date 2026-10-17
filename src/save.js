// Client-side data layer. `state` is the in-memory working copy views read
// synchronously, backed by IndexedDB (src/db.js) as the durable local cache.
// Postgres (via src/sync.js) is the source of truth once signed in — every
// mutation here marks the affected row `dirty` so sync.js knows to push it.
import { newId, ymd, today } from "./utils.js";
import * as db from "./db.js";

const DEFAULT_SUBJECT_NAME = "Umum";

const SUBJECT_COLORS = [
  "sky", "coral", "amber", "mint", "violet", "rose", "lime", "peach"
];
export const subjectColors = () => SUBJECT_COLORS.slice();

export const DEFAULT_TARGET_SESSIONS = 3;
function clampTarget(v) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1) return DEFAULT_TARGET_SESSIONS;
  if (n > 999) return 999;
  return n;
}

function defaultSettingsFields() {
  return {
    lang: "id",
    theme: "auto",
    canvas: { id: "v1-default", startDate: ymd(today()) },
    activeSession: null,
    seen: { affirmations: [], aspirations: [], scripture: [] },
  };
}

function defaultSubject() {
  return normalizeSubject({ name: DEFAULT_SUBJECT_NAME, color: "sky" });
}

export let state = {
  userId: null,
  subjects: [],
  sessions: [],
  ...defaultSettingsFields(),
};

let saveHooks = [];
export function onAfterSave(cb) {
  saveHooks.push(cb);
  return () => { saveHooks = saveHooks.filter(x => x !== cb); };
}
function notify() {
  for (const cb of saveHooks) { try { cb(state); } catch (e) { console.warn("save hook failed", e); } }
}

/* ===== normalization (shared by hydrate + legacy migration + import) ===== */

export function normalizeSubject(x) {
  const now = Date.now();
  return {
    id: x.id || newId(),
    userId: x.userId || state.userId,
    name: String(x.name || "Topik").trim().slice(0, 60) || "Topik",
    color: SUBJECT_COLORS.includes(x.color) ? x.color : "sky",
    archived: !!x.archived,
    targetSessions: clampTarget(x.targetSessions),
    createdAt: x.createdAt || now,
    updatedAt: x.updatedAt || now,
    dirty: x.dirty ?? true,
  };
}

export function normalizeSession(x, { fallbackSubjectId } = {}) {
  const now = Date.now();
  return {
    id: x.id || newId(),
    userId: x.userId || state.userId,
    subjectId: x.subjectId || fallbackSubjectId,
    date: x.date || ymd(today()),
    startedAt: Number(x.startedAt) || now,
    finishedAt: Number(x.finishedAt) || 0,
    title: String(x.title || "").trim().slice(0, 120),
    summary: String(x.summary || ""),
    createdAt: x.createdAt || now,
    updatedAt: x.updatedAt || now,
    deletedAt: x.deletedAt || null,
    dirty: x.dirty ?? true,
  };
}

/* ===== boot / hydrate ===== */

/**
 * Loads the signed-in user's cached rows from IndexedDB into `state`. If the
 * local cache belongs to a different account (device was previously used by
 * someone else), it's wiped first — we never mix two accounts' data.
 */
export async function hydrate(userId) {
  const cachedFor = await db.getMeta("userId");
  if (cachedFor && cachedFor !== userId) {
    await db.clearAll();
    await db.setMeta("subjectsLastPulledAt", null);
    await db.setMeta("sessionsLastPulledAt", null);
  }
  await db.setMeta("userId", userId);
  state.userId = userId;

  const [subjects, sessions, settingsRow] = await Promise.all([
    db.getAll("subjects"),
    db.getAll("sessions"),
    db.get("settings", userId),
  ]);

  state.subjects = subjects.length ? subjects : [await persistNewSubject(defaultSubject())];
  state.sessions = sessions.filter(s => !s.deletedAt);

  if (settingsRow) {
    state.lang = ["id", "en"].includes(settingsRow.lang) ? settingsRow.lang : "id";
    state.theme = ["auto", "light", "dark"].includes(settingsRow.theme) ? settingsRow.theme : "auto";
    state.canvas = { id: settingsRow.canvasId || "v1-default", startDate: settingsRow.canvasStartDate || ymd(today()) };
    state.activeSession = settingsRow.activeSession || null;
    state.seen = {
      affirmations: settingsRow.seenAffirmations || [],
      aspirations: settingsRow.seenAspirations || [],
      scripture: settingsRow.seenScripture || [],
    };
  } else {
    Object.assign(state, defaultSettingsFields());
    await persistSettings({ dirty: true });
  }

  if (!state.canvas.startDate || state.canvas.startDate > ymd(today())) {
    state.canvas.startDate = state.sessions[0]?.date || ymd(today());
  }
}

async function persistNewSubject(subj) {
  await db.put("subjects", subj);
  return subj;
}

/* ===== settings (one row per user; covers lang/theme/canvas/activeSession/seen) ===== */

async function persistSettings({ dirty = true } = {}) {
  if (!state.userId) return;
  await db.put("settings", {
    userId: state.userId,
    lang: state.lang,
    theme: state.theme,
    canvasId: state.canvas.id,
    canvasStartDate: state.canvas.startDate,
    activeSession: state.activeSession,
    seenAffirmations: state.seen.affirmations,
    seenAspirations: state.seen.aspirations,
    seenScripture: state.seen.scripture,
    updatedAt: Date.now(),
    dirty,
  });
}

/**
 * Call after mutating any settings-shaped field directly on `state`
 * (lang, theme, canvas, activeSession, seen). Persists + triggers sync.
 */
export function save() {
  persistSettings({ dirty: true }).catch(e => console.warn("persistSettings failed", e));
  notify();
}

/** Used only by sync.js when applying an incoming settings row from a pull. */
export function applySettingsFromServer(row) {
  state.lang = ["id", "en"].includes(row.lang) ? row.lang : state.lang;
  state.theme = ["auto", "light", "dark"].includes(row.theme) ? row.theme : state.theme;
  state.canvas = { id: row.canvasId || state.canvas.id, startDate: row.canvasStartDate || state.canvas.startDate };
  state.activeSession = row.activeSession || null;
  state.seen = {
    affirmations: row.seenAffirmations || [],
    aspirations: row.seenAspirations || [],
    scripture: row.seenScripture || [],
  };
  return persistSettings({ dirty: false });
}

export function markSeen(kind, idx, cap = 7) {
  if (idx < 0) return;
  const arr = state.seen[kind] || [];
  arr.push(idx);
  while (arr.length > cap) arr.shift();
  state.seen[kind] = arr;
}

/* ===== subjects ===== */

export function addSubject(name, color = "sky") {
  const trimmed = String(name || "").trim().slice(0, 60);
  if (!trimmed) return null;
  const existing = state.subjects.find(s => s.name.toLowerCase() === trimmed.toLowerCase() && !s.archived);
  if (existing) return existing;
  const subj = normalizeSubject({ name: trimmed, color });
  state.subjects.push(subj);
  db.put("subjects", subj).catch(e => console.warn("persist subject failed", e));
  notify();
  return subj;
}

export function updateSubject(id, patch) {
  const s = state.subjects.find(x => x.id === id);
  if (!s) return;
  if (patch.name != null) s.name = String(patch.name).trim().slice(0, 60) || s.name;
  if (patch.color && SUBJECT_COLORS.includes(patch.color)) s.color = patch.color;
  if (typeof patch.archived === "boolean") s.archived = patch.archived;
  if (patch.targetSessions != null) s.targetSessions = clampTarget(patch.targetSessions);
  s.updatedAt = Date.now();
  s.dirty = true;
  db.put("subjects", s).catch(e => console.warn("persist subject failed", e));
  notify();
}

/**
 * Hard-deletes a subject with no session history. Subjects with sessions
 * can't be deleted (the `sessions.subject_id` FK is `on delete restrict`,
 * and there's no tombstone column for subjects) — archive those instead.
 * Returns "ok", "hasSessions", or "lastSubject".
 */
export function deleteSubject(id) {
  const idx = state.subjects.findIndex(x => x.id === id);
  if (idx < 0) return "ok";
  if (state.sessions.some(s => s.subjectId === id)) return "hasSessions";
  if (liveSubjects().filter(s => s.id !== id).length === 0 && !state.subjects[idx].archived) return "lastSubject";
  state.subjects.splice(idx, 1);
  db.remove("subjects", id).catch(e => console.warn("delete subject failed", e));
  notify();
  return "ok";
}

export function liveSubjects() {
  return state.subjects.filter(s => !s.archived);
}
export function subjectById(id) {
  return state.subjects.find(s => s.id === id) || state.subjects[0];
}

/* ===== sessions ===== */

export function addSession({ summary, subjectId, startedAt, finishedAt, date, title = "" }) {
  const sess = normalizeSession({
    summary, subjectId, startedAt, finishedAt, date, title,
  });
  state.sessions.push(sess);
  db.put("sessions", sess).catch(e => console.warn("persist session failed", e));
  notify();
  return sess;
}

export function updateSession(id, patch) {
  const s = state.sessions.find(x => x.id === id);
  if (!s) return false;
  if (patch.title != null) s.title = String(patch.title).trim().slice(0, 120);
  if (patch.summary != null) {
    const v = String(patch.summary).trim();
    if (!v) return false;
    s.summary = v;
  }
  s.updatedAt = Date.now();
  s.dirty = true;
  db.put("sessions", s).catch(e => console.warn("persist session failed", e));
  notify();
  return true;
}

/** Soft-delete: tombstoned locally + server-side so other devices drop it on pull. */
export function deleteSession(id) {
  const idx = state.sessions.findIndex(x => x.id === id);
  if (idx < 0) return false;
  const [s] = state.sessions.splice(idx, 1);
  s.deletedAt = Date.now();
  s.updatedAt = s.deletedAt;
  s.dirty = true;
  db.put("sessions", s).catch(e => console.warn("persist session tombstone failed", e));
  notify();
  return true;
}

/* ===== export / import (Settings backup) ===== */

export function exportJSON() {
  return JSON.stringify({
    v: 3,
    lang: state.lang,
    theme: state.theme,
    canvas: state.canvas,
    subjects: state.subjects,
    sessions: state.sessions,
    seen: state.seen,
  }, null, 2);
}

/**
 * Restores a backup file. Additive merge, not a destructive replace: with a
 * cloud account as the source of truth, wiping local state based on one
 * device's backup file would also wipe every other synced device on next
 * pull. Existing ids are preserved so re-importing the same backup doesn't
 * duplicate rows; everything imported is marked dirty so it gets pushed.
 */
export async function importJSON(text) {
  const parsed = JSON.parse(text);
  const subjects = (Array.isArray(parsed.subjects) ? parsed.subjects : []).map(x => normalizeSubject({ ...x, dirty: true }));
  const knownIds = new Set([...state.subjects.map(s => s.id), ...subjects.map(s => s.id)]);
  const fallbackId = subjects.find(s => !s.archived)?.id || state.subjects.find(s => !s.archived)?.id || state.subjects[0]?.id;
  const sessions = (Array.isArray(parsed.sessions) ? parsed.sessions : [])
    .filter(x => x && x.summary)
    .map(x => normalizeSession(
      { ...x, subjectId: knownIds.has(x.subjectId) ? x.subjectId : undefined, dirty: true },
      { fallbackSubjectId: fallbackId }
    ));

  for (const subj of subjects) {
    const existingIdx = state.subjects.findIndex(s => s.id === subj.id);
    if (existingIdx >= 0) state.subjects[existingIdx] = subj;
    else state.subjects.push(subj);
  }
  for (const sess of sessions) {
    const existingIdx = state.sessions.findIndex(s => s.id === sess.id);
    if (existingIdx >= 0) state.sessions[existingIdx] = sess;
    else state.sessions.push(sess);
  }
  await db.putAll("subjects", subjects);
  await db.putAll("sessions", sessions);

  if (parsed.lang) state.lang = parsed.lang;
  if (parsed.theme) state.theme = parsed.theme;
  await persistSettings({ dirty: true });
  notify();
}

/**
 * "Erase all data": tombstones every session, archives every non-default
 * subject, and resets settings to defaults. Subjects aren't hard-deletable
 * (sessions reference them, and the UI has never supported it — only
 * archive), so a full account wipe archives them instead of removing the
 * rows outright.
 */
export async function resetAccountData() {
  const now = Date.now();
  for (const s of state.sessions) {
    s.deletedAt = now;
    s.updatedAt = now;
    s.dirty = true;
  }
  await db.putAll("sessions", state.sessions);
  state.sessions = [];

  for (const subj of state.subjects) {
    subj.archived = true;
    subj.updatedAt = now;
    subj.dirty = true;
  }
  const fresh = await persistNewSubject(defaultSubject());
  await db.putAll("subjects", state.subjects);
  state.subjects.push(fresh);

  Object.assign(state, defaultSettingsFields());
  await persistSettings({ dirty: true });
  notify();
}

/** Test-only: reset the in-memory singleton between tests (pairs with wiping IndexedDB in tests/setup.js). */
export function _resetStateForTests() {
  state.userId = null;
  state.subjects = [];
  state.sessions = [];
  Object.assign(state, defaultSettingsFields());
}

export async function hasUnpushedChanges() {
  const [subs, sess, settingsRow] = await Promise.all([
    db.getDirty("subjects"),
    db.getDirty("sessions"),
    state.userId ? db.get("settings", state.userId) : null,
  ]);
  return subs.length > 0 || sess.length > 0 || !!(settingsRow && settingsRow.dirty);
}
