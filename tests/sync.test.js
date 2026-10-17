import { describe, it, expect } from "vitest";
import {
  toIso, fromIso, subjectToRow, rowToSubject, sessionToRow, rowToSession,
  supabase, syncAvailable, pullAll,
} from "../src/sync.js";
import { state, hydrate, addSubject, updateSubject } from "../src/save.js";
import * as db from "../src/db.js";

describe("timestamp helpers", () => {
  it("toIso/fromIso round-trip a millisecond timestamp", () => {
    const ms = Date.parse("2026-10-17T12:00:00.000Z");
    expect(fromIso(toIso(ms))).toBe(ms);
  });
  it("map falsy ms / iso to null and 0 respectively", () => {
    expect(toIso(0)).toBeNull();
    expect(toIso(null)).toBeNull();
    expect(fromIso(null)).toBe(0);
    expect(fromIso(undefined)).toBe(0);
  });
});

describe("subject row mapping", () => {
  it("subjectToRow produces snake_case columns", () => {
    const s = { id: "a", name: "React", color: "sky", archived: false, targetSessions: 3, createdAt: 1000 };
    const row = subjectToRow(s, "user-1");
    expect(row).toMatchObject({
      id: "a", user_id: "user-1", name: "React", color: "sky",
      archived: false, target_sessions: 3,
    });
    expect(row.created_at).toBe(toIso(1000));
  });
  it("rowToSubject is the inverse shape and always comes back clean (not dirty)", () => {
    const row = { id: "a", user_id: "user-1", name: "React", color: "sky", archived: true, target_sessions: 5, created_at: toIso(1000), updated_at: toIso(2000) };
    const s = rowToSubject(row);
    expect(s).toEqual({ id: "a", userId: "user-1", name: "React", color: "sky", archived: true, targetSessions: 5, createdAt: 1000, updatedAt: 2000, dirty: false });
  });
});

describe("session row mapping", () => {
  it("maps an in-progress session (no finishedAt) to a null finished_at", () => {
    const s = { id: "s1", subjectId: "a", date: "2026-10-17", startedAt: 1000, finishedAt: 0, title: "", summary: "body", createdAt: 1000, deletedAt: null };
    const row = sessionToRow(s, "user-1");
    expect(row.finished_at).toBeNull();
    expect(row.deleted_at).toBeNull();
  });
  it("maps a tombstoned session's deletedAt through to deleted_at", () => {
    const s = { id: "s1", subjectId: "a", date: "2026-10-17", startedAt: 1000, finishedAt: 2000, title: "", summary: "body", createdAt: 1000, deletedAt: 5000 };
    const row = sessionToRow(s, "user-1");
    expect(row.deleted_at).toBe(toIso(5000));
  });
  it("rowToSession maps a non-deleted row's deleted_at back to null, not 0", () => {
    const row = { id: "s1", user_id: "u", subject_id: "a", date: "2026-10-17", started_at: toIso(1000), finished_at: toIso(2000), title: "", summary: "body", created_at: toIso(1000), updated_at: toIso(1000), deleted_at: null };
    const s = rowToSession(row);
    expect(s.deletedAt).toBeNull();
  });
});

describe("pullAll conflict rule: pending local write wins until synced", () => {
  it("does not overwrite a dirty local subject with an older-looking server row", async () => {
    await hydrate("user-1");
    const subj = addSubject("Alpha", "sky");
    updateSubject(subj.id, { name: "Alpha (local edit)" }); // marks it dirty

    expect(syncAvailable).toBe(true);
    // Simulate a stale/conflicting server row for the same id coming back on pull.
    supabase.from = (table) => {
      if (table === "subjects") {
        return {
          select: () => ({
            eq: () => ({
              gt: () => ({
                order: async () => ({
                  data: [{
                    id: subj.id, user_id: "user-1", name: "Alpha (server, should be ignored)",
                    color: "sky", archived: false, target_sessions: 3,
                    created_at: new Date(subj.createdAt).toISOString(),
                    updated_at: new Date().toISOString(),
                  }],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      // sessions (.eq().gt().order()) / user_settings (.eq().maybeSingle()): no changes.
      return {
        select: () => ({
          eq: () => ({
            gt: () => ({ order: async () => ({ data: [], error: null }) }),
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    };

    await pullAll();

    const live = state.subjects.find(x => x.id === subj.id);
    expect(live.name).toBe("Alpha (local edit)");
    // IndexedDB copy must also be untouched, not just the in-memory one.
    const cached = await db.get("subjects", subj.id);
    expect(cached.name).toBe("Alpha (local edit)");
  });
});
