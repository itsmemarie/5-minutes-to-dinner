// ─── Who is calling? ──────────────────────────────────────────────
// The owner is decided here and only here: a JWT that Supabase Auth verifies,
// whose confirmed email matches the OWNER_EMAIL secret. Nothing the client
// says about itself (flags, headers, body fields) is trusted.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const OWNER_EMAIL = (Deno.env.get('OWNER_EMAIL') ?? '').trim().toLowerCase()

let admin: SupabaseClient | null = null
export const serviceClient = () =>
  (admin ??= createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }))

export interface Caller { signedIn: boolean; email: string | null; isOwner: boolean }
const ANONYMOUS: Caller = { signedIn: false, email: null, isOwner: false }

export async function getCaller(req: Request): Promise<Caller> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  // Signed-out requests carry the anon key (or nothing): skip the Auth round trip.
  if (!token || token === ANON_KEY || token.split('.').length !== 3) return ANONYMOUS
  const { data, error } = await serviceClient().auth.getUser(token)
  if (error || !data?.user) return ANONYMOUS
  const email = data.user.email?.trim().toLowerCase() ?? null
  const isOwner = !!OWNER_EMAIL && email === OWNER_EMAIL && !!data.user.email_confirmed_at
  return { signedIn: true, email, isOwner }
}
