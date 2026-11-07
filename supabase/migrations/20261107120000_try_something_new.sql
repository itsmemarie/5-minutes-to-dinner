-- "Try something new": swipe deck, weekly target and removed recipes.
-- recipes.source_url already exists (20261106120100), so it isn't added here.

alter table public.recipes
  add column if not exists source_platform  text check (source_platform in ('instagram', 'tiktok')),
  add column if not exists source_author    text,
  add column if not exists saved_at         timestamptz,
  add column if not exists video_thumb_path text,
  add column if not exists skip_count       int not null default 0 check (skip_count >= 0),
  add column if not exists snoozed_until    timestamptz,
  add column if not exists archived_at      timestamptz;

-- source_url also holds ordinary recipe links and has several writers (the app,
-- the skill, later imports), so the database keeps the reel fields true to it.
create or replace function public.sync_recipe_reel_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.source_platform := case
    when new.source_url ~* '^https?://([a-z0-9-]+\.)*(instagram\.com|instagr\.am)([/?#]|$)' then 'instagram'
    when new.source_url ~* '^https?://([a-z0-9-]+\.)*tiktok\.com([/?#]|$)' then 'tiktok'
  end;
  -- The old reel's still and creator don't belong to a new link.
  if tg_op = 'UPDATE' and new.source_url is distinct from old.source_url then
    new.source_author := null;
    new.video_thumb_path := null;
  end if;
  return new;
end $$;

drop trigger if exists recipes_sync_reel_fields on public.recipes;
create trigger recipes_sync_reel_fields
  before insert or update of source_url on public.recipes
  for each row execute function public.sync_recipe_reel_fields();

alter table public.app_settings
  add column if not exists tryout_weekly_target int not null default 2
    check (tryout_weekly_target between 0 and 7);

-- week_of is the first day of the week the pick was made, per "Week starts on".
create table if not exists public.tryout_picks (
  id              uuid primary key default gen_random_uuid(),
  recipe_id       text not null references public.recipes(id) on delete cascade,
  week_of         date not null,
  picked_at       timestamptz not null default now(),
  planned_meal_id uuid references public.planned_meals(id) on delete set null,
  owner_email     text not null,
  unique (recipe_id, week_of)
);

-- Same owner as every other row, without writing the address into git.
do $$
declare owner_default text;
begin
  select pg_get_expr(d.adbin, d.adrelid) into strict owner_default
  from pg_attrdef d
  join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
  where d.adrelid = 'public.recipes'::regclass and a.attname = 'owner_email';
  execute format('alter table public.tryout_picks alter column owner_email set default %s', owner_default);
end $$;

-- The app writes with the anon key and RLS is off, as on meal_plans and
-- saved_weeks (see the README's Known gaps). Grants are spelled out.
revoke all on public.tryout_picks from anon, authenticated;
grant select, insert, update, delete on public.tryout_picks to anon, authenticated;
