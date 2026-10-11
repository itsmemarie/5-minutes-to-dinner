// CORS for every browser-called function. `x-gemini-key` carries a user's own
// Google AI key (kept on their device, never stored server-side); the x-ai-*
// response headers report which provider/model answered, for the owner's
// model comparison view.
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-gemini-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'x-ai-step, x-ai-provider, x-ai-model, x-ai-ms, x-ai-tokens-in, x-ai-tokens-out',
}
