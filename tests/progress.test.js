import { describe, it, expect } from "vitest";
import { currentStreak, completedTopicsCount, growthStage } from "../src/progress.js";

const d = (iso) => new Date(iso + "T12:00:00");

describe("currentStreak", () => {
  it("is 0 for no sessions", () => {
    expect(currentStreak([], d("2026-10-17"))).toBe(0);
  });
  it("is 1 when today has one session", () => {
    const sessions = [{ date: "2026-10-17" }];
    expect(currentStreak(sessions, d("2026-10-17"))).toBe(1);
  });
  it("counts yesterday if today is empty but yesterday has a session (grace)", () => {
    const sessions = [{ date: "2026-10-16" }];
    expect(currentStreak(sessions, d("2026-10-17"))).toBe(1);
  });
  it("is 0 when neither today nor yesterday has a session", () => {
    const sessions = [{ date: "2026-10-15" }];
    expect(currentStreak(sessions, d("2026-10-17"))).toBe(0);
  });
  it("counts consecutive days ending at today", () => {
    const sessions = [
      { date: "2026-10-15" }, { date: "2026-10-16" }, { date: "2026-10-17" },
    ];
    expect(currentStreak(sessions, d("2026-10-17"))).toBe(3);
  });
  it("counts duplicate same-day sessions as one streak day", () => {
    const sessions = [
      { date: "2026-10-17" }, { date: "2026-10-17" }, { date: "2026-10-17" },
      { date: "2026-10-16" },
    ];
    expect(currentStreak(sessions, d("2026-10-17"))).toBe(2);
  });
  it("stops at a missing day in the middle", () => {
    const sessions = [
      { date: "2026-10-14" }, // gap at 15
      { date: "2026-10-16" }, { date: "2026-10-17" },
    ];
    expect(currentStreak(sessions, d("2026-10-17"))).toBe(2);
  });
});

describe("completedTopicsCount & growthStage", () => {
  const stateFactory = (subjects, sessions) => ({ subjects, sessions });
  it("is 0 with no sessions", () => {
    const st = stateFactory(
      [{ id: "a", name: "A", color: "sky", archived: false, targetSessions: 3 }],
      []
    );
    expect(completedTopicsCount(st)).toBe(0);
    expect(growthStage(st)).toBe(0);
  });
  it("counts only subjects whose sessions reach their target", () => {
    const st = stateFactory(
      [
        { id: "a", archived: false, targetSessions: 3 },
        { id: "b", archived: false, targetSessions: 5 },
      ],
      [
        { subjectId: "a" }, { subjectId: "a" }, { subjectId: "a" },
        { subjectId: "b" }, { subjectId: "b" },
      ]
    );
    expect(completedTopicsCount(st)).toBe(1);
  });
  it("ignores archived subjects", () => {
    const st = stateFactory(
      [{ id: "a", archived: true, targetSessions: 1 }],
      [{ subjectId: "a" }]
    );
    expect(completedTopicsCount(st)).toBe(0);
  });
  it("falls back to default target when subject has no target set", () => {
    const st = stateFactory(
      [{ id: "a", archived: false }],
      [{ subjectId: "a" }, { subjectId: "a" }, { subjectId: "a" }]
    );
    expect(completedTopicsCount(st)).toBe(1);
  });
  it("growthStage caps at 3 by default", () => {
    const subjects = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, archived: false, targetSessions: 1 }));
    const sessions = subjects.map(s => ({ subjectId: s.id }));
    const st = stateFactory(subjects, sessions);
    expect(completedTopicsCount(st)).toBe(5);
    expect(growthStage(st)).toBe(3);
  });
});
