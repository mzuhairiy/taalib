import { ymd, today, addDays } from "./utils.js";
import { DEFAULT_TARGET_SESSIONS } from "./save.js";

/**
 * Number of consecutive calendar days ending at `now` on which at least one
 * session was logged. If today has no session but yesterday does, the current
 * streak still counts (so the user isn't punished until a full day has lapsed
 * without a session).
 */
export function currentStreak(sessions, now = today()) {
  const dates = new Set();
  for (const s of sessions) if (s && s.date) dates.add(s.date);
  if (!dates.size) return 0;

  let anchor = now;
  // Allow a one-day grace: if today is empty but yesterday has one, start counting
  // from yesterday.
  if (!dates.has(ymd(anchor))) {
    const y = addDays(anchor, -1);
    if (!dates.has(ymd(y))) return 0;
    anchor = y;
  }

  let count = 0;
  let d = anchor;
  while (dates.has(ymd(d))) {
    count += 1;
    d = addDays(d, -1);
  }
  return count;
}

/** Session count for one subject (ignores no filtering by date). */
export function sessionCountFor(sessions, subjectId) {
  let n = 0;
  for (const s of sessions) if (s.subjectId === subjectId) n += 1;
  return n;
}

/**
 * Count of non-archived subjects that have reached their `targetSessions`.
 * Topic completion = cumulative session count ≥ its target. Deleting a session
 * can drop a topic back below its target; that's fine for the current view, but
 * historical progression (growth stage once reached) is NOT persisted — the
 * current count is always derived from live state.
 */
export function completedTopicsCount(state) {
  let n = 0;
  for (const subj of state.subjects) {
    if (subj.archived) continue;
    const target = Number(subj.targetSessions) || DEFAULT_TARGET_SESSIONS;
    if (sessionCountFor(state.sessions, subj.id) >= target) n += 1;
  }
  return n;
}

/**
 * Growth stage derived from completed topics, capped by `maxStage` (default 3,
 * matching the three illustrated growth stages — roots, stem, bloom).
 */
export function growthStage(state, maxStage = 3) {
  return Math.min(maxStage, completedTopicsCount(state));
}
