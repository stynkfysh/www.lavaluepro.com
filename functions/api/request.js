// lavaluepro.com — appraisal requests and contact messages.
// Sends a notification through the brianward.com Resend account (the only
// verified sender domain) and, for clean submissions, a confirmation to the
// person who wrote in. Same-origin only; spam is scored, not hard-failed.
//
// Environment (Cloudflare Pages > Settings > Variables):
//   RESEND_API_KEY  required
//   FORM_SECRET     optional (falls back to RESEND_API_KEY)
//   NOTIFY_TO       optional, default orders@date-of-death.com
//   RESEND_FROM     optional, default "LA Value Pro <contact@brianward.com>"

const SITE = 'lavaluepro.com';
const REPLY_TO = 'contact@lavaluepro.com';

const PURPOSES = {
  'date-of-death': 'Date of death / step-up in basis',
  'step-up': 'Step-up in basis',
  trust: 'Trust administration or distribution',
  estate: 'Estate settlement or estate tax (Form 706)',
  'gift-tax': 'Gift tax (Form 709)',
  'prop-19': 'Prop 19 parent-child transfer',
  divorce: 'Divorce / date of separation',
  'family-sale': 'Family sale or co-owner buyout',
  other: 'Other',
};
const TIERS = { standard: 'Standard Desktop — $449', basic: 'Basic Desktop — $299', unsure: 'Not sure — recommend one' };
const ROLES = {
  heir: 'Heir / beneficiary', trustee: 'Trustee', executor: 'Executor / administrator', attorney: 'Attorney',
  cpa: 'CPA / tax professional', owner: 'Owner', spouse: 'Spouse / party to divorce', other: 'Other',
};
const TYPES = { sfr: 'Single-family home', condo: 'Condominium / townhome' };

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function clip(s, n) { return String(s == null ? '' : s).slice(0, n); }

function allowedOrigin(origin, host) {
  if (!origin) return false;
  try {
    const o = new URL(origin);
    return o.host === host || o.hostname === 'lavaluepro.com' || o.hostname === 'www.lavaluepro.com' ||
      o.hostname.endsWith('.pages.dev');
  } catch (e) { return false; }
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function tokenAge(token, env) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [ts, nonce, sig] = parts;
  const expect = await hmac(env.FORM_SECRET || env.RESEND_API_KEY || 'lavaluepro-fallback', `${ts}.${nonce}`);
  if (sig !== expect) return null;
  const age = Date.now() - Number(ts);
  return age >= 0 && age < 6 * 3600 * 1000 ? age : null;
}

// Returns 'clean' | 'suspect' | 'spam'
function score(b, tokenOk, dwellMs) {
  let s = 0; const why = [];
  if (b.website || b.company_url) return { verdict: 'spam', why: ['honeypot'] };
  if (!tokenOk) { s += 2; why.push('no valid token'); }
  if (dwellMs != null && dwellMs < 4000) { s += 3; why.push('submitted too fast'); }
  const text = [b.name, b.notes, b.message, b.address].join(' ');
  const links = (text.match(/https?:\/\/|www\./gi) || []).length;
  if (links >= 2) { s += 3; why.push('links'); } else if (links === 1) { s += 1; why.push('link'); }
  if (/\b(seo|backlink|crypto|casino|viagra|loan offer|guest post|web design|ranking)\b/i.test(text)) { s += 3; why.push('spam terms'); }
  if (b.name && /[A-Z]{12,}|\d{6,}/.test(b.name)) { s += 1; why.push('odd name'); }
  if (s >= 5) return { verdict: 'spam', why };
  if (s >= 2) return { verdict: 'suspect', why };
  return { verdict: 'clean', why };
}

function rows(list) {
  return list.filter(r => r[1]).map(r =>
    `<tr><td style="padding:7px 12px;font-weight:600;width:170px;vertical-align:top;color:#4a4860">${esc(r[0])}</td><td style="padding:7px 12px">${esc(r[1])}</td></tr>`).join('');
}
function shell(title, inner) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;color:#1d1b2b">
<h2 style="color:#3f2f7a;border-bottom:3px solid #5a45a3;padding-bottom:10px">${esc(title)}</h2>${inner}</body></html>`;
}

async function send(env, { to, subject, html, replyTo }) {
  if (!env.RESEND_API_KEY) throw new Error('Email service not configured');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.RESEND_FROM || 'LA Value Pro <contact@brianward.com>',
      to: [to], reply_to: replyTo, subject, html,
    }),
  });
  if (!r.ok) { console.error('Resend error', await r.text()); throw new Error('Email send failed'); }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  if (!allowedOrigin(request.headers.get('Origin'), url.host)) return json({ error: 'Forbidden.' }, 403);

  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'Invalid request.' }, 400); }
  for (const k of Object.keys(b)) if (typeof b[k] === 'string') b[k] = clip(b[k].trim(), 4000);

  const type = b.formType === 'contact' ? 'contact' : (b.formType === 'order' ? 'order' : null);
  if (!type) return json({ error: 'Unknown form.' }, 400);
  if (!b.name || !b.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return json({ error: 'Please enter your name and a valid email address.' }, 400);
  if (type === 'order' && (!b.address || !b.purpose)) return json({ error: 'Please add the property address and the purpose.' }, 400);

  const age = await tokenAge(b._token, env);
  const dwell = age != null ? age : (b._ts ? Date.now() - Number(b._ts) : null);
  const { verdict, why } = score(b, age != null, dwell);
  if (verdict === 'spam') {
    console.log(JSON.stringify({ blocked: true, site: SITE, type, email: b.email, why }));
    return json({ success: true });
  }
  const flag = verdict === 'suspect' ? '[POSSIBLE SPAM] ' : '';
  const notifyTo = env.NOTIFY_TO || 'orders@date-of-death.com';

  try {
    if (type === 'order') {
      const where = [b.address, b.city, b.zip].filter(Boolean).join(', ');
      const details = [
        ['Property', where], ['Property type', TYPES[b.property_type] || b.property_type],
        ['Report', TIERS[b.tier] || b.tier], ['Purpose', PURPOSES[b.purpose] || b.purpose],
        ['Effective date', b.effective_date || 'Current value'], ['Notes', b.notes],
      ];
      const contact = [['Name', b.name], ['Email', b.email], ['Phone', b.phone], ['Role', ROLES[b.role] || b.role]];
      const inner = `<p style="background:#5a45a3;color:#fff;padding:10px 14px;border-radius:4px">Submitted from <strong>${SITE}</strong>${b.page ? ' (' + esc(b.page) + ')' : ''}</p>
<h3 style="color:#4a4860">Appraisal</h3><table style="width:100%;border-collapse:collapse">${rows(details)}</table>
<h3 style="color:#4a4860">Contact</h3><table style="width:100%;border-collapse:collapse">${rows(contact)}</table>
${flag ? `<p style="color:#b3261e">Spam check: ${esc(why.join(', '))}</p>` : ''}
<p style="color:#888;font-size:13px">Reply to this email to answer the client directly.</p>`;
      await send(env, { to: notifyTo, subject: `${flag}[${SITE}] New Appraisal Request — ${clip(where, 120)}`, html: shell('New appraisal request', inner), replyTo: b.email });
      if (verdict === 'clean') {
        try {
          await send(env, {
            to: b.email, replyTo: REPLY_TO,
            subject: 'We received your appraisal request — LA Value Pro',
            html: shell('We received your request', `<p>Hi ${esc(b.name.split(' ')[0])},</p>
<p>Thank you for your appraisal request through <strong>lavaluepro.com</strong>. Brian will review the property and email a confirmation with a secure invoice within one business day. The report is delivered in 3+ business days.</p>
<table style="width:100%;border-collapse:collapse;background:#f6f3fc">${rows(details)}</table>
<p style="margin-top:22px">Thank you,<br><strong>Brian Ward</strong><br>California Certified Residential Real Estate Appraiser, License AR036053<br>LA Value Pro &middot; contact@lavaluepro.com</p>
<p style="color:#888;font-size:13px">This automatic confirmation means your request arrived; there is no need to submit it again. Reply to this email with any questions.</p>`),
          });
        } catch (e) { console.error('auto-reply failed', e.message); }
      }
    } else {
      const details = [['Name', b.name], ['Email', b.email], ['Phone', b.phone], ['Property', b.address], ['Message', b.message]];
      await send(env, {
        to: notifyTo, replyTo: b.email, subject: `${flag}[${SITE}] Question from ${clip(b.name, 80)}`,
        html: shell('New message', `<p style="background:#5a45a3;color:#fff;padding:10px 14px;border-radius:4px">Submitted from <strong>${SITE}</strong></p><table style="width:100%;border-collapse:collapse">${rows(details)}</table>${flag ? `<p style="color:#b3261e">Spam check: ${esc(why.join(', '))}</p>` : ''}`),
      });
      if (verdict === 'clean') {
        try {
          await send(env, {
            to: b.email, replyTo: REPLY_TO, subject: 'We received your message — LA Value Pro',
            html: shell('We received your message', `<p>Hi ${esc(b.name.split(' ')[0])},</p><p>Thanks for writing to LA Value Pro. We will reply by email within one business day.</p><table style="width:100%;border-collapse:collapse;background:#f6f3fc">${rows(details)}</table><p style="margin-top:22px">Brian Ward<br>LA Value Pro &middot; contact@lavaluepro.com</p>`),
          });
        } catch (e) { console.error('auto-reply failed', e.message); }
      }
    }
    return json({ success: true });
  } catch (err) {
    console.error('submit error', err.message);
    return json({ error: 'Your request could not be sent.' }, 502);
  }
}

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  return json({ error: 'Method not allowed.' }, 405);
}
