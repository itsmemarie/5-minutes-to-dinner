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

    // Two ways in: a stock `image_url` (allow-listed hosts), or `image_base64`,
    // a photo the user took/chose in the app (already resized on the device).
    const { recipe_id, image_url, image_base64, content_type, credit, source } = await req.json();

    if (!recipe_id || (!image_url && !image_base64)) {
      return new Response(JSON.stringify({ error: "recipe_id and image_url or image_base64 required" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let contentType: string;
    let bytes: Uint8Array;
    const uploaded = !!image_base64;

    if (uploaded) {
      contentType = content_type ?? "image/jpeg";
      if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
        return new Response(JSON.stringify({ error: `not a supported image: ${contentType}` }), { status: 400 });
      }
      // ~3 MB of bytes is base64 of ~4 MB; the app sends well under 1 MB.
      if (image_base64.length > 4_000_000) {
        return new Response(JSON.stringify({ error: "photo too large" }), { status: 413 });
      }
      bytes = Uint8Array.from(atob(image_base64), (c) => c.charCodeAt(0));
    } else {
      const url = new URL(image_url);
      if (!ALLOWED_HOSTS.includes(url.hostname)) {
        return new Response(JSON.stringify({ error: `host not allowed: ${url.hostname}` }), { status: 400 });
      }
      const imgRes = await fetch(image_url);
      if (!imgRes.ok) {
        return new Response(JSON.stringify({ error: `fetch failed: ${imgRes.status}` }), { status: 502 });
      }
      contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
      if (!contentType.startsWith("image/")) {
        return new Response(JSON.stringify({ error: `not an image: ${contentType}` }), { status: 400 });
      }
      bytes = new Uint8Array(await imgRes.arrayBuffer());
    }

    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    // User photos get a versioned key so a replacement never serves from a
    // cached copy of the old file at the same URL. Stock images keep `<id>.<ext>`.
    const path = uploaded ? `${recipe_id}-${Date.now()}.${ext}` : `${recipe_id}.${ext}`;

    const { data: prev } = await supabase.from("recipes").select("image_path").eq("id", recipe_id).maybeSingle();

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
        image_source: source ?? (uploaded ? "user" : "stock"),
      })
      .eq("id", recipe_id);
    if (dbErr) {
      return new Response(JSON.stringify({ error: `db: ${dbErr.message}` }), { status: 500 });
    }

    // The row now points at the new file; drop the one it replaced.
    if (prev?.image_path && prev.image_path !== path && !/^https?:\/\//.test(prev.image_path)) {
      await supabase.storage.from("recipe-images").remove([prev.image_path]);
    }

    return new Response(
      JSON.stringify({ ok: true, recipe_id, path, bytes: bytes.length }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
