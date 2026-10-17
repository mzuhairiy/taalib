/**
 * Inline SVG growth illustration. `stage` 0 = empty soil, 1 = roots,
 * 2 = stem + leaves, 3 = bloom. Keep each stage visually distinct so the
 * progress is obvious at a glance.
 *
 * `kind` picks the illustration. Only "flower" ships for now; adding another
 * means a new case in the switch — the mount point in home.js doesn't change.
 */
export function renderGrowth({ kind = "flower", stage = 0 } = {}) {
  const s = Math.max(0, Math.min(3, Math.floor(stage)));
  const svg = kind === "flower" ? flowerSvg(s) : flowerSvg(s);
  return `<div class="growth growth-${kind}" data-stage="${s}" aria-hidden="true">${svg}</div>`;
}

function flowerSvg(stage) {
  // 48x48 viewBox, flat fills. Colors use CSS tokens so dark mode adapts.
  const soil = `<rect x="4" y="36" width="40" height="6" rx="2" fill="var(--growth-soil, #8a6a4a)"/>`;

  // Stage 1: roots below ground visible as thin branching lines.
  const roots = stage >= 1 ? `
    <g stroke="var(--growth-root, #6b4e34)" stroke-width="1.4" stroke-linecap="round" fill="none">
      <path d="M24 38 L24 44"/>
      <path d="M24 40 L20 44"/>
      <path d="M24 40 L28 44"/>
    </g>
  ` : "";

  // Stage 2: stem + two leaves rising above the soil.
  const stem = stage >= 2 ? `
    <path d="M24 36 L24 18" stroke="var(--growth-stem, #4FC9A7)" stroke-width="2.2" stroke-linecap="round" fill="none"/>
    <path d="M24 28 C20 26 17 26 15 29 C18 31 22 31 24 29 Z" fill="var(--growth-leaf, #4FC9A7)"/>
    <path d="M24 24 C28 22 31 22 33 25 C30 27 26 27 24 25 Z" fill="var(--growth-leaf, #4FC9A7)"/>
  ` : "";

  // Stage 3: bloom (5 petals + center).
  const bloom = stage >= 3 ? `
    <g fill="var(--growth-petal, #FF78B5)">
      <circle cx="24" cy="12" r="4"/>
      <circle cx="18" cy="15" r="4"/>
      <circle cx="30" cy="15" r="4"/>
      <circle cx="20" cy="20" r="4"/>
      <circle cx="28" cy="20" r="4"/>
    </g>
    <circle cx="24" cy="16" r="3" fill="var(--growth-center, #FFB94A)"/>
  ` : "";

  return `
    <svg viewBox="0 0 48 48" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
      ${soil}
      ${roots}
      ${stem}
      ${bloom}
    </svg>
  `;
}
