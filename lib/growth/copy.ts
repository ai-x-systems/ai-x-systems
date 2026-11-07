/**
 * Outcome-first outreach copy. Pure (no I/O) so it is unit tested.
 *
 * The aim is to describe the PROBLEM the business already has (customers who can't reach anyone leave
 * and call a competitor), the OUTCOME (answered in seconds, details captured, you call back warm leads),
 * and give them a way to judge it themselves (a working preview built from their own site).
 *
 * Honesty rules that are enforced by tests:
 *  - Every claim about the business comes from its own public website or Google listing (facts we pass in).
 *    When we don't know something we say nothing about it.
 *  - The money line is plainly labelled "rough math with round numbers, swap in yours". It never says
 *    "you are losing $X".
 *  - No guarantees, no invented case studies, no fake "Re:" threads, no fake scarcity.
 */
type Day = { open: string; close: string; closed?: boolean };
export type WeekHours = Record<"monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday", Day>;

export interface LeakFacts {
  hoursKnown: boolean;
  weekdayOpen?: string;
  weekdayClose?: string;
  /** weekday opening hours end by 5:30pm */
  closesEarly?: boolean;
  weekendClosed?: boolean;
  /** the site talks about 24/7 or emergency service */
  claims247?: boolean;
  /** the site has no online booking and no chat: reaching them means a call or a form */
  phoneOnly?: boolean;
  noChat?: boolean;
  reviewCount?: number;
  rating?: number;
}

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;

function minutes(t: string): number | undefined {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}
function short12(t: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return t;
  const h = Number(m[1]);
  const h12 = h % 12 || 12;
  return `${h12}${m[2] === "00" ? "" : `:${m[2]}`}${h >= 12 ? "pm" : "am"}`;
}

/** What the business's own listed hours say about evenings and weekends. Unknown hours say nothing. */
export function hoursFacts(hours: WeekHours | undefined, known: boolean): Pick<LeakFacts, "hoursKnown" | "weekdayOpen" | "weekdayClose" | "closesEarly" | "weekendClosed"> {
  if (!hours || !known) return { hoursKnown: false };
  const open = WEEKDAYS.map((d) => hours[d]).filter((d) => d && !d.closed && minutes(d.open) !== undefined && minutes(d.close) !== undefined);
  const weekendClosed = !!hours.saturday?.closed && !!hours.sunday?.closed;
  if (open.length < 3) return { hoursKnown: true, weekendClosed };
  const mode = (vals: string[]) => [...vals].sort((a, b) => vals.filter((v) => v === b).length - vals.filter((v) => v === a).length)[0];
  const weekdayOpen = mode(open.map((d) => d.open));
  const weekdayClose = mode(open.map((d) => d.close));
  const closeMin = minutes(weekdayClose) ?? 0;
  // 00:00-23:59 means "all day". That is not an early close.
  const closesEarly = closeMin > 0 && closeMin <= 17 * 60 + 30;
  return { hoursKnown: true, weekdayOpen: short12(weekdayOpen), weekdayClose: short12(weekdayClose), closesEarly, weekendClosed };
}

export interface IndustryProfile { plural: string; scenario: string; valueLabel: string; value: number }

/** Conservative, round, clearly-illustrative job values. Used only inside the "rough math" sentence. */
export function industryProfile(industry?: string): IndustryProfile {
  const t = (industry ?? "").toLowerCase();
  if (/hvac|air condition|heating|cooling|furnace/.test(t)) return { plural: "HVAC companies", scenario: "a homeowner's AC dies at 9pm on a hot night", valueLabel: "a repair or install", value: 450 };
  if (/plumb|drain|sewer/.test(t)) return { plural: "plumbers", scenario: "a pipe starts leaking at 10pm on a Saturday", valueLabel: "an emergency call-out", value: 350 };
  if (/dent|orthodont/.test(t)) return { plural: "dental practices", scenario: "a new patient looks for a dentist at 8pm and wants to book", valueLabel: "a new patient", value: 300 };
  if (/law|attorney|lawyer/.test(t)) return { plural: "law firms", scenario: "someone who was just in an accident searches for a lawyer at 8pm", valueLabel: "a new case", value: 1500 };
  if (/roof/.test(t)) return { plural: "roofers", scenario: "a homeowner spots a leak after a storm at 7pm", valueLabel: "a roofing job", value: 1000 };
  if (/electric/.test(t)) return { plural: "electricians", scenario: "half the house loses power at 8pm", valueLabel: "a call-out", value: 300 };
  return { plural: "local businesses", scenario: "a new customer reaches out at 8pm and wants a quote", valueLabel: "a new customer", value: 250 };
}

export const MISSED_PER_WEEK = 2;
export function yearlyExample(value: number, perWeek = MISSED_PER_WEEK): number {
  return Math.round((value * perWeek * 52) / 100) * 100;
}
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

/** A readable short name for subject lines: "Hansen Family Air Conditioning & Plumbing" -> "Hansen Family". */
export function shortName(name: string): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length <= 24) return clean;
  const GENERIC = /^(air|heating|cooling|hvac|plumbing|plumber|plumbers|dental|dentistry|law|legal|roofing|roofers|electric|electrical|services?|company|co\.?|inc\.?|llc|&|and|of|the)$/i;
  const words = clean.split(" ");
  const out: string[] = [];
  for (const w of words) {
    if (out.length >= 1 && GENERIC.test(w)) break;
    if ((out.join(" ") + " " + w).trim().length > 24) break;
    out.push(w);
  }
  return out.join(" ").replace(/\s+(&|and|of|the)$/i, "") || words[0];
}

export interface Hook { key: "hours247" | "hours" | "phoneOnly" | "reviews" | "noChat" | "generic"; observation: string; subjectTail?: string }

/** Picks the single strongest, verifiable observation about this business. */
export function chooseHook(f: LeakFacts, o: { short: string; offer: "chat" | "voice"; fallbackOpener?: string; where?: string }): Hook {
  const voice = o.offer === "voice";
  if (f.hoursKnown && f.closesEarly && f.weekdayClose) {
    const weekends = f.weekendClosed ? " and no weekend hours" : "";
    if (f.claims247) {
      return { key: "hours247", subjectTail: `after ${f.weekdayClose}`, observation: `Your site mentions emergency or 24/7 service, but the hours it lists end at ${f.weekdayClose}. If someone covers nights, ignore this. If not, that gap is where jobs leak.` };
    }
    return { key: "hours", subjectTail: `after ${f.weekdayClose}`, observation: `Your website lists ${f.weekdayOpen ? `${f.weekdayOpen}-${f.weekdayClose}` : `hours until ${f.weekdayClose}`} on weekdays${weekends}, which means evenings${f.weekendClosed ? " and weekends" : ""} are when someone with an urgent problem has ${voice ? "nobody to call" : "nobody to ask"} (unless you have a service covering them).` };
  }
  if (f.phoneOnly) {
    return { key: "phoneOnly", observation: `I couldn't find a way on your site to book or ask a question other than calling or filling in a form, and plenty of people won't wait for a callback.` };
  }
  if ((f.reviewCount ?? 0) >= 50 && (f.rating ?? 0) >= 4) {
    return { key: "reviews", observation: `${f.reviewCount} reviews at ${f.rating} stars tells me people choose ${o.short}, which is exactly why every inquiry you miss is expensive.` };
  }
  if (f.noChat) {
    return { key: "noChat", observation: `I couldn't find a way to ask ${o.short} a question on your site once the office is closed.` };
  }
  return { key: "generic", observation: o.fallbackOpener?.trim() || `I came across ${o.short}${o.where ? ` while looking at ${o.where}` : ""}.` };
}

export interface OutcomeInput {
  businessName: string;
  industry?: string;
  city?: string;
  /** one safe sentence from the model, used only when we have no verifiable observation */
  opener?: string;
  step: 1 | 2 | 3;
  senderName: string;
  demoUrl: string;
  tryUrl?: string;
  offer: "chat" | "voice";
  facts?: LeakFacts;
}

export function buildOutcomeEmail(i: OutcomeInput): { subject: string; body: string } {
  const short = shortName(i.businessName);
  const voice = i.offer === "voice";
  const p = industryProfile(i.industry);
  const where = [i.industry, i.city].filter(Boolean).join(" in ");
  const facts: LeakFacts = i.facts ?? { hoursKnown: false };
  const hook = chooseHook(facts, { short, offer: i.offer, fallbackOpener: i.opener, where });
  const sign = `— ${i.senderName}\nAI x Systems`;
  const yearly = usd(yearlyExample(p.value));
  const link = i.tryUrl ?? i.demoUrl;
  const scenario = p.scenario;

  if (i.step === 1) {
    const subject = hook.subjectTail
      ? `${short}: ${voice ? "calls" : "website visitors"} ${hook.subjectTail}`
      : voice ? `${short}: who answers at 9pm?` : `${short}: visitors who show up at 9pm`;

    const leak = voice
      ? `When nobody picks up, the customer doesn't leave a voicemail. They call the next company on Google, and you never know it happened.`
      : `When nobody's there to answer, the visitor doesn't wait. They click over to the next company on Google, and you never know it happened.`;
    const math = `Rough math with round numbers (swap in yours): ${p.valueLabel} is worth about ${usd(p.value)}, so even ${MISSED_PER_WEEK} lost a week is about ${yearly} a year.`;
    const outcome = voice
      ? `I set up an AI assistant for ${short} that closes that gap. Every caller and website visitor gets an answer in seconds, day or night, and you get their name, number and what they need. You start the morning with leads to call back, not leads you never knew about.`
      : `I set up an AI assistant for ${short} that closes that gap. Every visitor gets an answer in seconds, day or night, and you get their name, number and what they need. You start the morning with leads to call back, not leads you never knew about.`;
    const proof = i.tryUrl
      ? `I built a working version from your own website so you can judge it yourself (it's a preview, so details may be off): ${i.tryUrl}`
      : `I can build a working version around ${short} so you can judge it yourself. Reply "show me", or request it here: ${i.demoUrl}`;
    const close = i.tryUrl
      ? `Not a fit? No problem and no pushy follow-ups. If it is, reply "show me" and I'll get it live for ${short}.`
      : `Not a fit? No problem and no pushy follow-ups.`;
    return { subject, body: `${hook.observation}\n\n${leak} ${math}\n\n${outcome}\n\n${proof}\n\n${close}\n\n${sign}` };
  }

  if (i.step === 2) {
    const subject = voice ? `Following up: who answers ${short}'s phones after hours?` : `Following up: ${short} after hours`;
    const experience = voice
      ? `Today that's a voicemail nobody leaves, and the job goes to whoever picks up. With the assistant, they get a real answer in seconds and you get a message with their name, number and what they need.`
      : `Today that's a visitor who leaves without a word, and the job goes to whoever answers. With the assistant, they get a real answer in seconds and you get a message with their name, number and what they need.`;
    const see = i.tryUrl ? `You can see how it handles that for ${short} here: ${i.tryUrl}` : `You can try a live example here: ${i.demoUrl}`;
    const ask = facts.closesEarly && facts.weekdayClose
      ? `One question: who covers ${voice ? "the phones" : "website inquiries"} at ${short} after ${facts.weekdayClose}?`
      : `One question: who covers ${voice ? "the phones" : "website inquiries"} at ${short} when the office is closed?`;
    return { subject, body: `Quick follow-up on my last note.\n\nPicture a normal evening: ${scenario}. ${experience}\n\n${see}\n\n${ask}\n\n${sign}` };
  }

  const subject = `Should I close the file on ${short}?`;
  const still = i.tryUrl ? `the working version I built for ${short} stays live for a few more weeks: ${i.tryUrl}` : `you can request a working version built around ${short} here: ${i.demoUrl}`;
  return {
    subject,
    body: `I'll stop emailing after this one so I'm not a nuisance.\n\nIf missed after-hours ${voice ? "calls and website inquiries" : "website inquiries"} aren't costing ${short} anything, there's nothing to do. If they are, ${still}\n\nReply "show me" and I'll take it from there.\n\n${sign}`,
  };
}
