import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // All files currently in the bucket
    const { data: files, error: lErr } = await supabase.storage
      .from("recipe-images").list("", { limit: 1000 });
    if (lErr) return new Response(JSON.stringify({ error: lErr.message }), { status: 500 });

    // All image_path values still referenced by recipes
    const { data: rows, error: rErr } = await supabase
      .from("recipes").select("image_path").not("image_path", "is", null);
    if (rErr) return new Response(JSON.stringify({ error: rErr.message }), { status: 500 });

    const referenced = new Set((rows ?? []).map((r: any) => r.image_path));
    const orphans = (files ?? []).map((f: any) => f.name).filter((n: string) => !referenced.has(n));

    if (orphans.length === 0) {
      return new Response(JSON.stringify({ deleted: 0, orphans: [] }), { headers: { "Content-Type": "application/json" } });
    }

    const { error: dErr } = await supabase.storage.from("recipe-images").remove(orphans);
    if (dErr) return new Response(JSON.stringify({ error: dErr.message }), { status: 500 });

    return new Response(JSON.stringify({ deleted: orphans.length, orphans }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
