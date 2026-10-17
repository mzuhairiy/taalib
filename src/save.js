import { uid, ymd, today } from "./utils.js";

const LS = "taalib-v1";

const DEFAULT_SUBJECTS = [
  { id: "umum", name: "Umum", color: "sky", archived: false }
];

const empty = () => ({
  v: 2,
  lang: "id",
  theme: "auto",
  canvas: { id: "v1-default", startDate: ymd(today()) },
  subjects: DEFAULT_SUBJECTS.map(s => ({ ...s })),
  activeSession: null,
  sessions: [],
  seen: { affirmations: [], aspirations: [], scripture: [] },
  sync: { lastModifiedAt: 0, lastSyncedAt: 0, lastPulledServerAt: null }
});

const SUBJECT_COLORS = [
  "sky", "coral", "amber", "mint", "violet", "rose", "lime", "peach"
];
export const subjectColors = () => SUBJECT_COLORS.slice();

function normalize(raw) {
  const base = empty();
  if (!raw || typeof raw !== "object") return base;
  const s = Object.assign(base, raw);
  if (!["id", "en"].includes(s.lang)) s.lang = "id";
  if (!["auto", "light", "dark"].includes(s.theme)) s.theme = "auto";
  s.canvas = Object.assign({ id: "v1-default", startDate: ymd(today()) }, s.canvas || {});

  // subjects
  const normSubjects = Array.isArray(s.subjects) ? s.subjects : [];
  s.subjects = normSubjects
    .map(x => ({
      id: x.id || uid(),
      name: String(x.name || "Topik").slice(0, 60),
      color: SUBJECT_COLORS.includes(x.color) ? x.color : "sky",
      archived: !!x.archived
    }))
    .filter(x => x.name);
  if (!s.subjects.length) s.subjects = DEFAULT_SUBJECTS.map(x => ({ ...x }));

  // sessions: ensure subjectId is valid or fall back to first live subject
  const liveIds = new Set(s.subjects.filter(x => !x.archived).map(x => x.id));
  const fallbackId = s.subjects.find(x => !x.archived)?.id || s.subjects[0].id;
  s.sessions = (Array.isArray(s.sessions) ? s.sessions : [])
    .filter(x => x && x.summary)
    .map(x => ({
      id: x.id || uid(),
      date: x.date || "",
      startedAt: Number(x.startedAt) || 0,
      finishedAt: Number(x.finishedAt) || 0,
      summary: String(x.summary || ""),
      subjectId: liveIds.has(x.subjectId) ? x.subjectId : fallbackId
    }));

  s.seen = {
    affirmations: Array.isArray(s.seen?.affirmations) ? s.seen.affirmations.slice(-10) : [],
    aspirations: Array.isArray(s.seen?.aspirations) ? s.seen.aspirations.slice(-10) : [],
    scripture: Array.isArray(s.seen?.scripture) ? s.seen.scripture.slice(-10) : []
  };
  s.sync = Object.assign({ lastModifiedAt: 0, lastSyncedAt: 0, lastPulledServerAt: null }, s.sync || {});

  if (s.activeSession && typeof s.activeSession === "object") {
    s.activeSession = {
      id: s.activeSession.id || uid(),
      startedAt: Number(s.activeSession.startedAt) || Date.now(),
      motivationKind: s.activeSession.motivationKind === "aspiration" ? "aspiration" : "affirmation",
      motivationIdx: Number.isInteger(s.activeSession.motivationIdx) ? s.activeSession.motivationIdx : -1,
      scriptureIdx: Number.isInteger(s.activeSession.scriptureIdx) ? s.activeSession.scriptureIdx : -1
    };
  } else {
    s.activeSession = null;
  }

  // If startDate is missing or in the future, align it
  if (!s.canvas.startDate || s.canvas.startDate > ymd(today())) {
    s.canvas.startDate = s.sessions[0]?.date || ymd(today());
  }

  return s;
}

export let state = (() => {
  try {
    const raw = localStorage.getItem(LS);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch {
    return normalize(null);
  }
})();

let saveHooks = [];
export function onAfterSave(cb) {
  saveHooks.push(cb);
  return () => { saveHooks = saveHooks.filter(x => x !== cb); };
}

export function save({ markDirty = true, silent = false } = {}) {
  if (markDirty) {
    state.sync = state.sync || { lastModifiedAt: 0, lastSyncedAt: 0, lastPulledServerAt: null };
    state.sync.lastModifiedAt = Date.now();
  }
  try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) { console.warn("save failed", e); }
  if (!silent) for (const cb of saveHooks) { try { cb(state); } catch (e) { console.warn("save hook failed", e); } }
}

/** Replace local state with a remote blob (used by sync pull). */
export function applyRemote(remoteState, serverUpdatedAt) {
  state = normalize(remoteState);
  state.sync = state.sync || {};
  state.sync.lastPulledServerAt = serverUpdatedAt;
  state.sync.lastSyncedAt = Date.now();
  // Pulled remote is now canonical; don't mark dirty
  state.sync.lastModifiedAt = state.sync.lastSyncedAt - 1;
  save({ markDirty: false, silent: true });
}

export function markSynced(serverUpdatedAt) {
  state.sync = state.sync || {};
  state.sync.lastSyncedAt = Date.now();
  state.sync.lastPulledServerAt = serverUpdatedAt;
  save({ markDirty: false, silent: true });
}

export function hasUnpushedChanges() {
  const s = state.sync || {};
  return (s.lastModifiedAt || 0) > (s.lastSyncedAt || 0);
}

export function reset() {
  state = normalize(null);
  save();
}

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  state = normalize(parsed);
  save();
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
  // Reuse existing (case-insensitive match) if present
  const existing = state.subjects.find(s => s.name.toLowerCase() === trimmed.toLowerCase() && !s.archived);
  if (existing) return existing;
  const subj = { id: uid(), name: trimmed, color: SUBJECT_COLORS.includes(color) ? color : "sky", archived: false };
  state.subjects.push(subj);
  save();
  return subj;
}
export function updateSubject(id, patch) {
  const s = state.subjects.find(x => x.id === id);
  if (!s) return;
  if (patch.name != null) s.name = String(patch.name).trim().slice(0, 60) || s.name;
  if (patch.color && SUBJECT_COLORS.includes(patch.color)) s.color = patch.color;
  if (typeof patch.archived === "boolean") s.archived = patch.archived;
  save();
}
export function liveSubjects() {
  return state.subjects.filter(s => !s.archived);
}
export function subjectById(id) {
  return state.subjects.find(s => s.id === id) || state.subjects[0];
}
