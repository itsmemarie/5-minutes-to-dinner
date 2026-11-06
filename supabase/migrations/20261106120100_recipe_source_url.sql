-- Link to the page a recipe came from, so the original creator's steps are one
-- tap away. Separate from source_file, which names the .docx a recipe was
-- bulk-imported from.
--
-- The check matters: recipes has RLS off, so anyone with the anon key can write
-- this column, and the app opens its value in a new tab. Only http(s) gets in.
alter table public.recipes
  add column if not exists source_url text
    check (source_url is null or source_url ~* '^https?://');
