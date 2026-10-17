import { describe, it, expect, beforeEach } from "vitest";
import {
  state, hydrate, addSubject, updateSubject,
  addSession, updateSession, deleteSession, resetAccountData,
  hasUnpushedChanges,
} from "../src/save.js";

const USER = "user-1";

async function seed() {
  await hydrate(USER); // creates the default "Umum" subject
  const a = addSubject("Alpha", "sky");
  const b = addSubject("Beta", "mint");
  const s1 = addSession({ subjectId: a.id, summary: "first body long enough content", date: "2026-10-17", startedAt: 1, finishedAt: 2 });
  const s2 = addSession({ subjectId: b.id, summary: "second body long enough content", title: "T2", date: "2026-10-16", startedAt: 3, finishedAt: 4 });
  return { a, b, s1, s2 };
}

describe("hydrate", () => {
  it("bootstraps a default subject for a brand new user", async () => {
    await hydrate(USER);
    expect(state.subjects.length).toBe(1);
    expect(state.subjects[0].name).toBe("Umum");
    expect(state.sessions).toEqual([]);
  });
});

describe("addSession / updateSession", () => {
  it("patches title and summary", async () => {
    const { s1 } = await seed();
    const ok = updateSession(s1.id, { title: "New title", summary: "new body long enough content" });
    expect(ok).toBe(true);
    const s = state.sessions.find(x => x.id === s1.id);
    expect(s.title).toBe("New title");
    expect(s.summary).toBe("new body long enough content");
    expect(s.dirty).toBe(true);
  });

  it("leaves other sessions untouched", async () => {
    const { s1, s2 } = await seed();
    updateSession(s1.id, { title: "x", summary: "y long enough body text!" });
    const s2again = state.sessions.find(x => x.id === s2.id);
    expect(s2again.title).toBe("T2");
    expect(s2again.summary).toBe("second body long enough content");
  });

  it("rejects an empty summary and returns false", async () => {
    const { s1 } = await seed();
    const ok = updateSession(s1.id, { summary: "   " });
    expect(ok).toBe(false);
    const s = state.sessions.find(x => x.id === s1.id);
    expect(s.summary).toBe("first body long enough content");
  });

  it("returns false when the id doesn't match", async () => {
    await seed();
    expect(updateSession("nope", { title: "x" })).toBe(false);
  });
});

describe("deleteSession", () => {
  it("removes it from state.sessions and returns true", async () => {
    const { s1 } = await seed();
    const ok = deleteSession(s1.id);
    expect(ok).toBe(true);
    expect(state.sessions.find(x => x.id === s1.id)).toBeUndefined();
  });

  it("returns false when the id doesn't match", async () => {
    await seed();
    const n = state.sessions.length;
    expect(deleteSession("missing")).toBe(false);
    expect(state.sessions.length).toBe(n);
  });
});

describe("updateSubject targetSessions", () => {
  it("clamps non-positive values to the default", async () => {
    await hydrate(USER);
    const a = addSubject("Alpha", "sky");
    updateSubject(a.id, { targetSessions: 0 });
    expect(state.subjects.find(x => x.id === a.id).targetSessions).toBe(3);
    updateSubject(a.id, { targetSessions: -5 });
    expect(state.subjects.find(x => x.id === a.id).targetSessions).toBe(3);
  });

  it("accepts positive integers", async () => {
    await hydrate(USER);
    const a = addSubject("Alpha", "sky");
    updateSubject(a.id, { targetSessions: 7 });
    expect(state.subjects.find(x => x.id === a.id).targetSessions).toBe(7);
  });
});

describe("resetAccountData", () => {
  it("tombstones every session and archives every subject, leaving one fresh default", async () => {
    await seed();
    await resetAccountData();
    expect(state.sessions).toEqual([]);
    const live = state.subjects.filter(s => !s.archived);
    expect(live.length).toBe(1);
    expect(live[0].name).toBe("Umum");
  });
});

describe("hasUnpushedChanges", () => {
  it("is true right after a mutation", async () => {
    await seed();
    expect(await hasUnpushedChanges()).toBe(true);
  });
});
