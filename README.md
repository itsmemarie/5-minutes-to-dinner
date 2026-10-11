# 5 Minutes to Dinner

A meal-planning PWA: plan the week, generate a shopping list, batch-cook, and import recipes from a link, a photo or pasted text. React + Vite on **Vercel**; data and every AI call on **Supabase** (Postgres + Edge Functions).

## How AI access works

| Who | Signed in as | AI used |
|---|---|---|
| **Owner** | the email in `OWNER_EMAIL` | Claude on the owner's Anthropic key by default, plus **Settings › AI models** to choose Claude / Groq / Gemini and the model for each step |
| **Everyone else** | signed out, or any other email | 1. Groq on the owner's key → 2. their own free Google AI key, if added → 3. manual entry |

- The server decides who the owner is: `supabase/functions/_shared/auth.ts` checks the verified sign-in email against `OWNER_EMAIL`. The client can't claim it.
- Manual entry always works without AI. When Groq is busy, the app offers the "Add your free Google key" flow. If that key is out too, it says so and the user carries on by hand.
- A user's Google key stays in their browser. It's sent with each request and never stored on the server.
- Recipes are imported in three steps:
  1. **Extract**: a 1:1 transcription. For links, the page's own recipe data is read first, with no AI at all.
  2. **Fill in the gaps**: an optional button. Every added field is marked "Added by AI".
  3. **Expert review**: an optional button. Each suggestion is applied or skipped on its own, and warnings take account of the household's kitchen equipment and children.
- To keep costs down, photos are cropped, resized to 1024px, made grayscale and saved as JPEG at quality 70 on the device before upload. Prompts are kept small.

## Environment variables

| Name | Where it goes | What it is |
|---|---|---|
| `VITE_SUPABASE_URL` | Vercel + local `.env` | Supabase project URL (public) |
| `VITE_SUPABASE_ANON_KEY` | Vercel + local `.env` | Supabase anon key (public) |
| `OWNER_EMAIL` | Supabase secret | The owner's sign-in email |
| `ANTHROPIC_API_KEY` | Supabase secret (optional) | Owner's Claude API key, billed per use (a Claude subscription does not work). Leave it out and the owner uses the free Groq setup |
| `GROQ_API_KEY` | Supabase secret | Owner's Groq key, the free default for everyone else |
| `GEMINI_MODEL` | Supabase secret (optional) | Model for users' own Google keys. Default `gemini-2.5-flash` |

The secrets are never `VITE_`-prefixed, so they can't end up in the browser bundle. Edge Functions get `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` automatically.

## Deploying

Do these in order: database → secrets → functions → auth settings → frontend. Project ref: `chcjytxvpvhzdgvwllss`.

1. **Database.** Run `supabase/migrations/20261010120000_ai_access_and_equipment.sql`, either in the Supabase SQL editor or with `npx supabase db push`. It adds the owner's model-choice table (RLS on, server-only) and the kitchen-equipment setting.
2. **Secrets.**
   ```bash
   npx supabase secrets set --project-ref chcjytxvpvhzdgvwllss OWNER_EMAIL=you@example.com ANTHROPIC_API_KEY=sk-ant-... GROQ_API_KEY=gsk_...
   ```
3. **Edge Functions.** These check the caller themselves, so they're deployed without gateway JWT checks, as before:
   ```bash
   npx supabase functions deploy --project-ref chcjytxvpvhzdgvwllss --no-verify-jwt \
     ai-config extract-recipe complete-recipe review-recipe generate-recipe extract-freezer-items \
     shopping-list nutrition batch-cooking buyers-eye toddler-cooking recipe-toddler-task
   ```
   Don't deploy the image functions (`bulk-image-fill`, `ingest-recipe-image`, `cleanup-orphan-images`) with `--no-verify-jwt`: they must keep JWT checks on.
4. **Auth settings** (Supabase dashboard › Authentication):
   - URL Configuration: set Site URL to the live app (e.g. `https://5-minutes-to-dinner.vercel.app`) and add it under Redirect URLs.
   - Email Templates › Magic Link: the default link-only template works. Open the link on the device you're signing in on. (An installed iPhone app can't receive a link opened in Safari, so sign in from a normal Safari tab there.)
5. **Frontend.** Push to `main` and Vercel deploys it. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set in Vercel.

## Sharing into the app

Install the app on Android (or desktop Chrome/Edge) and it appears in the share sheet: links, text and photos. `public/sw.js` receives the share, and everything goes through `handleIncomingShare()` (`src/lib/share/`). iPhone needs a native wrapper; see [NATIVE_SHARING.md](NATIVE_SHARING.md).

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # app + edge-function unit tests (vitest)
# type-check the Edge Functions:
DENO_NO_PACKAGE_JSON=1 npx deno@2 check --node-modules-dir=none supabase/functions/*/index.ts
```

## Known gaps

- Signing in identifies the owner. It doesn't separate data: everyone shares one meal plan and recipe list, and row-level security is off on the app's tables.
- The free AI path uses the owner's Groq key, and anyone who can reach the app can use it until Groq's limits kick in.

## Your data

Recipes, meal plans and shopping lists live in Supabase. To export, use Settings › Your data › Export all recipes, or Supabase › Table Editor › Export as CSV.
