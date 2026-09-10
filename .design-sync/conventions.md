## Wrapping and setup

No provider or root wrapper is required — every component is a plain function that renders inline-styled DOM, with no context/theme dependency. Just import and use.

**Fonts — load these yourself, they do not ship with the bundle.** This kit uses two Google Fonts, loaded via a `<link>` tag, not shipped as files or `@font-face` rules:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Caprasimo&family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

- **Caprasimo** (400 weight, display) — headings, prices/numbers, titles.
- **Figtree** (400–700 weight) — everything else: body copy, labels, buttons.

Without this link, every component falls back to the browser's default sans-serif.

## The styling idiom

**No CSS classes — this kit styles entirely via inline `style` props driven by JS constants**, not Tailwind/CSS-modules/styled-components. There is no exported stylesheet and no class vocabulary to reuse. When building new layout/glue around these components, match the idiom by using inline styles with the same color and spacing values (do not introduce a CSS-class-based system alongside it — it will look inconsistent).

Color palette actually in use (hex — these are not exported constants, just the values baked into each component; match them literally when composing new surrounding UI):

| Role | Hex | Used for |
|---|---|---|
| `primary` | `#2d602f` | Primary buttons, active pills, header bar, borders |
| `onPrimary` | `#fff` | Text/icons on primary fill |
| `primaryFixed` | `#eaf6ea` | Light accent chips (e.g. scale badges) |
| `secondaryContainer` | `#fff1e6` | Soft-tint (orange) button fill, inactive pill fill |
| `onSecondaryContainer` | `#e07a34` | Text on secondaryContainer |
| `tertiaryFixed` | `#fff1e6` | "Today" tag background |
| `onTertiaryFixed` | `#e07a34` | Text on tertiaryFixed |
| `error` | `#ba1a1a` | Error/delete affordances |
| `errorContainer` | `#ffdad6` | Error banners |
| `surface` | `#f3f8f2` | Page/app background |
| `surfaceContainerHigh` | `#eaf6ea` | Track backgrounds (e.g. Stepper pill), disabled fills |
| `onSurface` | `#182417` | Primary text |
| `onSurfaceVariant` | `#5c6a58` | Secondary/muted text, uppercase captions |
| `outline` / `outlineVariant` | `#5c6a58` / `#c8d6c5` | Borders, dividers |
| `placeholderStripeA` / `placeholderStripeB` | `#e7efe5` / `#dde8db` | Diagonal-stripe stand-in where a recipe photo is missing |
| `placeholderInk` | `#8c9a88` | Recipe code centred on that placeholder (9px monospace) |

Common patterns: 10px border-radius + `0 1px 2px rgba(24,36,23,0.14)` box-shadow for cards; 99px (pill) border-radius for buttons/badges/tags; uppercase + `0.06–0.08em` letter-spacing for small caption/label text.

**Screen title typography (app-level, not part of the synced component set):** the four bottom-nav tab screens (This week / Weekly planner / Shopping list / Batch cooking) share one header style — Caprasimo, 28px, `C.onSurface` — via the `screenTitle` token in `src/lib/theme.js`. Any new top-level screen header should use `screenTitle`, not a hand-rolled `fontSize`, so headers stay matched. Nested/detail-page titles (recipe detail, day detail, settings) are deliberately smaller (24–26px) and are not part of this token.

## Check/tick affordance color rule

Two circle-with-checkmark affordances exist side by side in this codebase and are **intentionally** different colors — this is a rule, not an inconsistency to fix:

- **`primary` green (`#2d602f`)** = **selecting** an item (choosing it for a batch action, e.g. adding to a meal plan). See `RecipeCard`'s select circle and the freezer-item select circle in `RecipeSelectionScreen`.
- **`tertiary` accent orange (`#e07a34`)** = **marking an item done** (completed/acquired). See the shopping-list checkbox in `ShoppingListScreen`.

When adding a new check/tick-style circle, pick the color based on which of these two meanings it represents, not by copying whichever one is visually closest. Toggle-switch widgets (the pill-with-sliding-thumb pattern, e.g. `NewRecipeForm`'s attribute toggles and `FreezerScreen`'s in-stock toggle) are a distinct affordance from this circle pattern and are not bound by this rule — they currently use `primary` green regardless of whether the boolean they represent reads as "selected" or "possessed/done."

## Where the truth lives

There is no separate stylesheet to read — every component's exact styling is in its own source, one file per component (readable via the bound `.d.ts`/`.prompt.md` and the compiled bundle). `RecipeCard` and `RecipeBucket` are the most representative composite examples of the color/spacing/typography idiom above; the smaller primitives (`Btn`, `PillBtn`, `CapLabel`, `SecHead`, `HDivider`, `Spinner`, `TodayTag`, `Stepper`) each demonstrate one piece of it in isolation.

## Idiomatic build snippet

```jsx
import { Btn, RecipeCard, CapLabel } from '5-minutes-to-dinner'

function MealRow({ recipe, selected, onToggle }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <RecipeCard r={recipe} selected={selected} onToggle={onToggle} />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn label="Add Selected" onClick={() => {}} />
      </div>
    </div>
  )
}
```
