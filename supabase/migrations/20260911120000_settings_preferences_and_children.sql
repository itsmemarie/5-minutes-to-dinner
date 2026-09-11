-- Settings rebuild: new user preferences on the app_settings singleton, and
-- the children list that replaces the single toddler_dob.
-- (Applied to the live project on 2026-09-11; kept here as the record.)
alter table app_settings
  add column if not exists suggest_from_history boolean not null default true,
  add column if not exists week_starts_on text not null default 'mon'
    check (week_starts_on in ('mon','tue','wed','thu','fri','sat','sun')),
  add column if not exists meal_sections jsonb,
  add column if not exists country text not null default 'GB',
  add column if not exists recipe_units text not null default 'metric'
    check (recipe_units in ('metric','imperial')),
  add column if not exists measurements text not null default 'weight'
    check (measurements in ('weight','cups')),
  add column if not exists toddler_mode_enabled boolean not null default false,
  add column if not exists children jsonb not null default '[]'::jsonb,
  add column if not exists selected_child_id text,
  add column if not exists toddler_activities boolean not null default true,
  add column if not exists toddler_variations boolean not null default true,
  add column if not exists toddler_portion boolean not null default false;

-- Meal sections are user-configurable now; the planner can hold any of the
-- catalogue sections, not just the original three.
alter table planned_meals drop constraint if exists planned_meals_section_check;
alter table planned_meals add constraint planned_meals_section_check
  check (section in ('breakfast','lunch','main','dinner','side','dessert','drinks'));
