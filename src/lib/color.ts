function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/**
 * Picks a readable text color (near-black or white) for a given hex background,
 * using the real WCAG relative-luminance contrast formula (compares the actual
 * contrast ratio against both white and black, picks whichever wins). This
 * matters for real brand colors like Spotify's #1DB954: a naive brightness
 * heuristic picks white, but black text is the one that's actually readable
 * there (and is what Spotify itself uses). Falls back to white for anything
 * that isn't a valid 6-digit hex.
 */
export function getReadableTextColor(hex: string): "#0f172a" | "#ffffff" {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return "#ffffff";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = relativeLuminance(r, g, b);
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  return contrastWithBlack > contrastWithWhite ? "#0f172a" : "#ffffff";
}
