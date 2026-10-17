import { describe, it, expect } from "vitest";
import { deriveTitle, highlight, escapeRegex, esc } from "../src/utils.js";

describe("deriveTitle", () => {
  it("returns empty string for empty input", () => {
    expect(deriveTitle("")).toBe("");
    expect(deriveTitle(null)).toBe("");
    expect(deriveTitle(undefined)).toBe("");
  });
  it("returns the first non-empty line", () => {
    expect(deriveTitle("Hello world")).toBe("Hello world");
    expect(deriveTitle("\n\nSecond line is title\nthird")).toBe("Second line is title");
  });
  it("truncates to max length with ellipsis", () => {
    const long = "x".repeat(120);
    const out = deriveTitle(long, 60);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith("…")).toBe(true);
  });
  it("does not truncate strings within max length", () => {
    expect(deriveTitle("short", 60)).toBe("short");
  });
});

describe("escapeRegex", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegex(".*+?^${}()|[]\\")).toBe("\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\");
  });
  it("leaves regular letters untouched", () => {
    expect(escapeRegex("hello world")).toBe("hello world");
  });
});

describe("highlight", () => {
  it("returns escaped text when query is empty", () => {
    expect(highlight("a < b", "")).toBe("a &lt; b");
    expect(highlight("x", null)).toBe("x");
  });
  it("wraps case-insensitive matches in <mark>", () => {
    expect(highlight("Hello hello", "hello")).toBe("<mark>Hello</mark> <mark>hello</mark>");
  });
  it("never introduces HTML even when content has markup-looking text", () => {
    const out = highlight("<script>alert(1)</script>", "script");
    expect(out).not.toContain("<script>");
    expect(out).toContain("<mark>script</mark>");
    // The angle brackets of the original must be escaped.
    expect(out).toContain("&lt;");
    expect(out).toContain("&gt;");
  });
  it("treats the query as literal, not a regex", () => {
    const out = highlight("find a.b here", "a.b");
    expect(out).toContain("<mark>a.b</mark>");
    // Must not match "aXb" or any single-char.
    expect(highlight("axb a.b", "a.b")).toBe("axb <mark>a.b</mark>");
  });
  it("highlights across HTML-escaped boundaries safely", () => {
    const out = highlight("A & B & C", "&");
    // '&' escapes to '&amp;', the mark wraps the escaped form.
    expect(out).toContain("<mark>&amp;</mark>");
  });
});

describe("esc", () => {
  it("escapes the standard set", () => {
    expect(esc(`<a href="x">b&c'd</a>`)).toBe(`&lt;a href=&quot;x&quot;&gt;b&amp;c&#39;d&lt;/a&gt;`);
  });
});
