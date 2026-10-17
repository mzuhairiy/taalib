import { describe, it, expect } from "vitest";
import { migrateLegacyIfNeeded } from "../src/migrate-legacy.js";
import * as db from "../src/db.js";

const USER = "user-1";
const LEGACY_KEY = "taalib-v1";

function legacyBlob() {
  return {
    v: 2, lang: "en", theme: "dark",
    canvas: { id: "v1-default", startDate: "2026-09-01" },
    subjects: [
      { id: "old-a", name: "React", color: "sky", archived: false },
      { id: "old-b", name: "Golang", color: "amber", archived: true },
    ],
    sessions: [
      { id: "old-s1", date: "2026-10-01", startedAt: 1000, finishedAt: 2000, title: "Hooks", summary: "useState and useEffect basics, long enough body." , subjectId: "old-a" },
      { id: "old-s2", date: "2026-10-02", startedAt: 3000, finishedAt: 4000, summary: "Channels are typed conduits, long enough body text.", subjectId: "old-b" },
      { id: "old-s3", date: "2026-10-03", startedAt: 5000, finishedAt: 6000, summary: "Orphaned reference to a subject that was never exported.", subjectId: "does-not-exist" },
    ],
    activeSession: { id: "live-1", startedAt: 9999 },
    seen: { affirmations: [1, 2], aspirations: [3], scripture: [4, 5] },
  };
}

describe("migrateLegacyIfNeeded", () => {
  it("does nothing when there's no legacy blob", async () => {
    const migrated = await migrateLegacyIfNeeded(USER);
    expect(migrated).toBe(false);
    expect(await db.getAll("subjects")).toEqual([]);
  });

  it("migrates subjects, sessions, and settings with remapped ids", async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacyBlob()));
    const migrated = await migrateLegacyIfNeeded(USER);
    expect(migrated).toBe(true);

    const subjects = await db.getAll("subjects");
    expect(subjects.length).toBe(2);
    for (const s of subjects) {
      expect(s.id).not.toBe("old-a");
      expect(s.id).not.toBe("old-b");
      expect(s.dirty).toBe(true);
      expect(s.userId).toBe(USER);
    }
    const reactSubj = subjects.find(s => s.name === "React");
    const golangSubj = subjects.find(s => s.name === "Golang");
    expect(reactSubj.archived).toBe(false);
    expect(golangSubj.archived).toBe(true);

    const sessions = await db.getAll("sessions");
    expect(sessions.length).toBe(3);
    const bySummaryStart = (text) => sessions.find(s => s.summary.startsWith(text));
    expect(bySummaryStart("useState").subjectId).toBe(reactSubj.id);
    expect(bySummaryStart("Channels").subjectId).toBe(golangSubj.id);
    // Orphaned subjectId falls back to a live subject rather than a dangling FK.
    const orphan = bySummaryStart("Orphaned");
    expect(orphan.subjectId).toBe(reactSubj.id);
    expect(bySummaryStart("useState").title).toBe("Hooks");

    const settings = await db.get("settings", USER);
    expect(settings.lang).toBe("en");
    expect(settings.theme).toBe("dark");
    expect(settings.seenAffirmations).toEqual([1, 2]);
    // A stale in-progress session from the old device isn't resurrected.
    expect(settings.activeSession).toBeNull();
  });

  it("is idempotent — running it again doesn't duplicate rows", async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacyBlob()));
    await migrateLegacyIfNeeded(USER);
    const countAfterFirst = (await db.getAll("sessions")).length;

    const migratedAgain = await migrateLegacyIfNeeded(USER);
    expect(migratedAgain).toBe(false);
    expect((await db.getAll("sessions")).length).toBe(countAfterFirst);
    expect((await db.getAll("subjects")).length).toBe(2);
  });
});
