-- Saved weeks become editable in place: Settings › Saved weeks can rename one and
-- change its meals (src/components/SavedWeekEditor.jsx). Until now a row was only
-- ever inserted or deleted.
--
-- `updated_at` orders the list (most recently changed first) and is shown as
-- "last changed". A trigger sets it, so it follows the database clock rather than
-- the phone's, and the app never has to send it.
alter table public.saved_weeks
  add column if not exists updated_at timestamptz not null default now();

update public.saved_weeks set updated_at = created_at where updated_at <> created_at;

create or replace function public.saved_weeks_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists saved_weeks_touch_updated_at on public.saved_weeks;
create trigger saved_weeks_touch_updated_at
  before update on public.saved_weeks
  for each row execute function public.saved_weeks_touch_updated_at();

-- Only the name and the meals can change. RLS stays off, as on meal_plans and the
-- rest of the app's tables (see the README's Known gaps), and the grants stay
-- spelled out. Undoing a delete re-inserts the row with its old id and dates,
-- which the existing INSERT grant already covers.
alter table public.saved_weeks disable row level security;
grant update (name, meals) on public.saved_weeks to anon, authenticated;
