export type Stage =
  | "discovered" | "enriched" | "no_email" | "drafted" | "queued"
  | "contacted" | "replied" | "demo_booked" | "won" | "lost"
  | "unsubscribed" | "bounced";

export const STAGE_ORDER: Stage[] = [
  "discovered", "enriched", "drafted", "queued", "contacted",
  "replied", "demo_booked", "won",
];

export interface OutreachLead {
  id: string;
  placeId?: string;
  businessName: string;
  industry?: string;
  city?: string;
  country?: string;
  website?: string;
  phone?: string;
  email?: string;
  rating?: number;
  reviewCount?: number;
  signals: { chatWidget?: boolean; onlineBooking?: boolean; demoAttempts?: number; demoSkipped?: boolean };
  score: number;
  stage: Stage;
  step: number;
  demoBusinessId?: string;
  nextActionAtISO?: string;
  lastContactedAtISO?: string;
  notes?: string;
  createdAtISO: string;
}

export type MessageStatus = "draft" | "approved" | "sent" | "failed" | "skipped";

export interface OutreachMessage {
  id: string;
  leadId: string;
  step: number;
  subject: string;
  bodyText: string;
  status: MessageStatus;
  sentAtISO?: string;
  error?: string;
  createdAtISO: string;
}

export interface GrowthSettings {
  /**
   * "manual" (default): the system finds leads and writes the emails; YOU copy each one into your own mailbox
   * and press "I sent it". No sending service, no domain, no policy risk.
   * "auto": the system sends through the configured provider (needs a domain + a cold-email-friendly sender).
   */
  sendMode: "manual" | "auto";
  /** auto mode only: false = each email waits for one-click approval. */
  autoSend: boolean;
  /** Ceiling; the real daily limit also ramps up slowly (warm-up). */
  dailySendCap: number;
  industries: string[];
  cities: string[];
  /** ISO country the outreach targets. Cold-email law differs by country. */
  country: string;
  /** "chat" = website AI receptionist only (what is live today). "voice" adds phone answering — only enable once the Voice agent exists. */
  offer: "chat" | "voice";
  senderName: string;
  discoverPerRun: number;
}

export const DEFAULT_SETTINGS: GrowthSettings = {
  sendMode: "manual",
  autoSend: false,
  dailySendCap: 30,
  industries: ["dentist", "hvac contractor", "plumber", "law firm"],
  cities: [],
  country: "US",
  offer: "chat",
  senderName: "Alex",
  discoverPerRun: 20,
};
