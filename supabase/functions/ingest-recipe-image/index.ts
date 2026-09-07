import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_HOSTS = [
  "images.pexels.com",
  "images.unsplash.com",
  "plus.unsplash.com",
];

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
    }

    const { recipe_id, image_url, credit, source } = await req.json();

    if (!recipe_id || !image_url) {
      return new Response(JSON.stringify({ error: "recipe_id and image_url required" }), { status: 400 });
    }

    const url = new URL(image_url);
    if (!ALLOWED_HOSTS.includes(url.hostname)) {
      return new Response(JSON.stringify({ error: `host not allowed: ${url.hostname}` }), { status: 400 });
    }

    // Fetch the image
    const imgRes = await fetch(image_url);
    if (!imgRes.ok) {
      return new Response(JSON.stringify({ error: `fetch failed: ${imgRes.status}` }), { status: 502 });
    }
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return new Response(JSON.stringify({ error: `not an image: ${contentType}` }), { status: 400 });
    }
    const bytes = new Uint8Array(await imgRes.arrayBuffer());

    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const path = `${recipe_id}.${ext}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: upErr } = await supabase.storage
      .from("recipe-images")
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) {
      return new Response(JSON.stringify({ error: `upload: ${upErr.message}` }), { status: 500 });
    }

    const { error: dbErr } = await supabase
      .from("recipes")
      .update({
        image_path: path,
        image_credit: credit ?? null,
        image_source: source ?? "stock",
      })
      .eq("id", recipe_id);
    if (dbErr) {
      return new Response(JSON.stringify({ error: `db: ${dbErr.message}` }), { status: 500 });
    }

    return new Response(
      JSON.stringify({ ok: true, recipe_id, path, bytes: bytes.length }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
