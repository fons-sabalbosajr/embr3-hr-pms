// Shared tag color utility for section/unit/designation labels across the app.
// Provides a stable color assignment for any string value using a fixed palette.

export const TAG_COLOR_PALETTE = [
  "blue",
  "green",
  "geekblue",
  "purple",
  "magenta",
  "gold",
  "cyan",
  "volcano",
  "lime",
  "orange",
];

// Simple deterministic hash for strings, returning a non-negative 32-bit integer
export function hashString(input = "") {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // convert to 32-bit int
  }
  return Math.abs(hash);
}

// Pick a color from the palette based on the string value
export function pickTagColor(value) {
  if (!value) return "default";
  const idx = hashString(String(value)) % TAG_COLOR_PALETTE.length;
  return TAG_COLOR_PALETTE[idx];
}

// Optionally build a map from a list of names to colors (useful when you have an ordered options list)
export function buildColorMapFromList(list = []) {
  const map = {};
  list.forEach((name, idx) => {
    map[name] = TAG_COLOR_PALETTE[idx % TAG_COLOR_PALETTE.length];
  });
  return map;
}
