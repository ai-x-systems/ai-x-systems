-- AI x Systems — Supabase schema.
-- RECONSTRUCTED from the code (the original schema.sql was referenced but
-- missing from the repo). Every statement is idempotent. Before running on
-- your live project, compare with what already exists in the Table Editor.
-- RLS is ON with NO policies: only the server (service_role key) can read
-- or write. The anon key can touch nothing.

create extension if not exists pgcrypto;

-- ── Auth ────────────────────────────────────────────────────────────────
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  role text not null check (role in ('admin','client')),
  business_id text,
  created_at timestamptz not null default now()
);
create unique index if not exists accounts_email_lower_idx on accounts (lower(email));

create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── Billing / activity / config ─────────────────────────────────────────
create table if not exists credit_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id text not null,
  type text not null,
  amount numeric not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists credit_tx_business_idx on credit_transactions (business_id, created_at);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  business_id text not null,
  type text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists activity_business_idx on activity_log (business_id, created_at desc);

create table if not exists business_overrides (
  business_id text primary key,
  faqs jsonb,
  notify_email text,
  updated_at timestamptz not null default now()
);

-- ── Inbound demo requests (/demo form) ──────────────────────────────────
create table if not exists prospect_leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  industry text, country text, city text,
  service_type text,
  contact_name text not null,
  email text not null,
  phone text, website text, business_hours text,
  offerings text, challenges text, volume text, referral_source text, details text,
  status text not null default 'new' check (status in ('new','contacted','converted','closed')),
  created_at timestamptz not null default now()
);

-- ── NEW: DB-backed business configs (self-serve onboarding) ─────────────
-- data/businesses/*.json still works; a row here with the same id wins.
create table if not exists businesses (
  id text primary key,
  config jsonb not null,
  source text not null default 'autopilot',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── NEW: Growth engine (outbound acquisition) ───────────────────────────
create table if not exists outreach_leads (
  id uuid primary key default gen_random_uuid(),
  place_id text unique,
  business_name text not null,
  industry text, city text, country text, address text,
  website text, phone text, email text,
  rating numeric, review_count int,
  signals jsonb not null default '{}',
  score int not null default 0,
  source text not null default 'places',
  stage text not null default 'discovered',
  step int not null default 0,
  next_action_at timestamptz,
  last_contacted_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists outreach_leads_stage_idx on outreach_leads (stage, score desc);
create unique index if not exists outreach_leads_email_idx on outreach_leads (lower(email)) where email is not null;

create table if not exists outreach_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references outreach_leads(id) on delete cascade,
  step int not null,
  subject text not null,
  body_text text not null,
  status text not null default 'draft' check (status in ('draft','approved','sent','failed','skipped')),
  sent_at timestamptz,
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists outreach_messages_status_idx on outreach_messages (status, created_at);

create table if not exists outreach_suppressions (
  email text primary key,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists growth_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Lock everything down (no policies = service_role only).
alter table accounts enable row level security;
alter table password_reset_tokens enable row level security;
alter table credit_transactions enable row level security;
alter table activity_log enable row level security;
alter table business_overrides enable row level security;
alter table prospect_leads enable row level security;
alter table businesses enable row level security;
alter table outreach_leads enable row level security;
alter table outreach_messages enable row level security;
alter table outreach_suppressions enable row level security;
alter table growth_settings enable row level security;

-- ── Self-serve onboarding + billing (added with the onboarding feature) ──
alter table businesses add column if not exists client_email text;
alter table businesses add column if not exists billing_status text not null default 'awaiting_payment';
alter table businesses add column if not exists active boolean not null default true;

create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique,
  type text not null,
  email text,
  business_id text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table billing_events enable row level security;

-- ── Voice (Vapi) — prepaid minutes ──────────────────────────────────────
-- 1 credit in credit_transactions = 1 voice minute. Top-ups are positive rows,
-- each finished call writes one negative 'usage' row.
create table if not exists voice_lines (
  id uuid primary key default gen_random_uuid(),
  business_id text not null unique,
  e164 text not null unique,                 -- the number callers reach (E.164, e.g. +15125550123)
  vapi_phone_number_id text,                 -- optional, from the Vapi dashboard
  forward_to text,                           -- human fallback when minutes run out / paused
  sell_cents_per_minute int not null default 0, -- what you charge per minute (margin reporting only)
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists voice_calls (
  id uuid primary key default gen_random_uuid(),
  call_id text not null unique,              -- Vapi call id: makes billing idempotent
  business_id text not null,
  caller text,
  duration_seconds int not null default 0,
  billed_minutes int not null default 0,
  vapi_cost_cents numeric,                   -- what Vapi says the call cost YOU
  ended_reason text,
  created_at timestamptz not null default now()
);
create index if not exists voice_calls_business_idx on voice_calls (business_id, created_at desc);

alter table voice_lines enable row level security;
alter table voice_calls enable row level security;
