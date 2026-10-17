import "./style.css";
import { registerSW } from "virtual:pwa-register";
import {
  state, save, resetAccountData, exportJSON, importJSON, markSeen,
  onAfterSave, hydrate, addSession,
  updateSession, deleteSession
} from "./save.js";
import { migrateLegacyIfNeeded } from "./migrate-legacy.js";
import { t } from "./i18n.js";
import { ymd, today, uid } from "./utils.js";
import * as sync from "./sync.js";
import { renderHome, pickHomeReminderPick, pickCanvasCopyIdx } from "./views/home.js";
import {
  renderReview, setSearch, setFilterSubject,
  openTopic, openSummaryDetail, goBack, reconcileAfterDelete
} from "./views/review.js";
import { renderSettings } from "./views/settings.js";
import { renderTopics, wireTopics } from "./views/topics.js";
import { renderAuthGate } from "./views/auth-gate.js";
import { renderBanner } from "./components/banner.js";
import { initModal, openSummary, openSummaryEdit, openConfirm } from "./components/modal.js";
import { affirmations } from "./content/affirmations.js";
import { aspirations } from "./content/aspirations.js";
import { scripture } from "./content/scripture.js";

registerSW({ immediate: true });

let currentTab = "home";
let animateDate = null; // triggers pop on that date cell during next render
let homeReminderPick = null;
let canvasCopyIdx = null;
let lastSyncSentEmail = "";

const appEl = document.getElementById("app");
const viewEl = document.getElementById("view");
const subEl = document.getElementById("h-sub");
const langLabelEl = document.getElementById("h-lang");
const themeLabelEl = document.getElementById("h-theme");
const tabsBtns = document.querySelectorAll('nav.tabs button[data-tab]');
let toastTimer = 0;

function applyTheme() {
  const root = document.documentElement;
  if (state.theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", state.theme);
  themeLabelEl.textContent = state.theme === "dark" ? "●" : state.theme === "light" ? "○" : "◐";
}
function applyLang() {
  document.documentElement.setAttribute("lang", state.lang);
  langLabelEl.textContent = state.lang.toUpperCase();
  subEl.textContent = t("app.sub");
  for (const b of tabsBtns) {
    const key = b.dataset.k;
    b.textContent = t(`tab.${key}`);
  }
}

function setTab(tab) {
  currentTab = tab;
  for (const b of tabsBtns) b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  render();
}

function render() {
  const nextAnimate = animateDate;
  animateDate = null;
  if (currentTab === "home") {
    if (!homeReminderPick) homeReminderPick = pickHomeReminderPick();
    if (canvasCopyIdx == null) canvasCopyIdx = pickCanvasCopyIdx();
    viewEl.innerHTML = renderHome({ animateDate: nextAnimate, reminder: homeReminderPick, canvasCopyIdx });
  } else if (currentTab === "review") {
    viewEl.innerHTML = renderReview();
    wireReview();
  } else if (currentTab === "topics") {
    viewEl.innerHTML = renderTopics();
    wireTopics(viewEl, () => render());
  } else if (currentTab === "settings") {
    viewEl.innerHTML = renderSettings({ syncUser: currentUser, syncStatus, lastSentEmail: lastSyncSentEmail });
    wireSettings();
  }
}

function wireReview() {
  const inp = viewEl.querySelector("#sum-search");
  if (inp) {
    // Full re-render on search so grouped results + chip counts stay in sync.
    // Preserve caret and focus by rebinding after each render.
    inp.addEventListener("input", (e) => {
      setSearch(e.target.value);
      render();
      const next = viewEl.querySelector("#sum-search");
      if (next) {
        next.focus();
        // Place caret at end.
        const v = next.value;
        next.setSelectionRange(v.length, v.length);
      }
    });
  }
  viewEl.querySelectorAll("[data-filter-sub]").forEach(btn => {
    btn.addEventListener("click", () => {
      setFilterSubject(btn.dataset.filterSub);
      render();
    });
  });
}

function wireSettings() {
  const langSel = viewEl.querySelector("#set-lang");
  const themeSel = viewEl.querySelector("#set-theme");
  const fileInp = viewEl.querySelector("#import-file");
  if (langSel) langSel.addEventListener("change", (e) => { state.lang = e.target.value; save(); applyLang(); render(); });
  if (themeSel) themeSel.addEventListener("change", (e) => { state.theme = e.target.value; save(); applyTheme(); });
  if (fileInp) fileInp.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await importJSON(String(reader.result || ""));
        toast(t("toast.imported"));
        applyLang(); applyTheme(); render();
      } catch { toast(t("toast.importFailed")); }
    };
    reader.readAsText(file);
  });
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), 2400);
}

function pickReminderIdx(kind, pool) {
  if (!pool.length) return -1;
  const seen = new Set(state.seen[kind] || []);
  const choices = pool.map((_, i) => i).filter(i => !seen.has(i));
  const pickPool = choices.length ? choices : pool.map((_, i) => i);
  return pickPool[Math.floor(Math.random() * pickPool.length)];
}

function pickMotivation(phase) {
  // 50/50 grounded vs aspirational
  const kind = Math.random() < 0.5 ? "aspiration" : "affirmation";
  const pool = kind === "aspiration" ? aspirations : affirmations;
  const seenKey = kind === "aspiration" ? "aspirations" : "affirmations";
  const idx = pickReminderIdx(seenKey, pool);
  markSeen(seenKey, idx);
  return { kind, idx, seenKey };
}

/* ============== SESSION FLOW ============== */

function startSession() {
  if (state.activeSession) { showPreBanner(); return; }
  const motiv = pickMotivation("pre");
  const scrIdx = pickReminderIdx("scripture", scripture);
  state.activeSession = {
    id: uid(),
    startedAt: Date.now(),
    motivationKind: motiv.kind,
    motivationIdx: motiv.idx,
    scriptureIdx: scrIdx
  };
  markSeen("scripture", scrIdx);
  save();
  showPreBanner();
}

function showPreBanner() {
  const s = state.activeSession;
  if (!s) return;
  mountBanner(renderBanner({
    phase: "pre",
    motivationKind: s.motivationKind,
    motivationIdx: s.motivationIdx,
    scriptureIdx: s.scriptureIdx
  }));
}

function dismissPreBanner({ cancel }) {
  removeBanner();
  if (cancel) {
    state.activeSession = null;
    save();
    toast(t("toast.sessionCancelled"));
  } else {
    toast(t("toast.sessionStarted"));
    try { if (navigator.vibrate) navigator.vibrate(12); } catch {}
  }
  render();
}

function finishSession() {
  if (!state.activeSession) return;
  openSummary({
    onSave: (summary, subjectId) => completeSession(summary, subjectId),
    onCancel: () => {}
  });
}

function completeSession(summary, subjectId) {
  const live = state.activeSession;
  if (!live) return;
  const now = Date.now();
  const dateY = ymd(today());
  const wasFirstEver = state.sessions.length === 0;
  addSession({ summary, subjectId, startedAt: live.startedAt, finishedAt: now, date: dateY });
  state.activeSession = null;
  // Also update canvas startDate if this is the first session ever
  if (wasFirstEver) state.canvas.startDate = dateY;
  save();
  animateDate = dateY;
  toast(t("toast.sessionSaved"));
  try { if (navigator.vibrate) navigator.vibrate([10, 40, 20]); } catch {}
  confetti();
  // Fresh post-session reminder (different mix)
  const motiv = pickMotivation("post");
  const scrIdx = pickReminderIdx("scripture", scripture);
  markSeen("scripture", scrIdx);
  save();
  render();
  mountBanner(renderBanner({
    phase: "post",
    motivationKind: motiv.kind,
    motivationIdx: motiv.idx,
    scriptureIdx: scrIdx
  }));
}

function cancelSessionConfirm() {
  openConfirm({
    title: t("modal.confirm.cancelSession.title"),
    body: t("modal.confirm.cancelSession.body"),
    okLabel: t("modal.confirm.cancelSession.ok"),
    cancelLabel: t("modal.confirm.cancelSession.no"),
    danger: true,
    onOk: () => {
      state.activeSession = null;
      save();
      toast(t("toast.sessionCancelled"));
      render();
    }
  });
}

function mountBanner(html) {
  removeBanner();
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  document.body.appendChild(wrap.firstElementChild);
}
function removeBanner() {
  const el = document.getElementById("banner");
  if (el) el.remove();
}

/* ===== confetti ===== */
function confetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#FF6B4A", "#FFB94A", "#4FC9A7", "#6B7CFF", "#FF78B5", "#B4D84A"];
  const wrap = document.createElement("div");
  wrap.className = "confetti";
  const N = 36;
  for (let i = 0; i < N; i++) {
    const el = document.createElement("i");
    const left = 10 + Math.random() * 80; // vw
    const x = (Math.random() - 0.5) * 80; // horizontal drift vw
    const d = 1.4 + Math.random() * 1.3; // seconds
    const delay = Math.random() * 0.25;
    el.style.left = `${left}vw`;
    el.style.top = "0";
    el.style.background = colors[i % colors.length];
    el.style.transform = `rotate(${Math.random() * 360}deg)`;
    el.style.setProperty("--x", `${x}vw`);
    el.style.setProperty("--d", `${d}s`);
    el.style.animationDelay = `${delay}s`;
    wrap.appendChild(el);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 3000);
}

/* ============== EVENT DISPATCH ============== */

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act], [data-tab]");
  if (!btn) return;
  const tab = btn.dataset.tab;
  if (tab) {
    if (appState !== "ready") return;
    setTab(tab);
    return;
  }
  const act = btn.dataset.act;
  switch (act) {
    case "toggle-lang":
      state.lang = state.lang === "id" ? "en" : "id";
      if (appState === "ready") save();
      applyLang();
      if (appState === "ready") render(); else renderGate();
      break;
    case "toggle-theme": {
      const order = ["auto", "light", "dark"];
      const i = order.indexOf(state.theme);
      state.theme = order[(i + 1) % order.length];
      if (appState === "ready") save();
      applyTheme();
      break;
    }
    case "open-settings": if (appState === "ready") setTab("settings"); break;
    case "canvas-copy-reroll": {
      // Pick a different index than current
      let next = pickCanvasCopyIdx();
      let tries = 4;
      while (next === canvasCopyIdx && tries-- > 0) next = pickCanvasCopyIdx();
      canvasCopyIdx = next;
      render();
      break;
    }
    case "session-start": startSession(); break;
    case "session-finish": finishSession(); break;
    case "session-cancel": cancelSessionConfirm(); break;
    case "rv-open-topic": {
      const id = btn.dataset.sub || "";
      if (id) { openTopic(id); render(); }
      break;
    }
    case "rv-open-sum": {
      const id = btn.dataset.sum || "";
      if (id) { openSummaryDetail(id); render(); }
      break;
    }
    case "rv-back": {
      goBack();
      render();
      break;
    }
    case "rv-edit-sum": {
      const id = btn.dataset.sum || "";
      const s = state.sessions.find(x => x.id === id);
      if (!s) return;
      openSummaryEdit({
        session: s,
        onSave: ({ title, summary }) => {
          const ok = updateSession(id, { title, summary });
          if (ok) {
            toast(t("review.updated"));
            render();
          }
        }
      });
      break;
    }
    case "rv-delete-sum": {
      const id = btn.dataset.sum || "";
      if (!id) return;
      openConfirm({
        title: t("review.deleteConfirmTitle"),
        body: t("review.deleteConfirmBody"),
        okLabel: t("review.deleteConfirmOk"),
        cancelLabel: t("review.deleteConfirmNo"),
        danger: true,
        onOk: () => {
          const ok = deleteSession(id);
          if (ok) {
            reconcileAfterDelete();
            toast(t("review.deleted"));
            render();
          }
        }
      });
      break;
    }
    case "banner-pre-go": dismissPreBanner({ cancel: false }); break;
    case "banner-pre-cancel": dismissPreBanner({ cancel: true }); break;
    case "banner-post-close": removeBanner(); break;
    case "home-reminder-shuffle": {
      let next = pickHomeReminderPick();
      let tries = 4;
      while (same(next, homeReminderPick) && tries-- > 0) next = pickHomeReminderPick();
      homeReminderPick = next;
      render();
      break;
    }
    case "export": {
      const blob = new Blob([exportJSON()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `taalib-backup-${ymd(today())}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast(t("toast.exported"));
      break;
    }
    case "import-pick": {
      const inp = viewEl.querySelector("#import-file");
      if (inp) inp.click();
      break;
    }
    case "reset": {
      openConfirm({
        title: t("modal.confirm.reset.title"),
        body: t("modal.confirm.reset.body"),
        okLabel: t("modal.confirm.reset.ok"),
        cancelLabel: t("modal.confirm.reset.no"),
        danger: true,
        onOk: async () => {
          await resetAccountData();
          homeReminderPick = null;
          applyLang(); applyTheme();
          toast(t("toast.reset"));
          setTab("home");
          syncPushDebounced();
        }
      });
      break;
    }
    case "sync-signin": {
      const emailInput = document.querySelector("#sync-email");
      const email = (emailInput?.value || "").trim();
      if (!email) { emailInput?.focus(); return; }
      sync.signInWithEmail(email)
        .then(() => { lastSyncSentEmail = email; renderCurrent(); })
        .catch((e) => { toast(e?.message || "Gagal mengirim link"); console.warn(e); });
      break;
    }
    case "sync-verify-code": {
      const emailInput = document.querySelector("#sync-email");
      const codeInput = document.querySelector("#sync-code");
      const email = (emailInput?.value || "").trim();
      const code = (codeInput?.value || "").trim();
      if (!email) { emailInput?.focus(); return; }
      if (!code) { codeInput?.focus(); return; }
      sync.verifyEmailCode(email, code)
        .then(() => { lastSyncSentEmail = ""; renderCurrent(); })
        .catch((e) => { toast(e?.message || "Kode tidak valid"); console.warn(e); });
      break;
    }
    case "sync-signout": {
      sync.signOut().then(() => { lastSyncSentEmail = ""; });
      break;
    }
    case "sync-push-now": {
      syncPushImmediate();
      break;
    }
  }
});

function same(a, b) {
  if (!a || !b) return false;
  return a.kind === b.kind && a.motivationIdx === b.motivationIdx && a.scriptureIdx === b.scriptureIdx;
}

function renderCurrent() {
  if (appState === "ready") render();
  else renderGate();
}

/* ============== AUTH GATE + SYNC ============== */
// Account is required: nothing is shown or editable until signed in.
// appState: "checking" | "not-configured" | "gate" | "loading" | "ready"
let appState = "checking";
let currentUser = null;
let syncPushTimer = null;
let syncInFlight = false;
let syncPendingAfterInFlight = false;
let syncStatus = "idle"; // "idle" | "syncing" | "error" | "offline"
let pullInterval = null;

function setSyncStatus(s) {
  syncStatus = s;
  if (currentTab === "settings" && appState === "ready") render();
}

function setAppState(next) {
  appState = next;
  appEl.classList.toggle("gated", appState !== "ready");
  if (appState === "not-configured" || appState === "gate" || appState === "loading") {
    renderGate();
  }
}

function renderGate() {
  viewEl.innerHTML = renderAuthGate({
    lastSentEmail: lastSyncSentEmail,
    notConfigured: appState === "not-configured",
    loading: appState === "loading",
  });
}

async function syncPushImmediate() {
  if (!sync.syncAvailable || !currentUser) return;
  if (syncInFlight) { syncPendingAfterInFlight = true; return; }
  syncInFlight = true;
  try {
    setSyncStatus("syncing");
    await sync.pushAll();
    setSyncStatus("idle");
  } catch (e) {
    console.warn("sync push failed", e);
    setSyncStatus("error");
  } finally {
    syncInFlight = false;
    if (syncPendingAfterInFlight) {
      syncPendingAfterInFlight = false;
      syncPushImmediate();
    }
  }
}

function syncPushDebounced() {
  if (!sync.syncAvailable || !currentUser) return;
  clearTimeout(syncPushTimer);
  syncPushTimer = setTimeout(() => { syncPushImmediate(); }, 1200);
}

async function syncPullPoll() {
  if (!sync.syncAvailable || !currentUser) return;
  try {
    const changed = await sync.pullAll();
    if (changed && appState === "ready") render();
  } catch (e) {
    console.warn("sync pull failed", e);
  }
}

function startPeriodicSync() {
  stopPeriodicSync();
  pullInterval = setInterval(syncPullPoll, 20000);
}
function stopPeriodicSync() {
  if (pullInterval) clearInterval(pullInterval);
  pullInterval = null;
}

export function currentSyncState() {
  return { user: currentUser, status: syncStatus, available: sync.syncAvailable };
}

async function handleSignedIn(user) {
  currentUser = user;
  setAppState("loading");
  try {
    await migrateLegacyIfNeeded(user.id);
    await hydrate(user.id);
    await sync.syncNow();
  } catch (e) {
    console.warn("boot hydrate/sync failed", e);
    toast(t("sync.status.error"));
  }
  applyLang();
  applyTheme();
  setAppState("ready");
  setTab("home");
  startPeriodicSync();
}

function handleSignedOut() {
  currentUser = null;
  stopPeriodicSync();
  setAppState("gate");
}

if (sync.syncAvailable) {
  onAfterSave(() => syncPushDebounced());
  sync.onAuthChange((user) => {
    const was = currentUser;
    if (user && !was) handleSignedIn(user);
    else if (!user && was !== null) handleSignedOut();
    else if (!user && appState === "checking") setAppState("gate");
  });
  window.addEventListener("online", () => { if (currentUser) { setSyncStatus("idle"); syncPushImmediate(); syncPullPoll(); } });
  window.addEventListener("offline", () => setSyncStatus("offline"));
} else {
  setAppState("not-configured");
}

/* ============== BOOT ============== */
initModal();
applyLang();
applyTheme();
