import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SKIP_NAMES = ["test", "sugar", "3 avocado"];

const STOP = new Set([
  "grandma's","grandma","great","riccarda's","tin's","chappy","classic","homemade",
  "michelin-style","thermomix","and","with","the","a","of","in","on","for","style",
  "easy","quick","best","basic","simple","fresh","delicious","my","our","ingelomi",
  "spread","dish","recipe","traybake","bake","5",
]);

const NEGATIVE = [
  "raw","uncooked","cutting board","chopping board","ingredients","hands","hand ",
  "peeling","peelings","knife","flour","dough","market","grocery","harvest",
  "garden","field","plant","growing","farm","basket","crate","seeds","butcher",
  "preparing","preparation","unpeeled","pile of","raw eggs","smoothie","drink",
  "juice","cocktail","glass of",
];

const POSITIVE = [
  "plate","plated","bowl","served","serving","dish","meal","restaurant",
  "garnished","cooked","roasted","grilled","baked","creamy","gourmet",
  "top view of","from above of","appetizing","tasty","cuisine","traditional",
];

function contentWords(name: string): string[] {
  const q = name.split("|")[0].trim().replace(/\([^)]*\)/g, " ");
  return q.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function buildQuery(name: string): string {
  const q = name.split("|")[0].trim().replace(/\([^)]*\)/g, " ");
  const words = q.split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase()));
  return words.join(" ").split(/\s+/).slice(0, 6).join(" ");
}

function altMentions(a: string, w: string): boolean {
  if (a.includes(w)) return true;
  if (w.endsWith("s") && a.includes(w.slice(0, -1))) return true;
  if (!w.endsWith("s") && a.includes(w + "s")) return true;
  if (w.endsWith("es") && a.includes(w.slice(0, -2))) return true;
  return false;
}

function scorePhoto(alt: string, keywords: string[]) {
  const a = (alt ?? "").toLowerCase();
  if (!a) return { score: -99, hits: 0 };
  let score = 0, hits = 0;
  for (const n of NEGATIVE) if (a.includes(n)) score -= 3;
  for (const p of POSITIVE) if (a.includes(p)) score += 2;
  for (const k of keywords) if (altMentions(a, k)) { hits++; score += 4; }
  return { score, hits };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
    const key = Deno.env.get("PEXELS_API_KEY");
    if (!key) return new Response(JSON.stringify({ error: "PEXELS_API_KEY not set" }), { status: 400 });

    let limit = 20, minScore = 4;
    try {
      const b = await req.json();
      if (Number.isInteger(b?.limit)) limit = Math.min(b.limit, 40);
      if (Number.isInteger(b?.min_score)) minScore = b.min_score;
    } catch (_) {}

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: recipes, error: qErr } = await supabase
      .from("recipes").select("id, name").is("image_path", null).order("name").limit(limit);
    if (qErr) return new Response(JSON.stringify({ error: qErr.message }), { status: 500 });

    const report: Array<Record<string, unknown>> = [];
    let ok = 0, gaps = 0, failed = 0, rateLimited = false;

    for (const r of recipes ?? []) {
      const plain = r.name.split("|")[0].trim();
      if (SKIP_NAMES.includes(plain.toLowerCase())) { report.push({ id: r.id, name: plain, status: "skipped" }); continue; }

      const keywords = contentWords(r.name);
      // Require 2 keyword hits when the name has enough words to support it
      const requiredHits = keywords.length >= 2 ? 2 : 1;
      const base = buildQuery(r.name);
      let best: any = null;

      try {
        for (const q of [base, `${base} plated`]) {
          const res = await fetch(
            `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=15&orientation=landscape`,
            { headers: { Authorization: key } });
          if (res.status === 429) { rateLimited = true; break; }
          if (!res.ok) continue;
          const data = await res.json();
          for (const p of data?.photos ?? []) {
            const { score, hits } = scorePhoto(p.alt, keywords);
            if (hits < requiredHits) continue;
            if (!best || score > best.score) best = { photo: p, score, hits, query: q };
          }
          if (best && best.score >= minScore) break;
          await new Promise((x) => setTimeout(x, 150));
        }
        if (rateLimited) { report.push({ id: r.id, name: plain, status: "rate_limited" }); break; }

        if (!best || best.score < minScore) {
          report.push({ id: r.id, name: plain, query: base, keywords: keywords.join(","), status: "no_match" });
          gaps++; continue;
        }

        const photo = best.photo;
        const imgRes = await fetch(photo.src.large2x ?? photo.src.large);
        if (!imgRes.ok) { failed++; report.push({ id: r.id, name: plain, status: "img_fetch_fail" }); continue; }
        const bytes = new Uint8Array(await imgRes.arrayBuffer());

        const { error: upErr } = await supabase.storage.from("recipe-images")
          .upload(`${r.id}.jpg`, bytes, { contentType: "image/jpeg", upsert: true });
        if (upErr) { failed++; report.push({ id: r.id, name: plain, status: "upload_err" }); continue; }

        const { error: dbErr } = await supabase.from("recipes").update({
          image_path: `${r.id}.jpg`, image_credit: `Photo by ${photo.photographer} on Pexels`, image_source: "stock",
        }).eq("id", r.id);
        if (dbErr) { failed++; report.push({ id: r.id, name: plain, status: "db_err" }); continue; }

        report.push({ id: r.id, name: plain, score: best.score, hits: best.hits, v: 5,
          alt: (photo.alt ?? "").slice(0, 80), status: "ok" });
        ok++;
        await new Promise((x) => setTimeout(x, 150));
      } catch (e) {
        failed++; report.push({ id: r.id, name: plain, status: `error: ${String(e).slice(0, 60)}` });
      }
    }

    if (report.length) {
      await supabase.from("image_fill_log").insert(report.map((row) => ({ recipe_id: row.id as string, detail: row })));
    }
    const { count } = await supabase.from("recipes").select("id", { count: "exact", head: true }).is("image_path", null);
    return new Response(JSON.stringify({ processed: report.length, ok, no_match: gaps, failed, rate_limited: rateLimited, remaining_without_image: count }),
      { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
