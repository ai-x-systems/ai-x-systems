import { z } from "zod";

const DayHoursSchema = z.object({
  open: z.string(),
  close: z.string(),
  closed: z.boolean().optional(),
});

const WeeklyHoursSchema = z.object({
  monday: DayHoursSchema,
  tuesday: DayHoursSchema,
  wednesday: DayHoursSchema,
  thursday: DayHoursSchema,
  friday: DayHoursSchema,
  saturday: DayHoursSchema,
  sunday: DayHoursSchema,
});

const ServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  durationMinutes: z.number(),
  price: z.string().optional(),
});

const FaqSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const PoliciesSchema = z.object({
  emergency: z.string().optional(),
  insurance: z.string().optional(),
  cancellation: z.string().optional(),
  general: z.array(z.string()).optional(),
});

/**
 * Everything the AI needs to know to answer questions and reason about the
 * business. Deliberately separate from metadata (name, hours, phone) so
 * that when a real Knowledge Base Engine arrives (Phase 4/7 — PDFs, uploaded
 * docs, website scraping), it slots in here without touching anything else.
 */
const KnowledgeSchema = z.object({
  services: z.array(ServiceSchema),
  faqs: z.array(FaqSchema),
  policies: PoliciesSchema,
});

const VoiceSettingsSchema = z.object({
  assistantName: z.string(),
  tone: z.enum(["friendly", "professional", "warm", "concise"]),
  language: z.string(),
  greeting: z.string(),
});

const BookingSettingsSchema = z.object({
  enabled: z.boolean(),
  appointmentTypes: z.array(z.string()),
  bufferMinutes: z.number(),
  timezone: z.string(),
});

const IntegrationSettingsSchema = z.object({
  googleCalendarId: z.string().optional(),
  leadSheetId: z.string().optional(),
  notifyEmail: z.string().optional(),
  notifySmsNumber: z.string().optional(),
  confirmationFromEmail: z.string().optional(),
});

export const BusinessConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  industry: z.string(),
  phoneNumber: z.string(),
  timezone: z.string(),

  /**
   * When true: no real calendar events, sheet rows, emails, or SMS are
   * created. Tool responses stay worded identically to a real booking, so
   * a prospect experiencing the demo can't tell the difference — only the
   * side effects are simulated. Use this for every sales-demo business
   * (e.g. Smile Dental Clinic). Real clients should be false.
   */
  demo: z.boolean().default(false),

  contact: z.object({
    address: z.string().optional(),
    website: z.string().optional(),
    email: z.string().optional(),
  }),

  hours: WeeklyHoursSchema,
  knowledge: KnowledgeSchema,
  voice: VoiceSettingsSchema,
  booking: BookingSettingsSchema,
  integrations: IntegrationSettingsSchema,
});

export type BusinessConfig = z.infer<typeof BusinessConfigSchema>;