/**
 * Turns stored opening hours and services back into the same plain text people type in the setup form,
 * so a client edits them in words ("Mon-Fri 9am-5pm"), and parseHours / parseServices read them back.
 * Pure (no I/O) so it is unit tested.
 */
type Day = { open: string; close: string; closed?: boolean };
const KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function clock(t: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return t;
  let h = Number(m[1]);
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${m[2]}${ap}`;
}

export function hoursToText(hours: Record<(typeof KEYS)[number], Day>): string {
  const label = (d: Day) => (d.closed || !d.open || !d.close ? "closed" : `${clock(d.open)}-${clock(d.close)}`);
  const lines: string[] = [];
  let i = 0;
  while (i < 7) {
    const cur = label(hours[KEYS[i]]);
    let j = i;
    while (j + 1 < 7 && label(hours[KEYS[j + 1]]) === cur) j++;
    lines.push(`${i === j ? SHORT[i] : `${SHORT[i]}-${SHORT[j]}`} ${cur}`);
    i = j + 1;
  }
  return lines.join("\n");
}

export function servicesToText(services: Array<{ name: string; price?: string; durationMinutes: number; description: string }>): string {
  return services.map((s) => [s.name, s.price ?? "", String(s.durationMinutes), s.description === s.name ? "" : s.description].join(" | ").replace(/\s+\|\s*$/, "")).join("\n");
}
