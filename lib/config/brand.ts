/**
 * Brand colour helpers (pure, no I/O). Every colour that reaches a page or the widget
 * goes through normalizeHex(), so only "#rrggbb" values can ever be written into CSS.
 */
export const DEFAULT_BRAND = { from: "#4f46e5", to: "#0ea5e9" } as const;

// "#rgb", "#rrggbb", or a bare "rrggbb". A bare 3-letter word ("bad", "fee") is not treated as a colour.
const HEX = /^(?:#([0-9a-f]{3}|[0-9a-f]{6})|([0-9a-f]{6}))$/i;

export function normalizeHex(input?: string | null): string | undefined {
  if (!input) return undefined;
  const m = input.trim().match(HEX);
  if (!m) return undefined;
  let h = (m[1] ?? m[2]).toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return `#${h}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex)!.slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function relLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const contrastWithWhite = (hex: string) => 1.05 / (relLuminance(hex) + 0.05);

/** amount < 0 mixes toward black, amount > 0 toward white (0..1). */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}

/** White text must stay readable on the brand colour: darken it until it is. */
export function ensureWhiteContrast(hex: string, min = 4.5): string {
  let h = normalizeHex(hex)!;
  for (let i = 0; i < 40 && contrastWithWhite(h) < min; i++) h = shade(h, -0.08);
  return h;
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round(((h * 60) + 360) % 360), s, l };
}

/** The two gradient colours for a business: its own brand colour if set (always white-text safe), else the default. */
export function resolveBrand(c: { chat?: { brandColor?: string } }): { from: string; to: string; custom: boolean } {
  const h = normalizeHex(c.chat?.brandColor);
  if (!h) return { from: DEFAULT_BRAND.from, to: DEFAULT_BRAND.to, custom: false };
  const from = ensureWhiteContrast(h);
  return { from, to: shade(from, -0.22), custom: true };
}
