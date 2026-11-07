-- A shopping list's amount is display text, never calculated with: "200g + 150g"
-- from a basic list, '' for an item added by hand. As numeric, Postgres rejected
-- both, and one bad value fails the whole insert. Nothing reads it as a number.
alter table public.shopping_list_items
  alter column amount type text using amount::text;
