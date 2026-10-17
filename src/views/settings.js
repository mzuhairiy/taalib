import { state } from "../save.js";
import { t } from "../i18n.js";
import { esc } from "../utils.js";
import * as sync from "../sync.js";

export function renderSettings({ syncUser = null, syncStatus = "idle", lastSentEmail = "" } = {}) {
  const themeOpt = (val, label) =>
    `<option value="${val}" ${state.theme === val ? "selected" : ""}>${esc(label)}</option>`;
  const langOpt = (val, label) =>
    `<option value="${val}" ${state.lang === val ? "selected" : ""}>${esc(label)}</option>`;

  const syncHtml = renderSyncSection({ syncUser, syncStatus, lastSentEmail });

  return `
    <section class="sheet">
      <div class="sheet-h"><h2>${esc(t("settings.title"))}</h2></div>
      <div class="sheet-b" style="display:grid;gap:16px">
        <div>
          <label class="f" for="set-lang">${esc(t("settings.lang.label"))}</label>
          <select id="set-lang" data-act="set-lang">
            ${langOpt("id", "Bahasa Indonesia")}
            ${langOpt("en", "English")}
          </select>
        </div>
        <div>
          <label class="f" for="set-theme">${esc(t("settings.theme.label"))}</label>
          <select id="set-theme" data-act="set-theme">
            ${themeOpt("auto", t("settings.theme.auto"))}
            ${themeOpt("light", t("settings.theme.light"))}
            ${themeOpt("dark", t("settings.theme.dark"))}
          </select>
        </div>
      </div>
    </section>

    ${syncHtml}

    <section class="sheet">
      <div class="sheet-h"><h2>${esc(t("settings.export.label"))}</h2></div>
      <div class="sheet-b" style="display:grid;gap:12px">
        <div class="btnrow">
          <button class="btn primary" data-act="export">${esc(t("settings.export.btn"))}</button>
          <button class="btn ghost" data-act="import-pick">${esc(t("settings.import.btn"))}</button>
        </div>
        <div class="small muted">${esc(t("settings.import.hint"))}</div>
        <input type="file" id="import-file" accept="application/json" hidden />
      </div>
    </section>

    <section class="sheet">
      <div class="sheet-h"><h2>${esc(t("settings.reset.label"))}</h2></div>
      <div class="sheet-b">
        <button class="btn danger" data-act="reset">${esc(t("settings.reset.btn"))}</button>
      </div>
    </section>

    <section class="sheet">
      <div class="sheet-h"><h2>${esc(t("settings.about.label"))}</h2></div>
      <div class="sheet-b"><p class="muted small" style="margin:0">${esc(t("settings.about.body"))}</p></div>
    </section>
  `;
}

function renderSyncSection({ syncUser, syncStatus, lastSentEmail }) {
  const statusLabel = syncUser
    ? t(`sync.status.${syncStatus}`)
    : t("sync.status.anon");
  const statusCls = syncUser ? `sync-pill sync-${syncStatus}` : "sync-pill sync-anon";

  if (!sync.syncAvailable) {
    return `
      <section class="sheet">
        <div class="sheet-h"><h2>${esc(t("sync.title"))}</h2></div>
        <div class="sheet-b">
          <p class="muted small" style="margin:0">${esc(t("sync.notConfigured"))}</p>
        </div>
      </section>
    `;
  }

  if (!syncUser) {
    const sent = lastSentEmail
      ? `<p class="small" style="margin:8px 0 0;color:var(--ok);font-weight:600">${esc(t("sync.sent"))}</p>`
      : "";
    return `
      <section class="sheet">
        <div class="sheet-h">
          <h2>${esc(t("sync.title"))}</h2>
          <span class="${statusCls}">${esc(statusLabel)}</span>
        </div>
        <div class="sheet-b" style="display:grid;gap:12px">
          <p class="muted small" style="margin:0">${esc(t("sync.signedOutHint"))}</p>
          <div class="syncform">
            <input type="email" id="sync-email" placeholder="${esc(t("sync.emailPh"))}" autocomplete="email" value="${esc(lastSentEmail || "")}" />
            <button class="btn primary" data-act="sync-signin">${esc(t("sync.sendLink"))}</button>
          </div>
          ${sent}
        </div>
      </section>
    `;
  }

  return `
    <section class="sheet">
      <div class="sheet-h">
        <h2>${esc(t("sync.title"))}</h2>
        <span class="${statusCls}">${esc(statusLabel)}</span>
      </div>
      <div class="sheet-b" style="display:grid;gap:12px">
        <div>
          <div class="small muted">${esc(t("sync.signedInAs"))}</div>
          <div style="font-weight:650">${esc(syncUser.email || syncUser.id)}</div>
        </div>
        <div class="btnrow">
          <button class="btn ghost" data-act="sync-push-now">${esc(t("sync.pushNow"))}</button>
          <button class="btn ghost" data-act="sync-signout">${esc(t("sync.signOut"))}</button>
        </div>
      </div>
    </section>
  `;
}
