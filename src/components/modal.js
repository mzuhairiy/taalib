import { t } from "../i18n.js";
import { esc } from "../utils.js";
import { state, liveSubjects, addSubject, subjectColors } from "../save.js";

let modalEl, panelEl;
let currentConfig = null;

export function initModal() {
  modalEl = document.getElementById("modal");
  panelEl = document.getElementById("panel");
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl && currentConfig?.dismissOnBackdrop !== false) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalEl.classList.contains("hidden")) close();
  });
}

export function openSummary({ onSave, onCancel }) {
  currentConfig = { dismissOnBackdrop: false };
  const subjects = liveSubjects();
  const colors = subjectColors();
  const defaultSubjectId = subjects[0].id;
  // state kept locally inside this modal
  let selectedSubjectId = defaultSubjectId;
  let creatingNew = false;
  let newColor = colors[0];

  function render() {
    panelEl.innerHTML = `
      <div class="sheet-h">
        <h2>${esc(t("modal.summary.title"))}</h2>
      </div>
      <div class="sheet-b" style="display:grid;gap:14px">
        <div>
          <label class="f">${esc(t("modal.summary.subjectLabel"))}</label>
          <div class="chiprow" id="sub-row">
            ${subjects.map(s => `
              <button class="chip chip-${s.color} ${s.id === selectedSubjectId && !creatingNew ? "active" : ""}" data-sub="${esc(s.id)}">${esc(s.name)}</button>
            `).join("")}
            <button class="chip chip-plus ${creatingNew ? "active" : ""}" data-sub="__new">+ ${esc(t("modal.summary.newSubject"))}</button>
          </div>
          ${creatingNew ? newSubjectForm(colors, newColor) : ""}
        </div>
        <div>
          <label class="f" for="sumtext">${esc(t("modal.summary.sub"))}</label>
          <textarea id="sumtext" placeholder="${esc(t("modal.summary.placeholder"))}" rows="5"></textarea>
          <div class="small muted" id="sumhint" style="margin-top:6px">${esc(t("modal.summary.minHint"))}</div>
        </div>
        <div class="btnrow" style="justify-content:flex-end;gap:10px">
          <button class="btn ghost" data-act="sum-cancel">${esc(t("modal.summary.cancel"))}</button>
          <button class="btn primary" id="sumsave" disabled>${esc(t("modal.summary.save"))}</button>
        </div>
      </div>
    `;
    wire();
  }

  function newSubjectForm(colors, chosen) {
    return `
      <div class="newsub">
        <input type="text" id="newsubname" placeholder="${esc(t("modal.summary.newSubjectPh"))}" maxlength="60" autocomplete="off" />
        <div class="colorrow">
          ${colors.map(c => `<button class="colordot swatch-${c} ${c === chosen ? "active" : ""}" data-color="${c}" aria-label="${c}"></button>`).join("")}
        </div>
      </div>
    `;
  }

  function wire() {
    panelEl.querySelectorAll("[data-sub]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.sub;
        if (id === "__new") {
          creatingNew = !creatingNew;
          render();
          setTimeout(() => panelEl.querySelector("#newsubname")?.focus(), 20);
        } else {
          selectedSubjectId = id;
          creatingNew = false;
          render();
          panelEl.querySelector("#sumtext")?.focus();
        }
      });
    });
    panelEl.querySelectorAll("[data-color]").forEach(btn => {
      btn.addEventListener("click", () => {
        newColor = btn.dataset.color;
        panelEl.querySelectorAll("[data-color]").forEach(b => b.classList.toggle("active", b.dataset.color === newColor));
      });
    });
    const ta = panelEl.querySelector("#sumtext");
    const btn = panelEl.querySelector("#sumsave");
    const hint = panelEl.querySelector("#sumhint");
    ta.addEventListener("input", () => {
      const n = ta.value.trim().length;
      btn.disabled = n < 20;
      hint.textContent = n < 20 ? `${t("modal.summary.minHint")} (${n}/20)` : "";
    });
    btn.addEventListener("click", () => {
      const v = ta.value.trim();
      if (v.length < 20) return;
      let finalSubjectId = selectedSubjectId;
      if (creatingNew) {
        const nameInput = panelEl.querySelector("#newsubname");
        const name = (nameInput?.value || "").trim();
        if (!name) { nameInput?.focus(); return; }
        const subj = addSubject(name, newColor);
        if (subj) finalSubjectId = subj.id;
      }
      close();
      onSave && onSave(v, finalSubjectId);
    });
    panelEl.querySelector('[data-act="sum-cancel"]').addEventListener("click", () => {
      close();
      onCancel && onCancel();
    });
    setTimeout(() => ta.focus(), 30);
  }

  modalEl.classList.remove("hidden");
  render();
}

export function openSummaryEdit({ session, onSave, onCancel }) {
  currentConfig = { dismissOnBackdrop: false };
  const initialTitle = String(session.title || "");
  const initialBody = String(session.summary || "");

  panelEl.innerHTML = `
    <div class="sheet-h"><h2>${esc(t("review.editTitle"))}</h2></div>
    <div class="sheet-b" style="display:grid;gap:14px">
      <div>
        <label class="f" for="edit-title">${esc(t("review.titleLabel"))}</label>
        <input type="text" id="edit-title" maxlength="120" placeholder="${esc(t("review.titlePh"))}" value="${esc(initialTitle)}" autocomplete="off" />
      </div>
      <div>
        <label class="f" for="edit-body">${esc(t("review.bodyLabel"))}</label>
        <textarea id="edit-body" rows="6">${esc(initialBody)}</textarea>
        <div class="small muted" id="edit-hint" style="margin-top:6px"></div>
      </div>
      <div class="btnrow" style="justify-content:flex-end;gap:10px">
        <button class="btn ghost" data-act="edit-cancel">${esc(t("modal.summary.cancel"))}</button>
        <button class="btn primary" id="edit-save">${esc(t("review.save"))}</button>
      </div>
    </div>
  `;
  modalEl.classList.remove("hidden");

  const titleInput = panelEl.querySelector("#edit-title");
  const bodyInput = panelEl.querySelector("#edit-body");
  const saveBtn = panelEl.querySelector("#edit-save");
  const hint = panelEl.querySelector("#edit-hint");

  function sync() {
    const n = bodyInput.value.trim().length;
    saveBtn.disabled = n < 20;
    hint.textContent = n < 20 ? `${t("modal.summary.minHint")} (${n}/20)` : "";
  }
  bodyInput.addEventListener("input", sync);
  sync();

  saveBtn.addEventListener("click", () => {
    const b = bodyInput.value.trim();
    if (b.length < 20) return;
    const tt = titleInput.value.trim().slice(0, 120);
    close();
    onSave && onSave({ title: tt, summary: b });
  });
  panelEl.querySelector('[data-act="edit-cancel"]').addEventListener("click", () => {
    close();
    onCancel && onCancel();
  });
  setTimeout(() => (initialTitle ? bodyInput : titleInput).focus(), 30);
}

export function openConfirm({ title, body, okLabel, cancelLabel, danger = false, onOk, onCancel }) {
  currentConfig = { dismissOnBackdrop: true };
  panelEl.innerHTML = `
    <div class="sheet-h"><h2>${esc(title)}</h2></div>
    <div class="sheet-b">
      <p>${esc(body)}</p>
      <div class="btnrow" style="margin-top:14px;justify-content:flex-end;gap:10px">
        <button class="btn ghost" data-act="cfm-no">${esc(cancelLabel)}</button>
        <button class="btn ${danger ? "danger" : "primary"}" data-act="cfm-ok">${esc(okLabel)}</button>
      </div>
    </div>
  `;
  modalEl.classList.remove("hidden");
  panelEl.querySelector('[data-act="cfm-ok"]').addEventListener("click", () => { close(); onOk && onOk(); });
  panelEl.querySelector('[data-act="cfm-no"]').addEventListener("click", () => { close(); onCancel && onCancel(); });
}

export function close() {
  modalEl.classList.add("hidden");
  panelEl.innerHTML = "";
  currentConfig = null;
}
