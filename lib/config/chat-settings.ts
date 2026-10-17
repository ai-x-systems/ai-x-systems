import { normalizeHex } from "./brand";

/** Everything an owner can change about how their chat looks and sounds. All optional. */
export interface ChatSettings {
  greeting?: string;
  bubble?: string;
  headline?: string;
  subtitle?: string;
  suggestions?: string[];
  brandColor?: string;
}

const LIMITS = { greeting: 400, bubble: 160, headline: 80, subtitle: 160 } as const;
const tidy = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * Cleans untrusted input (from the admin screen or a client's dashboard) into settings that are
 * safe to store and later render: lengths capped, blanks dropped (a blank means "use the default"),
 * and the colour reduced to "#rrggbb" or removed. Nothing here can carry markup into a page's CSS.
 */
export function sanitizeChat(input: unknown): ChatSettings {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: ChatSettings = {};
  for (const k of ["greeting", "bubble", "headline", "subtitle"] as const) {
    const v = tidy(src[k], LIMITS[k]);
    if (v) out[k] = v;
  }
  const rawList = Array.isArray(src.suggestions) ? src.suggestions : typeof src.suggestions === "string" ? src.suggestions.split("\n") : [];
  const suggestions = rawList.map((s) => tidy(s, 60)).filter(Boolean).slice(0, 4);
  if (suggestions.length) out.suggestions = suggestions;
  const color = normalizeHex(typeof src.brandColor === "string" ? src.brandColor : undefined);
  if (color) out.brandColor = color;
  return out;
}

/** An override replaces the base value only where it actually has one. */
export function mergeChat(base?: ChatSettings, over?: ChatSettings): ChatSettings | undefined {
  if (!over || Object.keys(over).length === 0) return base;
  return { ...(base ?? {}), ...sanitizeChat(over) };
}
