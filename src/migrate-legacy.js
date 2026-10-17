// One-time migration of the old localStorage["taalib-v1"] blob (the
// pre-database version of the app) into the new per-record IndexedDB stores.
// Must run BEFORE save.js's hydrate() so hydrate() sees the migrated rows
// already in place and doesn't also bootstrap an empty default subject.
//
// Old ids (from the short non-uuid `uid()` generator) can't be reused as
// Postgres `uuid` primary keys, so every subject/session gets a fresh id
// here; session.subjectId is remapped through an old-id -> new-id table.
import { normalizeSubject, normalizeSession } from "./save.js";
import * as db from "./db.js";

const LEGACY_KEY = "taalib-v1";

export async function migrateLegacyIfNeeded(userId) {
  const already = await db.getMeta("legacyMigrated");
  if (already) return false;

  let raw = null;
  try { raw = localStorage.getItem(LEGACY_KEY); } catch { /* storage unavailable */ }
  if (!raw) {
    await db.setMeta("legacyMigrated", true);
    return false;
  }

  let parsed;
  try { parsed = JSON.parse(raw); } catch {
    await db.setMeta("legacyMigrated", true);
    return false;
  }

  const idMap = new Map();
  const subjects = (Array.isArray(parsed.subjects) ? parsed.subjects : []).map(x => {
    const subj = normalizeSubject({
      userId, name: x.name, color: x.color, archived: x.archived,
      targetSessions: x.targetSessions, dirty: true,
    });
    if (x.id) idMap.set(x.id, subj.id);
    return subj;
  });
  const fallbackId = subjects.find(s => !s.archived)?.id || subjects[0]?.id;

  const sessions = (Array.isArray(parsed.sessions) ? parsed.sessions : [])
    .filter(x => x && x.summary)
    .map(x => normalizeSession({
      userId,
      subjectId: idMap.get(x.subjectId) || fallbackId,
      date: x.date, startedAt: x.startedAt, finishedAt: x.finishedAt,
      title: x.title, summary: x.summary, dirty: true,
    }));

  await db.putAll("subjects", subjects);
  await db.putAll("sessions", sessions);

  const canvas = parsed.canvas || {};
  await db.put("settings", {
    userId,
    lang: ["id", "en"].includes(parsed.lang) ? parsed.lang : "id",
    theme: ["auto", "light", "dark"].includes(parsed.theme) ? parsed.theme : "auto",
    canvasId: canvas.id || "v1-default",
    canvasStartDate: canvas.startDate || null,
    activeSession: null, // a stale in-progress session from the old device isn't worth resurrecting
    seenAffirmations: Array.isArray(parsed.seen?.affirmations) ? parsed.seen.affirmations : [],
    seenAspirations: Array.isArray(parsed.seen?.aspirations) ? parsed.seen.aspirations : [],
    seenScripture: Array.isArray(parsed.seen?.scripture) ? parsed.seen.scripture : [],
    updatedAt: Date.now(),
    dirty: true,
  });

  await db.setMeta("legacyMigrated", true);
  return true;
}
