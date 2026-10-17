import { state, subjectById, liveSubjects } from "../save.js";
import { t, locale } from "../i18n.js";
import { esc, parse, fmt, fmtTime, deriveTitle, highlight } from "../utils.js";

let searchTerm = "";
let activeSubjectId = ""; // "" means all
let viewLevel = "topics"; // "topics" | "summaries" | "detail"
let openTopicId = "";
let openSummaryId = "";

export function setSearch(v) { searchTerm = String(v || "").toLowerCase(); }
export function setFilterSubject(id) {
  activeSubjectId = id || "";
  // Changing the top-level chip filter resets any drill-down.
  viewLevel = "topics";
  openTopicId = "";
  openSummaryId = "";
}
export function getSearch() { return searchTerm; }
export function getFilterSubject() { return activeSubjectId; }

export function openTopic(id) {
  openTopicId = id;
  viewLevel = "summaries";
  openSummaryId = "";
}
export function openSummaryDetail(id) {
  openSummaryId = id;
  viewLevel = "detail";
}
export function goBack() {
  if (viewLevel === "detail") {
    viewLevel = openTopicId ? "summaries" : "topics";
    openSummaryId = "";
  } else if (viewLevel === "summaries") {
    viewLevel = "topics";
    openTopicId = "";
  }
}
export function getLevel() { return viewLevel; }
export function getOpenTopicId() { return openTopicId; }
export function getOpenSummaryId() { return openSummaryId; }

/* After a summary is deleted, keep the view sensible. */
export function reconcileAfterDelete() {
  if (viewLevel === "detail") {
    const s = state.sessions.find(x => x.id === openSummaryId);
    if (!s) {
      openSummaryId = "";
      viewLevel = openTopicId ? "summaries" : "topics";
    }
  }
  if (viewLevel === "summaries" && openTopicId) {
    const remaining = state.sessions.some(x => x.subjectId === openTopicId);
    if (!remaining) {
      openTopicId = "";
      viewLevel = "topics";
    }
  }
}

/* ===== pure helpers ===== */

export function matchSessions(sessions, { subjectId = "", query = "" } = {}) {
  const q = String(query || "").toLowerCase().trim();
  let out = subjectId ? sessions.filter(s => s.subjectId === subjectId) : sessions.slice();
  if (q) {
    out = out.filter(s =>
      (s.summary || "").toLowerCase().includes(q) ||
      (s.title || "").toLowerCase().includes(q)
    );
  }
  return out;
}

export function groupBySubject(sessions) {
  const map = new Map();
  for (const s of sessions) {
    if (!map.has(s.subjectId)) map.set(s.subjectId, []);
    map.get(s.subjectId).push(s);
  }
  for (const arr of map.values()) arr.sort((a, b) => b.startedAt - a.startedAt);
  return map;
}

/* ===== rendering ===== */

export function renderReview() {
  if (viewLevel === "detail") return renderDetail();
  // topics + summaries both share the search input + chip row header.
  const header = headerHtml();
  if (viewLevel === "summaries" && openTopicId) {
    return `${header}${renderSummariesLevel()}`;
  }
  return `${header}${renderTopicsLevel()}`;
}

function headerHtml() {
  return `
    <section class="sheet">
      <div class="sheet-h">
        <h2>${esc(t("review.title"))}</h2>
      </div>
      <div class="sheet-b">
        <input type="text" id="sum-search" placeholder="${esc(t("review.search"))}" value="${esc(searchTerm)}" autocomplete="off" />
      </div>
      <div class="sheet-b" style="padding-top:0" id="rv-chips">
        ${subjectChips()}
      </div>
    </section>
  `;
}

function subjectChips() {
  const subs = liveSubjects();
  const counts = new Map();
  for (const s of state.sessions) counts.set(s.subjectId, (counts.get(s.subjectId) || 0) + 1);
  const all = `<button class="chip chip-ghost ${activeSubjectId === "" ? "active" : ""}" data-filter-sub="">${esc(t("review.filter.all"))} <span class="chip-n">${state.sessions.length}</span></button>`;
  const subChips = subs
    .filter(s => counts.get(s.id))
    .map(s => `<button class="chip chip-${s.color} ${activeSubjectId === s.id ? "active" : ""}" data-filter-sub="${esc(s.id)}">${esc(s.name)} <span class="chip-n">${counts.get(s.id)}</span></button>`)
    .join("");
  return `<div class="chiprow">${all}${subChips}</div>`;
}

/* ---- Topics level (also hosts grouped search results) ---- */

function renderTopicsLevel() {
  const q = searchTerm.trim();
  const matches = matchSessions(state.sessions, { subjectId: activeSubjectId, query: q });

  if (!state.sessions.length) {
    return `<section class="sheet"><div class="empty">${esc(t("review.empty"))}</div></section>`;
  }
  if (q && !matches.length) {
    return `<section class="sheet"><div class="empty">${esc(t("review.noMatch"))}</div></section>`;
  }

  const grouped = groupBySubject(matches);
  // Order groups by newest activity in each.
  const rows = [...grouped.entries()]
    .map(([subId, arr]) => ({ subj: subjectById(subId), arr }))
    .filter(r => r.subj)
    .sort((a, b) => (b.arr[0]?.startedAt || 0) - (a.arr[0]?.startedAt || 0));

  const headerLabel = q ? t("review.searchResults") : t("review.topicsHint");

  return `
    <section class="sheet">
      <div class="sheet-h">
        <h3 class="small muted" style="margin:0;font-weight:600">${esc(headerLabel)}</h3>
        <span class="muted small">${esc(t("review.resultCount", matches.length))}</span>
      </div>
      <div class="sheet-b flush" id="rv-topics">
        ${rows.map(r => topicRowHtml(r.subj, r.arr.length, r.arr[0], q)).join("")}
      </div>
    </section>
  `;
}

function topicRowHtml(subj, matchCount, newest, q) {
  const loc = locale();
  const last = newest?.startedAt ? fmt(new Date(newest.startedAt), loc, true) : "—";
  const countLabel = q ? t("review.topicMatch", matchCount) : t("review.sessionsCount", matchCount);
  return `
    <button class="rv-topic-row" data-act="rv-open-topic" data-sub="${esc(subj.id)}">
      <span class="chip chip-${subj.color} sm">${esc(subj.name)}</span>
      <span class="rv-topic-meta small muted">${esc(countLabel)} · ${esc(last)}</span>
      <span class="rv-topic-chev" aria-hidden="true">›</span>
    </button>
  `;
}

/* ---- Summaries level ---- */

function renderSummariesLevel() {
  const subj = subjectById(openTopicId);
  if (!subj) {
    // Topic vanished; fall back cleanly.
    return renderTopicsLevel();
  }
  const q = searchTerm.trim();
  // Within a topic, honor the search term, but ignore activeSubjectId (we're already scoped).
  const matched = matchSessions(state.sessions, { subjectId: openTopicId, query: q });
  const sorted = matched.sort((a, b) => b.startedAt - a.startedAt);

  const headerBar = `
    <section class="sheet">
      <div class="sheet-h">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <button class="back-btn" data-act="rv-back" aria-label="${esc(t("review.back"))}">
            <span class="back-arrow" aria-hidden="true">‹</span><span>${esc(t("review.back"))}</span>
          </button>
          <span class="chip chip-${subj.color} sm">${esc(subj.name)}</span>
          <span class="small muted">${esc(t("review.summariesIn"))}</span>
        </div>
        <span class="muted small">${esc(t("review.resultCount", sorted.length))}</span>
      </div>
      <div class="sheet-b flush" id="rv-sumlist">
        ${sorted.length
          ? sorted.map(s => summaryRowHtml(s, q)).join("")
          : `<div class="empty">${esc(q ? t("review.noMatch") : t("review.empty"))}</div>`}
      </div>
    </section>
  `;
  return headerBar;
}

function summaryRowHtml(s, q) {
  const loc = locale();
  const d = s.date ? fmt(parse(s.date), loc, true) : "";
  const time = s.startedAt ? fmtTime(s.startedAt, loc) : "";
  const title = (s.title && s.title.trim()) || deriveTitle(s.summary) || t("review.detail.untitled");
  const titleHtml = q ? highlight(title, q) : esc(title);
  return `
    <button class="rv-sum-row" data-act="rv-open-sum" data-sum="${esc(s.id)}">
      <div class="rv-sum-title">${titleHtml}</div>
      <div class="rv-sum-meta small muted">${esc(d)}${time ? ` · ${esc(time)}` : ""}</div>
    </button>
  `;
}

/* ---- Detail level ---- */

function renderDetail() {
  const s = state.sessions.find(x => x.id === openSummaryId);
  if (!s) {
    // Fall back if the session has gone.
    viewLevel = openTopicId ? "summaries" : "topics";
    return renderReview();
  }
  const subj = subjectById(s.subjectId);
  const loc = locale();
  const d = s.date ? fmt(parse(s.date), loc, true) : "";
  const time = s.startedAt ? fmtTime(s.startedAt, loc) : "";
  const q = searchTerm.trim();
  const title = (s.title && s.title.trim()) || deriveTitle(s.summary) || t("review.detail.untitled");
  const titleHtml = q ? highlight(title, q) : esc(title);
  const bodyHtml = q ? highlight(s.summary, q) : esc(s.summary);

  return `
    <section class="sheet rv-detail">
      <div class="sheet-h">
        <button class="back-btn" data-act="rv-back" aria-label="${esc(t("review.back"))}">
          <span class="back-arrow" aria-hidden="true">‹</span><span>${esc(t("review.back"))}</span>
        </button>
        <div class="rv-detail-actions">
          <button class="btn ghost sm" data-act="rv-edit-sum" data-sum="${esc(s.id)}">${esc(t("review.edit"))}</button>
          <button class="btn ghost sm" data-act="rv-delete-sum" data-sum="${esc(s.id)}">${esc(t("review.delete"))}</button>
        </div>
      </div>
      <div class="sheet-b" style="display:grid;gap:6px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="chip chip-${subj.color} sm">${esc(subj.name)}</span>
          <span class="small muted">${esc(d)}${time ? ` · ${esc(time)}` : ""}</span>
        </div>
        <h2 class="rv-detail-title">${titleHtml}</h2>
      </div>
      <div class="sheet-b">
        <div class="sum-body">${bodyHtml}</div>
      </div>
    </section>
  `;
}
