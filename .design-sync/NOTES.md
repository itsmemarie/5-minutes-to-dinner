# design-sync notes — 5-minutes-to-dinner

## Repo shape

This repo is a single Vite/React **app** (`src/lib/App.jsx`), not a design-system
package. There is no Storybook and, originally, no reusable component library at
all — it was one 1600+ line `App.jsx`. Before this sync:

1. The app was split into `src/components/` (screens + `ui/` primitives) and
   `src/lib/` (theme tokens, date/recipe helpers, AI client) so components exist
   as separate files at all.
2. Only the 10 genuinely reusable, presentational pieces are synced as the
   "design system" — the ui primitives (`Btn`, `PillBtn`, `Stepper`, `CapLabel`,
   `SecHead`, `HDivider`, `Spinner`, `TodayTag`) plus `RecipeCard`/`RecipeBucket`.
   The page-level screens (`PlannerScreen`, `RecipeScreen`, `DailyPlanScreen`,
   `RecipeSelectionScreen`, `NewRecipeForm`, `NutritionScreen`,
   `ShoppingListScreen`, `BatchScreen`, `SettingsScreen`) are wired directly to
   Supabase/Groq and this app's specific data shapes — they were deliberately
   left OUT of the sync scope; syncing them would have let the design agent try
   to reuse a whole app screen as if it were a composable primitive.

## Library entry (why `dist-lib/` and `types/` exist)

The package-shape converter needs a built ES-module entry with named exports
plus a matching `.d.ts` tree — this app's normal `vite build` only produces an
app bundle (`dist/index.html` + one JS blob), not that.

- `vite.lib.config.js` + `npm run build:ds` builds `src/components/index.js`
  (a 10-component barrel) into `dist-lib/index.es.js` (gitignored, like `dist/`).
- `types/index.d.ts` is **hand-written** (not generated — this is a plain JS/JSX
  codebase, no TypeScript anywhere else in the repo) and IS committed; it's the
  only source of the `<Name>Props` contract the converter/design agent reads.
  `package.json` `"types"` points at it.
- `@types/react` was added as a devDependency solely so ts-morph can resolve
  `JSX.Element` / React utility types while parsing `types/index.d.ts`.

**If any of the 10 synced components' props change**, update `types/index.d.ts`
by hand to match — nothing regenerates it automatically.

## Styling

No CSS at all — every component styles itself via inline `style` props driven
by a `C` token object (colors) and `ep`/`mn` font-family objects in
`src/lib/theme.js`. `[CSS_RUNTIME]` fires on every build; that's expected, not
a bug — see `.design-sync/conventions.md` for the color values written out for
the design agent (they aren't exported from the bundle, just baked into JSX).

**Fonts are NOT shipped or referenced by any `@font-face`** — the app loads
Epilogue + Manrope from Google Fonts via a `<link>` tag in `index.html`.
Because there's no CSS at all for the scraper to find, `[FONT_MISSING]` never
fires even though the fonts genuinely aren't in the bundle. Documented in
`conventions.md` instead so the design agent knows to load them itself.

## Known render warns

None — render check is clean (0 bad, 0 thin, 0 variantsIdentical) across both
build passes.

## Re-sync risks

- If new UI primitives are added to `src/components/ui/` (or new reusable
  pieces extracted from the screens) and should join the design system, they
  need: (1) an export in `src/components/index.js`, (2) a hand-written
  `<Name>Props` entry in `types/index.d.ts`, (3) an entry in
  `.design-sync/config.json`'s `componentSrcMap`, (4) an authored preview in
  `.design-sync/previews/<Name>.tsx`. None of this is automatic given the
  hand-rolled library entry.
- `types/index.d.ts` can silently drift from the real component props since
  nothing checks it against the `.jsx` source — if a re-sync's render check
  starts failing oddly for one of these 10, check the hand-written prop shape
  first.
- The color hex values in `conventions.md` are copied by hand from
  `src/lib/theme.js`'s `C` object — if that object changes, the conventions
  file needs a manual re-sync (the validation step in "Author the conventions
  header" catches drift on class/prop *names*, but plain color hex values
  aren't independently checkable the same way).
