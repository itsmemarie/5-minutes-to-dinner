-- Rating a recipe from the recipe screen, with no planned meal behind it.
--
-- Until now every rating belonged to a planned meal. A recipe opened from the
-- picker or the swipe deck has none, so a rating can now belong to the recipe
-- alone: planned_meal_id null, recipe_id set. There is at most one such row per
-- recipe, and re-rating updates it.
--
-- Every row also carries recipe_id, so "what did I last think of this recipe"
-- is one query. A trigger fills it from the planned meal, so the app's existing
-- writes, which only send planned_meal_id, keep working unchanged.
alter table public.meal_ratings
  add column if not exists recipe_id text references public.recipes(id) on delete cascade;

alter table public.meal_ratings alter column planned_meal_id drop not null;

update public.meal_ratings mr
   set recipe_id = pm.recipe_id
  from public.planned_meals pm
 where pm.id = mr.planned_meal_id
   and mr.recipe_id is null;

create or replace function public.meal_ratings_fill_recipe_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.recipe_id is null and new.planned_meal_id is not null then
    select recipe_id into new.recipe_id from public.planned_meals where id = new.planned_meal_id;
  end if;
  return new;
end;
$$;

drop trigger if exists meal_ratings_fill_recipe_id on public.meal_ratings;
create trigger meal_ratings_fill_recipe_id
  before insert on public.meal_ratings
  for each row execute function public.meal_ratings_fill_recipe_id();

-- A rating belongs to a meal, a recipe, or both.
alter table public.meal_ratings drop constraint if exists meal_ratings_has_target;
alter table public.meal_ratings
  add constraint meal_ratings_has_target check (planned_meal_id is not null or recipe_id is not null);

create unique index if not exists meal_ratings_one_per_recipe
  on public.meal_ratings (recipe_id) where planned_meal_id is null;
create index if not exists meal_ratings_recipe_id on public.meal_ratings (recipe_id);

-- Still off, as in 20261107180000_home_ratings.
alter table public.meal_ratings disable row level security;
