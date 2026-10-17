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
  /** Distinguishes AI X Systems' own two products in its own knowledge base — optional, not meaningful for a client business's own services (e.g. Smile Dental Clinic's cleanings/whitening). */
  type: z.enum(["voice_ai", "website_chat_ai"]).optional(),
  availability: z.string().optional(),
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
 * Optional, richer knowledge structures beyond the original
 * services/faqs/policies. All fields here are optional so existing
 * businesses (e.g. Smile Dental Clinic) that don't use them remain valid
 * with zero changes. Everything declared here is genuinely validated by
 * Zod — nothing in this file is silently stripped on parse, unlike the
 * unrecognized keys a plain object schema drops by default.
 */
const CompanySchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    website: z.string().optional(),
  })
  .optional();

const DemoInfoSchema = z
  .object({
    liveDemoAvailable: z.boolean().optional(),
    liveDemoType: z.string().optional(),
    description: z.string().optional(),
    website: z.string().optional(),
    rules: z.array(z.string()).optional(),
  })
  .optional();

const BusinessSetupFormSchema = z
  .object({
    url: z.string().optional(),
    purpose: z.string().optional(),
    description: z.string().optional(),
    collects: z.array(z.string()).optional(),
  })
  .optional();

const LeadCapturePolicySchema = z
  .object({
    phoneNumberRequired: z.boolean().optional(),
    emailRequired: z.boolean().optional(),
    emailRequiredForFollowUp: z.boolean().optional(),
    rules: z.array(z.string()).optional(),
  })
  .optional();

const DemoPolicySchema = z
  .object({
    liveDemoIsActive: z.boolean().optional(),
    liveDemoType: z.string().optional(),
    rules: z.array(z.string()).optional(),
  })
  .optional();

const AnsweringPolicySchema = z
  .object({
    general: z.array(z.string()).optional(),
    leadCapturePolicy: LeadCapturePolicySchema,
    demoPolicy: DemoPolicySchema,
    unknownQuestionResponse: z.string().optional(),
    unknownIntegrationResponse: z.string().optional(),
    personalizedQuoteResponse: z.string().optional(),
    demoResponse: z.string().optional(),
  })
  .optional();

/**
 * Everything the AI needs to know to answer questions and reason about the
 * business. Deliberately separate from metadata (name, hours, phone) so
 * that when a real Knowledge Base Engine arrives (Phase 4/7 — PDFs, uploaded
 * docs, website scraping), it slots in here without touching anything else.
 */
const KnowledgeSchema = z.object({
  company: CompanySchema,
  services: z.array(ServiceSchema),
  demo: DemoInfoSchema,
  businessSetupForm: BusinessSetupFormSchema,
  faqs: z.array(FaqSchema),
  answeringPolicy: AnsweringPolicySchema,
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
  /**
   * The actual, authoritative list of what can be booked. Enforcement
   * (lib/tools/execute-tool-call.ts) checks THIS, not just `enabled` —
   * `enabled: true` with an empty list correctly means nothing is
   * bookable yet, without requiring `enabled` itself to be false.
   */
  appointmentTypes: z.array(z.string()),
  bufferMinutes: z.number(),
  timezone: z.string(),
  /** Optional, descriptive only — not read by any booking/Calendar code path. */
  purpose: z.string().optional(),
  provider: z.string().optional(),
  calendarId: z.string().optional(),
  note: z.string().optional(),
});

/**
 * A single named integration channel (lead management, CRM, booking,
 * calendar, phone system, notifications) as a flexible, descriptive
 * record. Not read by any integration code today (calendar.ts/sheets.ts/
 * notify.ts still read the flat fields below) — this exists so the
 * richer, client-specific integration picture is validated and available
 * for a future dashboard or client-onboarding feature, rather than
 * silently dropped.
 */
const IntegrationChannelSchema = z
  .object({
    enabled: z.boolean(),
    provider: z.string().optional(),
    system: z.string().nullable().optional(),
    calendarId: z.string().optional(),
    sheetId: z.string().optional(),
    email: z.string().optional(),
    /**
     * Generic outbound webhook — the one-adapter-fits-most-CRMs escape
     * hatch. Point this at a Zapier/Make/n8n catch hook or a CRM's native
     * inbound-webhook URL and lib/integrations/webhook.ts will POST every
     * lead/booking there as JSON, no bespoke per-CRM code required. Build
     * a real native adapter (see lib/integrations/) only once a specific
     * CRM integration is requested often enough to justify it.
     */
    webhookUrl: z.string().optional(),
  })
  .optional();

const IntegrationSettingsSchema = z.object({
  // Flat fields — the ones lib/integrations/{calendar,sheets,notify}.ts
  // and lib/tools/execute-tool-call.ts actually read. Unchanged, so
  // Smile Dental Clinic's real booking flow is untouched.
  googleCalendarId: z.string().optional(),
  leadSheetId: z.string().optional(),
  /**
   * Which tab of leadSheetId to append to. Defaults to "Sheet1" (Google
   * Sheets' default new-spreadsheet tab name) in lib/integrations/sheets.ts
   * when omitted, so existing businesses need no changes.
   */
  leadSheetTabName: z.string().optional(),
  notifyEmail: z.string().optional(),
  notifySmsNumber: z.string().optional(),
  confirmationFromEmail: z.string().optional(),
  /**
   * Generic outbound webhook for leads/bookings, independent of the
   * per-channel leadManagement/crm blocks below — set this when a client's
   * CRM should receive every lead/booking regardless of which named
   * channel block they filled in.
   */
  webhookUrl: z.string().optional(),

  // Richer, per-channel descriptive structure — validated, not stripped.
  // leadManagement/crm's own `webhookUrl` (if set) is read by
  // lib/integrations/webhook.ts as an additional delivery target.
  leadManagement: IntegrationChannelSchema,
  crm: IntegrationChannelSchema,
  booking: IntegrationChannelSchema,
  calendar: IntegrationChannelSchema,
  phoneSystem: IntegrationChannelSchema,
  notifications: IntegrationChannelSchema,
});

const ClientSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    status: z.string().optional(),
    clientNumber: z.number().optional(),
    deploymentType: z.string().optional(),
    description: z.string().optional(),
  })
  .optional();

const LeadManagementSchema = z
  .object({
    enabled: z.boolean().optional(),
    purpose: z.string().optional(),
    provider: z.string().optional(),
    system: z.string().optional(),
    sheetId: z.string().optional(),
    notifyEmail: z.string().optional(),
  })
  .optional();

const ClientOnboardingSchema = z
  .object({
    enabled: z.boolean().optional(),
    currentClient: z
      .object({
        clientId: z.string().optional(),
        clientNumber: z.number().optional(),
        status: z.string().optional(),
      })
      .optional(),
    futureClients: z
      .object({
        enabled: z.boolean().optional(),
        integrationCollection: z
          .object({
            methods: z.array(z.string()).optional(),
            description: z.string().optional(),
          })
          .optional(),
        requiredInformation: z.array(z.string()).optional(),
        deploymentProcess: z.array(z.string()).optional(),
        integrationRule: z.string().optional(),
      })
      .optional(),
  })
  .optional();

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

  client: ClientSchema,

  hours: WeeklyHoursSchema,
  /** false = opening hours are unknown (previews built from a site that doesn't list them): the assistant must not state any. */
  hoursKnown: z.boolean().optional(),
  knowledge: KnowledgeSchema,
  /** Website-chat copy. Optional: sensible defaults are generated from the business and assistant name. */
  chat: z
    .object({
      greeting: z.string().max(400).optional(),
      bubble: z.string().max(160).optional(),
      headline: z.string().max(80).optional(),
      subtitle: z.string().max(160).optional(),
      suggestions: z.array(z.string().max(60)).max(4).optional(),
      /** "#rrggbb" or "#rgb". The widget darkens it automatically if white text would be hard to read on it. */
      brandColor: z.string().regex(/^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})|[0-9a-fA-F]{6})$/).optional(),
    })
    .optional(),
  voice: VoiceSettingsSchema,
  booking: BookingSettingsSchema,
  integrations: IntegrationSettingsSchema,
  leadManagement: LeadManagementSchema,
  clientOnboarding: ClientOnboardingSchema,
});

export type BusinessConfig = z.infer<typeof BusinessConfigSchema>;
