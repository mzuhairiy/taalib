import { state, subjectColors, addSubject, updateSubject } from "../save.js";
import { t, locale } from "../i18n.js";
import { esc, ymd, today, parse, addDays, fmt, fmtTime, diffDays } from "../utils.js";

const SPARK_DAYS = 30;

export function renderTopics() {
  const live = state.subjects.filter(s => !s.archived);
  const archived = state.subjects.filter(s => s.archived);

  if (!live.length && !archived.length) {
    return `
      <section class="sheet">
        <div class="sheet-h"><h2>${esc(t("topics.title"))}</h2></div>
        <div class="empty">${esc(t("topics.empty"))}</div>
      </section>
    `;
  }

  return `
    <section class="sheet">
      <div class="sheet-h">
        <h2>${esc(t("topics.title"))}</h2>
        <button class="btn sm" data-act="topics-add-toggle">${esc(t("topics.add"))}</button>
      </div>
      <div class="sheet-b" style="padding-top:4px"><p class="muted small" style="margin:0">${esc(t("topics.sub"))}</p></div>
      <div class="sheet-b" id="topics-addform" style="padding-top:0;display:none">
        <div class="newsub">
          <input type="text" id="topics-newname" placeholder="${esc(t("topics.addPrompt"))}" maxlength="60" autocomplete="off" />
          <div class="colorrow" id="topics-newcolor">
            ${subjectColors().map((c, i) => `<button class="colordot swatch-${c} ${i === 0 ? "active" : ""}" data-newcolor="${c}" aria-label="${c}"></button>`).join("")}
          </div>
          <div class="btnrow" style="justify-content:flex-end;gap:8px">
            <button class="btn ghost sm" data-act="topics-add-cancel">${esc(t("modal.summary.cancel"))}</button>
            <button class="btn primary sm" data-act="topics-add-save">${esc(t("topics.add").replace("+ ", ""))}</button>
          </div>
        </div>
      </div>
      <div class="sheet-b flush" id="topics-live">${live.map(topicCard).join("") || `<div class="empty">${esc(t("topics.empty"))}</div>`}</div>
      ${archived.length ? `
        <div class="sheet-b" style="padding-top:0"><h3 class="muted small" style="margin:14px 0 0">${esc(t("topics.archivedTitle"))}</h3></div>
        <div class="sheet-b flush" id="topics-archived">${archived.map(topicCard).join("")}</div>
      ` : ""}
    </section>
  `;
}

function topicCard(subj) {
  const loc = locale();
  const sessions = state.sessions.filter(s => s.subjectId === subj.id);
  const sessionCount = sessions.length;
  // last active
  const latest = sessions.reduce((acc, s) => (s.startedAt > acc ? s.startedAt : acc), 0);
  const lastActiveLabel = latest
    ? fmt(new Date(latest), loc, true)
    : "—";

  const spark = renderSparkline(sessions);
  const archiveBtn = subj.archived
    ? `<button class="btn ghost sm" data-topic-arc="${esc(subj.id)}" data-set="false">${esc(t("topics.restore"))}</button>`
    : `<button class="btn ghost sm" data-topic-arc="${esc(subj.id)}" data-set="true">${esc(t("topics.archive"))}</button>`;

  const summaries = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 10);

  return `
    <article class="topic-card" data-topic-id="${esc(subj.id)}">
      <header class="topic-h">
        <div class="topic-id">
          <span class="chip chip-${subj.color} sm">${esc(subj.name)}</span>
          <span class="small muted">${esc(t("topics.sessionsCount", sessionCount))}</span>
        </div>
        <div class="topic-colors">
          ${subjectColors().map(c => `<button class="colordot swatch-${c} ${c === subj.color ? "active" : ""}" data-topic-color="${esc(subj.id)}" data-color="${c}" aria-label="${c}"></button>`).join("")}
        </div>
      </header>
      <div class="topic-row">
        <input type="text" class="topic-name" data-topic-name="${esc(subj.id)}" value="${esc(subj.name)}" maxlength="60" />
        ${archiveBtn}
        <button class="btn ghost sm danger" data-act="topic-delete" data-id="${esc(subj.id)}">${esc(t("topics.delete"))}</button>
      </div>
      <div class="topic-spark">
        <div class="small muted spark-label">${esc(t("topics.last30"))}</div>
        ${spark}
      </div>
      <div class="topic-meta small muted">${esc(t("topics.lastActive"))}: ${esc(lastActiveLabel)}</div>
      ${sessionCount ? `
        <details class="topic-sums">
          <summary class="small"><span class="open-label">${esc(t("topics.showSummaries"))}</span><span class="close-label">${esc(t("topics.hideSummaries"))}</span></summary>
          <div class="topic-sumlist">
            ${summaries.map(s => `
              <div class="topic-sum">
                <div class="small muted">${esc(fmt(parse(s.date), loc, true))} · ${esc(fmtTime(s.startedAt, loc))}</div>
                <div class="sum-body">${esc(s.summary)}</div>
              </div>
            `).join("")}
            ${sessions.length > summaries.length ? `<div class="small muted" style="padding:8px 0">+${sessions.length - summaries.length}</div>` : ""}
          </div>
        </details>
      ` : `<div class="small muted">${esc(t("topics.noSummaries"))}</div>`}
    </article>
  `;
}

function renderSparkline(sessions) {
  const now = today();
  const buckets = new Array(SPARK_DAYS).fill(0);
  for (const s of sessions) {
    const d = parse(s.date);
    const offset = diffDays(d, now);
    if (offset >= 0 && offset < SPARK_DAYS) {
      // index 0 = oldest in window, SPARK_DAYS-1 = today
      buckets[SPARK_DAYS - 1 - offset] += 1;
    }
  }
  const max = Math.max(1, ...buckets);
  const w = 220, h = 36, barGap = 2;
  const barW = (w - (SPARK_DAYS - 1) * barGap) / SPARK_DAYS;
  let rects = "";
  for (let i = 0; i < SPARK_DAYS; i++) {
    const v = buckets[i];
    const bh = v === 0 ? 2 : Math.max(2, Math.round((v / max) * (h - 2)));
    const x = i * (barW + barGap);
    const y = h - bh;
    const cls = v > 0 ? "spark-bar on" : "spark-bar off";
    rects += `<rect class="${cls}" x="${x}" y="${y}" width="${barW}" height="${bh}" rx="1"/>`;
  }
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${rects}</svg>`;
}

export function wireTopics(root, onChange) {
  // add — toggle inline form
  const addForm = root.querySelector("#topics-addform");
  const addToggle = root.querySelector('[data-act="topics-add-toggle"]');
  const nameInput = root.querySelector("#topics-newname");
  const colorRow = root.querySelector("#topics-newcolor");
  let newColor = subjectColors()[0];

  if (addToggle && addForm) {
    addToggle.addEventListener("click", () => {
      const open = addForm.style.display !== "none";
      addForm.style.display = open ? "none" : "block";
      if (!open) setTimeout(() => nameInput?.focus(), 20);
    });
  }
  if (colorRow) {
    colorRow.addEventListener("click", (e) => {
      const b = e.target.closest("[data-newcolor]");
      if (!b) return;
      newColor = b.dataset.newcolor;
      colorRow.querySelectorAll("[data-newcolor]").forEach(x => x.classList.toggle("active", x.dataset.newcolor === newColor));
    });
  }
  const cancelBtn = root.querySelector('[data-act="topics-add-cancel"]');
  const saveBtn = root.querySelector('[data-act="topics-add-save"]');
  if (cancelBtn) cancelBtn.addEventListener("click", () => {
    if (addForm) addForm.style.display = "none";
    if (nameInput) nameInput.value = "";
  });
  const submit = () => {
    const n = (nameInput?.value || "").trim();
    if (!n) { nameInput?.focus(); return; }
    addSubject(n, newColor);
    onChange();
  };
  if (saveBtn) saveBtn.addEventListener("click", submit);
  if (nameInput) nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });

  // name rename on blur
  root.querySelectorAll("[data-topic-name]").forEach(input => {
    const id = input.dataset.topicName;
    const original = input.value;
    input.addEventListener("blur", () => {
      const v = input.value.trim();
      if (v && v !== original) {
        updateSubject(id, { name: v });
        onChange();
      }
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
  });

  // color change
  root.querySelectorAll("[data-topic-color]").forEach(btn => {
    btn.addEventListener("click", () => {
      updateSubject(btn.dataset.topicColor, { color: btn.dataset.color });
      onChange();
    });
  });

  // archive toggle
  root.querySelectorAll("[data-topic-arc]").forEach(btn => {
    btn.addEventListener("click", () => {
      updateSubject(btn.dataset.topicArc, { archived: btn.dataset.set === "true" });
      onChange();
    });
  });

}
