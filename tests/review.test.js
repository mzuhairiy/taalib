import { describe, it, expect } from "vitest";
import { matchSessions, groupBySubject } from "../src/views/review.js";

const S = (id, subjectId, text, started = 0) => ({
  id, subjectId, summary: text, title: "", startedAt: started, date: "2026-10-17",
});

describe("matchSessions", () => {
  const sessions = [
    S("1", "a", "React hooks and state"),
    S("2", "a", "Golang channels"),
    S("3", "b", "QA automation playwright"),
    { ...S("4", "b", "Nothing relevant"), title: "Playwright setup" },
  ];
  it("returns all when no filters", () => {
    expect(matchSessions(sessions).length).toBe(4);
  });
  it("filters by subjectId", () => {
    expect(matchSessions(sessions, { subjectId: "a" }).map(s => s.id)).toEqual(["1", "2"]);
  });
  it("filters by query (case-insensitive) over summary", () => {
    expect(matchSessions(sessions, { query: "GOLANG" }).map(s => s.id)).toEqual(["2"]);
  });
  it("filters by query over title too", () => {
    expect(matchSessions(sessions, { query: "setup" }).map(s => s.id)).toEqual(["4"]);
  });
  it("combines subjectId and query", () => {
    expect(matchSessions(sessions, { subjectId: "b", query: "playwright" }).map(s => s.id).sort()).toEqual(["3", "4"]);
  });
  it("returns empty for no-match", () => {
    expect(matchSessions(sessions, { query: "nonexistent-term-xyz" })).toEqual([]);
  });
});

describe("groupBySubject", () => {
  it("groups sessions and sorts each group newest-first", () => {
    const sessions = [
      S("a1", "a", "x", 10),
      S("a2", "a", "y", 30),
      S("a3", "a", "z", 20),
      S("b1", "b", "m", 5),
    ];
    const g = groupBySubject(sessions);
    expect(g.get("a").map(s => s.id)).toEqual(["a2", "a3", "a1"]);
    expect(g.get("b").map(s => s.id)).toEqual(["b1"]);
  });
  it("returns an empty Map for empty input", () => {
    expect(groupBySubject([]).size).toBe(0);
  });
});
