import { canvas } from "../content/canvas-v1.js";
import { state } from "../save.js";
import { parse, addDays, weekMonday, today, ymd, monthShort, dayShort } from "../utils.js";
import { locale } from "../i18n.js";

const CELL = 14;
const GAP = 3;
const STEP = CELL + GAP;
const PAD = 4;
const LEFT = 36;
const TOP = 20;

export function renderCalendarGrid({ animateDate = null } = {}) {
  const { cols, rows, mask } = canvas;
  const gridW = cols * STEP - GAP;
  const gridH = rows * STEP - GAP;
  const totalW = PAD + LEFT + gridW + PAD;
  const totalH = PAD + TOP + gridH + PAD;

  const lang = state.lang;
  const loc = locale();
  const start = weekMonday(parse(state.canvas.startDate));
  const now = today();
  const todayY = ymd(now);

  // date → session count map
  const byDate = new Map();
  for (const s of state.sessions) {
    byDate.set(s.date, (byDate.get(s.date) || 0) + 1);
  }

  // Month labels: for each column, compute its Monday date → month index
  let months = "";
  let lastMonth = -1;
  for (let c = 0; c < cols; c++) {
    const colDate = addDays(start, c * 7);
    const m = colDate.getMonth();
    if (m !== lastMonth) {
      const x = PAD + LEFT + c * STEP;
      const label = monthShort(colDate, loc);
      months += `<text x="${x}" y="${PAD + TOP - 6}" class="cal-month">${label}</text>`;
      lastMonth = m;
    }
  }

  // Day-of-week labels (short, locale-aware). Show every other row to reduce clutter.
  let days = "";
  for (let r = 0; r < rows; r++) {
    if (r % 2 === 1) continue; // show rows 0, 2, 4, 6
    const d = addDays(start, r);
    const y = PAD + TOP + r * STEP + CELL * 0.72;
    days += `<text x="${PAD + LEFT - 6}" y="${y}" class="cal-day">${dayShort(d, loc).slice(0, 3)}</text>`;
  }

  // Cells
  let rects = "";
  const dayNamesLong = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const d = addDays(start, c * 7 + r);
      const key = ymd(d);
      const inPast = d <= now;
      const count = byDate.get(key) || 0;
      const filled = count > 0;
      const isImg = !!mask[idx];
      const isToday = key === todayY;
      const classes = ["cell"];
      if (!inPast) classes.push("future");
      if (filled) {
        classes.push("filled");
        classes.push(isImg ? "img" : "bg");
      }
      if (isToday) classes.push("today");
      if (animateDate && key === animateDate) classes.push("pop");
      const x = PAD + LEFT + c * STEP;
      const y = PAD + TOP + r * STEP;
      const title = `${d.toLocaleDateString(loc, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}${count ? ` · ${count} ${lang === "en" ? "session" : "sesi"}${count > 1 && lang === "en" ? "s" : ""}` : ""}`;
      rects += `<rect class="${classes.join(" ")}" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="3"><title>${esc(title)}</title></rect>`;
    }
  }

  return `
    <div class="calwrap">
      <svg class="calgrid" viewBox="0 0 ${totalW} ${totalH}" preserveAspectRatio="xMidYMid meet" aria-hidden="false" role="img">
        ${months}
        ${days}
        ${rects}
      </svg>
    </div>
  `;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function gridTotal() { return canvas.total; }
