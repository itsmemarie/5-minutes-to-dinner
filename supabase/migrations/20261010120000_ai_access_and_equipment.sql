-- AI access: the owner's per-step model choices, and the kitchen equipment
-- the recipe review and batch planner take into account.

-- One row per AI step the owner has changed from the default (Claude).
-- Only the edge functions (service role) read or write it: RLS is on with no
-- policies, so the anon and authenticated roles get nothing — the owner edits
-- it through the ai-config function, which checks OWNER_EMAIL server-side.
create table if not exists public.ai_model_choices (
  step       text primary key,
  provider   text not null check (provider in ('claude', 'groq', 'gemini')),
  model      text not null check (char_length(model) between 2 and 80),
  updated_at timestamptz not null default now()
);
alter table public.ai_model_choices enable row level security;
revoke all on public.ai_model_choices from anon, authenticated;

-- Settings › AI assistant › Kitchen equipment (ids from src/lib/preferences.js).
alter table public.app_settings
  add column if not exists kitchen_equipment jsonb not null
    default '["thermomix","oven","hob","microwave"]'::jsonb;
