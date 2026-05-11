# 5 Minutes to Dinner

Your personal meal planning app — connected to Supabase, deployed on Vercel.

---

## Step 2 — Push to GitHub

1. Go to **github.com** → sign up (free) or log in
2. Click **New repository** → name it `5-minutes-to-dinner` → click **Create repository**
3. On your computer, open Terminal and run:

```bash
# Navigate to this folder
cd path/to/5-minutes-to-dinner

# Initialise git and push
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/5-minutes-to-dinner.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 3 — Deploy on Vercel

1. Go to **vercel.com** → sign up with your GitHub account
2. Click **Add New Project**
3. Select your `5-minutes-to-dinner` repository → click **Import**
4. Under **Environment Variables**, add these two:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://chcjytxvpvhzdgvwllss.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (your full anon key) |

5. Click **Deploy**

Your app will be live at `https://5-minutes-to-dinner.vercel.app` in ~2 minutes.

---

## Running locally (optional)

```bash
npm install
npm run dev
```

Then open http://localhost:5173

---

## Your data

- **Recipes** — live from Supabase (149 recipes already loaded)
- **Meal plans** — saved per week, real-time
- **Ratings** — persisted per meal
- **Shopping lists** — saved and syncable across devices

To export everything: go to **supabase.com** → your project → Table Editor → any table → Export as CSV.
