import { state } from "../save.js";
import { t } from "../i18n.js";
import { affirmations } from "../content/affirmations.js";
import { aspirations } from "../content/aspirations.js";
import { scripture } from "../content/scripture.js";
import { esc } from "../utils.js";

export function scriptureCard(idx, { compact = false } = {}) {
  const s = scripture[((idx % scripture.length) + scripture.length) % scripture.length];
  const lang = state.lang;
  const typeLabel = t(`scripture.type.${s.type}`);
  const grading = s.grading ? `<span class="badge ok">${t(`scripture.grading.${s.grading}`)}</span>` : "";
  const src = esc(s.source[lang] || s.source.ref || "");
  const translation = esc(s[lang] || s.id || "");
  return `
    <div class="scrip-card ${compact ? "compact" : ""}">
      <div class="ar" dir="rtl" lang="ar">${esc(s.ar)}</div>
      <div class="tr">${translation}</div>
      <div class="src">
        <span class="badge">${esc(typeLabel)}</span>
        ${grading}
        <span>${src}</span>
      </div>
    </div>
  `;
}

export function motivationLine({ kind, idx, phase, big = false }) {
  const pool = kind === "aspiration" ? aspirations : affirmations;
  const n = ((idx % pool.length) + pool.length) % pool.length;
  const entry = pool[n] || pool[0];
  const text = (entry[phase] && entry[phase][state.lang]) || entry[phase]?.id || "";
  const tagKey = kind === "aspiration" ? "motivation.aspiration" : "motivation.grounded";
  const tag = t(tagKey);
  return `
    <div class="motiv ${big ? "big" : ""} ${kind}">
      <span class="motiv-tag">${esc(tag)}</span>
      <div class="motiv-text">${esc(text)}</div>
    </div>
  `;
}

export function renderBanner({ phase, motivationKind, motivationIdx, scriptureIdx }) {
  const kick = t(`banner.${phase}.kick`);
  const ctaLabel = t(`banner.${phase}.cta`);
  const dataAct = phase === "pre" ? "banner-pre-go" : "banner-post-close";
  const cancel = phase === "pre"
    ? `<button class="btn ghost block" data-act="banner-pre-cancel">${esc(t("banner.pre.cancel"))}</button>`
    : "";
  return `
    <div class="banner-mask" id="banner">
      <div class="banner">
        <div class="kick">${esc(kick)}</div>
        ${motivationLine({ kind: motivationKind, idx: motivationIdx, phase, big: true })}
        ${scriptureCard(scriptureIdx)}
        <div class="cta">
          <button class="btn primary lg block" data-act="${dataAct}">${esc(ctaLabel)}</button>
          ${cancel}
        </div>
      </div>
    </div>
  `;
}
