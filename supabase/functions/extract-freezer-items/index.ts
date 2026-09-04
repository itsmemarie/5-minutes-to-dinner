const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GROQ_KEY = Deno.env.get('GROQ_API_KEY') ?? ''
const VISION_MODEL = 'qwen/qwen3.6-27b'

const SYSTEM = `You are extracting an inventory list from a photo. The photo may show a handwritten or printed list, or labeled freezer bags/containers.
Extract every distinct item name visible across all provided photos and return ONLY a raw JSON array of strings — no markdown fences, no explanation, no wrapper object, just the array. Combine items from all images into one flat array. Skip quantities, dates, and non-food text unless they're part of the item's name.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  if (!GROQ_KEY) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY secret is not configured on this project' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { images } = await req.json()
    if (!images || !images.length) {
      return new Response(JSON.stringify({ error: 'Provide images' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const userContent = [
      ...images.map((img: { base64: string; mediaType?: string }) => ({
        type: 'image_url',
        image_url: { url: `data:${img.mediaType ?? 'image/jpeg'};base64,${img.base64}` },
      })),
      { type: 'text', text: images.length > 1
        ? 'These images are multiple photos of freezer inventory (list pages or labeled containers). Extract all item names across all of them and return the JSON array.'
        : 'Extract the freezer item names from this image and return the JSON array.' },
    ]

    const apiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 2048,
        reasoning_effort: 'none',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userContent },
        ],
      }),
    })

    if (!apiRes.ok) {
      const errText = await apiRes.text()
      return new Response(JSON.stringify({ error: `Groq error: ${errText}` }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const groqData = await apiRes.json()
    const raw: string = groqData.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/gi, '')

    const arrMatch = raw.match(/\[[\s\S]*\]/)
    if (arrMatch) {
      const parsed = JSON.parse(arrMatch[0])
      const items = parsed.filter((x: unknown) => typeof x === 'string' && x.trim()).map((x: string) => x.trim())
      return new Response(JSON.stringify({ items }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    const objMatch = raw.match(/\{[\s\S]*\}/)
    if (objMatch) {
      const parsed = JSON.parse(objMatch[0])
      if (Array.isArray(parsed.items)) {
        const items = parsed.items.filter((x: unknown) => typeof x === 'string' && x.trim()).map((x: string) => x.trim())
        return new Response(JSON.stringify({ items }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
      }
    }
    return new Response(JSON.stringify({ error: 'Could not parse freezer items from AI response' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
