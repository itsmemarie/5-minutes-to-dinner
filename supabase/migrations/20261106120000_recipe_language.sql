-- Settings › Region & units: the language recipes are kept in, and whether
-- "Fill in the gaps" asks before translating a recipe into it.
--
-- recipe_language holds an ISO 639-1 code from RECIPE_LANGUAGES in
-- src/lib/preferences.js. Like `country` it has no check constraint, so the
-- list can grow without a migration.
alter table public.app_settings
  add column if not exists recipe_language text not null default 'en',
  add column if not exists recipe_translate text not null default 'ask'
    check (recipe_translate in ('ask', 'always', 'never'));
