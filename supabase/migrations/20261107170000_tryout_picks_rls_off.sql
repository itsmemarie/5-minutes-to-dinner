-- 20261107120000 meant RLS to be off here but never said so, and the live table
-- ended up with RLS on and no policies, which refused every pick. Stating it
-- matches meal_plans and saved_weeks (see the README's Known gaps).
alter table public.tryout_picks disable row level security;
