-- Home redesign: how a meal went, and what that means for its recipe.
--
-- meal_ratings has been live since the first version, with no comment and rating
-- required. A child's answer can now be saved without a rating, so rating becomes
-- optional. ate records the selected child only (see the handover's Out of scope).
alter table public.meal_ratings
  add column if not exists comment text,
  add column if not exists ate text check (ate in ('all','some','none'));

alter table public.meal_ratings alter column rating drop not null;

-- status is the recipe's place in the rotation: retired recipes leave browsing and
-- the deck but stay findable by search. It's separate from archived_at, which takes
-- a recipe out of the app altogether. second_chance_since is the day the second
-- chance was given: only meals dated after it can decide the recipe's fate.
alter table public.recipes
  add column if not exists status text not null default 'active'
    check (status in ('active','second_chance','retired')),
  add column if not exists fix_note text,
  add column if not exists second_chance_since date;

-- Already off, like meal_plans and saved_weeks. Stated here because tryout_picks
-- once went live with RLS on by surprise.
alter table public.meal_ratings disable row level security;
