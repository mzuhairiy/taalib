import { state, subjectById, liveSubjects } from "../save.js";
import { t, locale } from "../i18n.js";
import { esc, parse, fmt, fmtTime } from "../utils.js";

let searchTerm = "";
let activeSubjectId = ""; // "" means all
export function setSearch(v) { searchTerm = String(v || "").toLowerCase(); }
export function setFilterSubject(id) { activeSubjectId = id || ""; }
export function getSearch() { return searchTerm; }
export function getFilterSubject() { return activeSubjectId; }

export function renderReview() {
  const { listHtml, count } = renderReviewList();
  const chips = subjectChips();
  return `
    <section class="sheet">
      <div class="sheet-h">
        <h2>${esc(t("review.title"))}</h2>
        <span class="muted small" id="rv-count">${esc(t("review.resultCount", count))}</span>
      </div>
      <div class="sheet-b">
        <input type="text" id="sum-search" placeholder="${esc(t("review.search"))}" value="${esc(searchTerm)}" autocomplete="off" />
      </div>
      <div class="sheet-b" style="padding-top:0" id="rv-chips">
        ${chips}
      </div>
      <div class="sheet-b flush" id="rv-list">${listHtml}</div>
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

export function renderReviewList() {
  const sessions = [...state.sessions].sort((a, b) => b.startedAt - a.startedAt);
  const q = searchTerm.trim();
  let filtered = activeSubjectId ? sessions.filter(s => s.subjectId === activeSubjectId) : sessions;
  if (q) filtered = filtered.filter(s => s.summary.toLowerCase().includes(q));
  const listHtml = filtered.length
    ? filtered.map(itemHtml).join("")
    : `<div class="empty">${esc(t("review.empty"))}</div>`;
  return { listHtml, count: filtered.length };
}

function itemHtml(s) {
  const subj = subjectById(s.subjectId);
  const d = s.date ? fmt(parse(s.date), locale(), true) : "";
  const time = s.startedAt ? fmtTime(s.startedAt, locale()) : "";
  return `
    <div class="sum-item">
      <div class="meta">
        <div class="meta-l"><b>${esc(d)}</b><span class="t">${esc(time)}</span></div>
        <span class="chip chip-${subj.color} sm">${esc(subj.name)}</span>
      </div>
      <div class="sum-body">${esc(s.summary)}</div>
    </div>
  `;
}
