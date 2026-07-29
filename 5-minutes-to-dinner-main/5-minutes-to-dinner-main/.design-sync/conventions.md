## Wrapping and setup

No provider or root wrapper is required — every component is a plain function that renders inline-styled DOM, with no context/theme dependency. Just import and use.

**Fonts — load these yourself, they do not ship with the bundle.** This kit uses two Google Fonts, loaded via a `<link>` tag, not shipped as files or `@font-face` rules:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

- **Epilogue** (600/700 weight) — headings, prices/numbers, titles.
- **Manrope** (400–700 weight) — everything else: body copy, labels, buttons.

Without this link, every component falls back to the browser's default sans-serif.

## The styling idiom

**No CSS classes — this kit styles entirely via inline `style` props driven by JS constants**, not Tailwind/CSS-modules/styled-components. There is no exported stylesheet and no class vocabulary to reuse. When building new layout/glue around these components, match the idiom by using inline styles with the same color and spacing values (do not introduce a CSS-class-based system alongside it — it will look inconsistent).

Color palette actually in use (hex — these are not exported constants, just the values baked into each component; match them literally when composing new surrounding UI):

| Role | Hex | Used for |
|---|---|---|
| `primary` | `#004440` | Primary buttons, active pills, headings on dark, borders |
| `onPrimary` | `#fff` | Text/icons on primary fill |
| `primaryFixed` | `#b1eee8` | Light accent chips (e.g. scale badges) |
| `secondaryContainer` | `#dae4e4` | Secondary button fill, inactive pill fill |
| `onSecondaryContainer` | `#5c6666` | Text on secondaryContainer |
| `tertiaryFixed` | `#ffddb9` | "Today" tag background |
| `onTertiaryFixed` | `#2b1700` | Text on tertiaryFixed |
| `error` | `#ba1a1a` | Error/delete affordances |
| `errorContainer` | `#ffdad6` | Error banners |
| `surface` | `#f9f9f9` | Page/app background |
| `surfaceContainerHigh` | `#e8e8e7` | Track backgrounds (e.g. Stepper pill), disabled fills |
| `onSurface` | `#1a1c1c` | Primary text |
| `onSurfaceVariant` | `#3f4947` | Secondary/muted text, uppercase captions |
| `outline` / `outlineVariant` | `#707977` / `#bfc8c7` | Borders, dividers |

Common patterns: 16px border-radius + `0 2px 20px rgba(0,68,64,0.06)` box-shadow for cards; 99px (pill) border-radius for buttons/badges/tags; uppercase + `0.06–0.08em` letter-spacing for small caption/label text.

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
