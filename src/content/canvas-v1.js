// Hidden pixel-art canvas v1 — redesigned for the 7-row × 24-column date calendar.
// Rows are days-of-week (Mon=0 .. Sun=6), columns are weeks.
// The subject is deliberately unnamed in UI copy. Peek below if you want to spoil it.

const COLS = 24;
const ROWS = 7;

// prettier-ignore
const ART = [
  "..............####......",  // Mon
  ".............######.....",  // Tue
  "....#.......########....",  // Wed
  "...###.....##########...",  // Thu
  "..#####...#####..#####..",  // Fri
  ".#######...............#",  // Sat
  "########################"   // Sun — horizon line
];

function buildMask() {
  const mask = new Uint8Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) {
    const row = ART[r] || "";
    for (let c = 0; c < COLS; c++) {
      mask[r * COLS + c] = row[c] === "#" ? 1 : 0;
    }
  }
  return mask;
}

export const canvas = {
  id: "v1-default",
  cols: COLS,
  rows: ROWS,
  total: COLS * ROWS,
  mask: buildMask()
};
