-- Saved weeks: named copies of a week's meals that can fill any week later.
-- A row is an independent snapshot, so `meals` holds the whole list rather than
-- pointing at planned_meals: editing the original week, or the week it filled,
-- leaves it alone. Each meal is stored by weekday name (see src/lib/savedWeeks.js)
-- so a saved week survives a change to "Week starts on".
create table if not exists public.saved_weeks (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  meals      jsonb not null default '[]'::jsonb check (jsonb_typeof(meals) = 'array'),
  created_at timestamptz not null default now()
);

-- The app writes with the anon key and RLS is off, as on meal_plans (see the
-- README's Known gaps). Grants are spelled out so the table only allows what
-- the app does: saved weeks are never edited in place.
revoke all on public.saved_weeks from anon, authenticated;
grant select, insert, delete on public.saved_weeks to anon, authenticated;
