import { state, subjectById } from "../save.js";
import { t, locale, greeting } from "../i18n.js";
import { renderCalendarGrid, gridTotal } from "../components/grid.js";
import { scriptureCard, motivationLine } from "../components/banner.js";
import { renderGrowth } from "../components/growth.js";
import { currentStreak, growthStage } from "../progress.js";
import { affirmations } from "../content/affirmations.js";
import { aspirations } from "../content/aspirations.js";
import { scripture } from "../content/scripture.js";
import { canvasCopy } from "../content/canvas-copy.js";
import { esc, fmtTime, ymd, today, parse, fmt } from "../utils.js";

export function pickHomeReminderPick() {
  // Reminder = scripture + motivation line (rotated between grounded + aspirational)
  const kind = Math.random() < 0.5 ? "aspiration" : "affirmation";
  const pool = kind === "aspiration" ? aspirations : affirmations;
  return {
    kind,
    motivationIdx: Math.floor(Math.random() * pool.length),
    scriptureIdx: Math.floor(Math.random() * scripture.length)
  };
}

export function pickCanvasCopyIdx() {
  if (!canvasCopy.length) return 0;
  return Math.floor(Math.random() * canvasCopy.length);
}

export function renderHome({ animateDate = null, reminder, canvasCopyIdx = 0 } = {}) {
  const filled = state.sessions.length;
  const total = gridTotal();
  const live = state.activeSession;
  const todayY = ymd(today());
  const todaysSessions = state.sessions.filter(s => s.date === todayY);
  const r = reminder || pickHomeReminderPick();

  // Reminder (on top)
  const reminderHtml = `
    <section class="reminder-top">
      <div class="greeting">
        <span class="hi">${esc(greeting())}</span>
        <button class="btn ghost sm icon-only" data-act="home-reminder-shuffle" aria-label="${esc(t("home.reminderNew"))}">↻</button>
      </div>
      ${motivationLine({ kind: r.kind, idx: r.motivationIdx, phase: "pre", big: true })}
      ${scriptureCard(r.scriptureIdx, { compact: true })}
    </section>
  `;

  // Hero (big counter + growth + today hint + streak)
  const todayHintKey = live ? "home.todayHint.more" : (todaysSessions.length ? "home.todayHint.done" : "home.todayHint.first");
  const stage = growthStage(state);
  const streak = currentStreak(state.sessions);
  const heroHtml = `
    <section class="hero-card">
      <div class="hero-grid">
        <div class="hero-main">
          <div class="hero-count-row">
            <div>
              <div class="hero-count">${filled}</div>
              <div class="hero-label">${esc(t("home.sessionsLabel"))} <span class="of">/ ${total}</span></div>
            </div>
            ${renderGrowth({ kind: "flower", stage })}
          </div>
          <div class="hero-hint">${esc(t(todayHintKey))}</div>
        </div>
        <div class="hero-streak" title="${esc(t("home.streakHint"))}">
          <div class="hero-streak-num">${streak}</div>
          <div class="hero-streak-label">${esc(t("home.streakLabel"))}</div>
        </div>
      </div>
    </section>
  `;

  // Live-session block (if active)
  const liveBlock = live ? `
    <section class="sheet live-sheet">
      <div class="session-live">
        <div class="label">${esc(t("home.sessionLive.label"))} · <span class="small muted">${esc(t("home.sessionLive.started"))} ${esc(fmtTime(live.startedAt, locale()))}</span></div>
        <div class="btnrow" style="margin-top:8px">
          <button class="btn primary lg" data-act="session-finish">${esc(t("home.sessionLive.resume"))}</button>
          <button class="btn ghost sm" data-act="session-cancel">${esc(t("home.sessionLive.cancel"))}</button>
        </div>
      </div>
    </section>
  ` : "";

  const startCta = live ? "" : `
    <div class="cta-wrap">
      <button class="btn primary lg block playful-cta" data-act="session-start">
        <span class="dot"></span>
        ${esc(t("home.start"))}
      </button>
    </div>
  `;

  // Learning canvas — rotating consistency copy sits in the sheet header
  const copyIdx = ((canvasCopyIdx % canvasCopy.length) + canvasCopy.length) % canvasCopy.length;
  const copyEntry = canvasCopy[copyIdx] || canvasCopy[0];
  const copyText = (copyEntry && copyEntry[state.lang]) || copyEntry?.id || "";
  const calendarHtml = `
    <section class="sheet">
      <div class="sheet-h canvas-h">
        <h2>${esc(t("home.gridTitle"))}</h2>
        <div class="canvas-copy">
          <span class="canvas-copy-text">${esc(copyText)}</span>
          <button class="btn ghost sm icon-only canvas-copy-reroll" data-act="canvas-copy-reroll" aria-label="${esc(t("canvas.reroll"))}" title="${esc(t("canvas.reroll"))}">↻</button>
        </div>
      </div>
      <div class="sheet-b flush">
        ${renderCalendarGrid({ animateDate })}
      </div>
    </section>
  `;

  // Subject distribution
  const subjectsHtml = renderSubjectStrip();

  // Last summary preview
  const lastSummaryHtml = renderLastSummary();

  return `
    ${reminderHtml}
    ${heroHtml}
    ${liveBlock}
    ${startCta}
    ${calendarHtml}
    ${subjectsHtml}
    ${lastSummaryHtml}
  `;
}

function renderSubjectStrip() {
  const counts = new Map();
  for (const s of state.sessions) counts.set(s.subjectId, (counts.get(s.subjectId) || 0) + 1);
  if (!counts.size) {
    return `
      <section class="sheet">
        <div class="sheet-h"><h2>${esc(t("home.subjectsTitle"))}</h2></div>
        <div class="empty">${esc(t("home.subjectsEmpty"))}</div>
      </section>
    `;
  }
  const total = state.sessions.length || 1;
  const entries = [...counts.entries()]
    .map(([id, n]) => ({ subj: subjectById(id), n }))
    .filter(e => e.subj && !e.subj.archived)
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);
  return `
    <section class="sheet">
      <div class="sheet-h">
        <h2>${esc(t("home.subjectsTitle"))}</h2>
        <span class="muted small">${esc(t("home.subjectsSub"))}</span>
      </div>
      <div class="sheet-b" style="display:grid;gap:10px">
        ${entries.map(e => `
          <div class="subrow">
            <span class="chip chip-${e.subj.color}">${esc(e.subj.name)}</span>
            <div class="subbar"><i class="swatch-${e.subj.color}" style="width:${Math.round((e.n / total) * 100)}%"></i></div>
            <span class="small muted">${e.n}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderLastSummary() {
  const last = [...state.sessions].sort((a, b) => b.startedAt - a.startedAt)[0];
  if (!last) return "";
  const subj = subjectById(last.subjectId);
  const d = last.date ? fmt(parse(last.date), locale(), true) : "";
  const time = last.startedAt ? fmtTime(last.startedAt, locale()) : "";
  return `
    <section class="sheet">
      <div class="sheet-h">
        <h2>${esc(t("home.lastSessionTitle"))}</h2>
        <span class="chip chip-${subj.color} sm">${esc(subj.name)}</span>
      </div>
      <div class="sheet-b">
        <div class="small muted" style="margin-bottom:6px">${esc(d)} · ${esc(time)}</div>
        <div class="sum-body">${esc(last.summary)}</div>
      </div>
    </section>
  `;
}
