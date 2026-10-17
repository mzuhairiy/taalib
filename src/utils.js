export const pad = n => String(n).padStart(2, "0");
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = s => {
  const p = String(s || "").split("-").map(Number);
  return new Date(p[0] || 2026, (p[1] || 1) - 1, p[2] || 1);
};
export const today = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** RFC4122 v4 UUID — required for Postgres `uuid` columns (subjects.id, sessions.id). */
export function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmt = (d, locale = "id-ID", y = true) =>
  d.toLocaleDateString(locale, y ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
export const fmtTime = (ts, locale = "id-ID") =>
  new Date(ts).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

export const addDays = (d, n) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
};
export const diffDays = (a, b) => {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
};
// Monday=0, Sunday=6 (ISO)
export const dayIdxMon = d => (d.getDay() + 6) % 7;
export const weekMonday = d => addDays(d, -dayIdxMon(d));
export const monthShort = (d, locale = "id-ID") =>
  d.toLocaleDateString(locale, { month: "short" });
export const dayShort = (d, locale = "id-ID") =>
  d.toLocaleDateString(locale, { weekday: "short" });

export function deriveTitle(summary, max = 60) {
  const line = String(summary || "").split(/\r?\n/).map(s => s.trim()).find(Boolean) || "";
  if (line.length <= max) return line;
  return line.slice(0, max - 1).trimEnd() + "…";
}

export const escapeRegex = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function highlight(text, query) {
  const safe = esc(text);
  const q = String(query || "").trim();
  if (!q) return safe;
  const re = new RegExp(escapeRegex(esc(q)), "gi");
  return safe.replace(re, m => `<mark>${m}</mark>`);
}
