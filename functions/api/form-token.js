// Issues a short-lived signed token that every lavaluepro.com form submits.
// Scripts that POST straight at /api/request never fetch one, which is the
// strongest single signal separating bots from people.

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ env }) {
  const secret = env.FORM_SECRET || env.RESEND_API_KEY || 'lavaluepro-fallback';
  const ts = Date.now();
  const nonce = crypto.randomUUID();
  const sig = await hmac(secret, `${ts}.${nonce}`);
  return new Response(JSON.stringify({ token: `${ts}.${nonce}.${sig}` }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
