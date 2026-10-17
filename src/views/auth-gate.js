import { t } from "../i18n.js";
import { esc } from "../utils.js";

export function renderAuthGate({ lastSentEmail = "", notConfigured = false, loading = false } = {}) {
  if (notConfigured) {
    return `
      <section class="sheet auth-gate">
        <div class="sheet-h"><h2>Taalib</h2></div>
        <div class="sheet-b"><p class="muted small" style="margin:0">${esc(t("sync.notConfigured"))}</p></div>
      </section>
    `;
  }

  if (loading) {
    return `
      <section class="sheet auth-gate">
        <div class="sheet-h"><h2>Taalib</h2></div>
        <div class="sheet-b"><p class="muted small" style="margin:0">${esc(t("auth.gate.loading"))}</p></div>
      </section>
    `;
  }

  const sent = lastSentEmail
    ? `<p class="small" style="margin:8px 0 0;color:var(--ok);font-weight:600">${esc(t("sync.sent"))}</p>`
    : "";

  return `
    <section class="sheet auth-gate">
      <div class="sheet-h"><h2>${esc(t("auth.gate.title"))}</h2></div>
      <div class="sheet-b" style="display:grid;gap:12px">
        <p class="muted small" style="margin:0">${esc(t("auth.gate.body"))}</p>
        <div class="syncform">
          <input type="email" id="sync-email" placeholder="${esc(t("sync.emailPh"))}" autocomplete="email" value="${esc(lastSentEmail || "")}" />
          <button class="btn primary" data-act="sync-signin">${esc(t("sync.sendLink"))}</button>
        </div>
        ${sent}
        <p class="muted small" style="margin:4px 0 0">${esc(t("sync.codeHint"))}</p>
        <div class="syncform">
          <input type="text" id="sync-code" inputmode="numeric" autocomplete="one-time-code" placeholder="${esc(t("sync.codePh"))}" />
          <button class="btn ghost" data-act="sync-verify-code">${esc(t("sync.verifyCode"))}</button>
        </div>
      </div>
    </section>
  `;
}
