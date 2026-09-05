import { formatDate, formatTime, validateReservation } from '../shared/reservations.js';

const SUCCESS_MESSAGE = 'Thank you. Your reservation request has been sent to Joy Café. If there are any issues with your reservation, our team will get in touch.';
const PUBLIC_ERROR = 'We could not send your reservation request. Please try again or call Joy Café on 01763 230140.';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const googleWebhookConfigured = (env) => /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(env.GOOGLE_APPS_SCRIPT_URL || '') && String(env.GOOGLE_APPS_SCRIPT_SECRET || '').length >= 32;

export function buildReservationEmail(value) {
  const date = formatDate(value.date);
  const time = formatTime(value.time);
  const requests = value.requests || 'None provided';
  const rows = [
    ['Name', value.name], ['Number of people', value.partySize], ['Date', date], ['Time', time],
    ['Email', value.email], ['Phone', value.phone], ['Dietaries, allergies or special requests', requests]
  ];
  const text = ['New table reservation request', '', ...rows.map(([label, entry]) => `${label}: ${entry}`), '', 'This is a reservation request, not an automatic confirmation.'].join('\n');
  const htmlRows = rows.map(([label, entry]) => `<tr><th style="padding:10px 14px;text-align:left;vertical-align:top;border-bottom:1px solid #deded8">${escapeHtml(label)}</th><td style="padding:10px 14px;border-bottom:1px solid #deded8;white-space:pre-wrap">${escapeHtml(entry)}</td></tr>`).join('');
  return {
    to: 'steff@joycafe28.com',
    from: { email: 'bookings@joycafe28.com', name: 'Joy Website Reservations' },
    replyTo: value.email,
    subject: `New table reservation request: ${value.name}, ${value.date} at ${value.time}`,
    text,
    html: `<div style="font-family:Arial,sans-serif;color:#272a22;max-width:680px"><h1 style="font-size:24px">New table reservation request</h1><table style="width:100%;border-collapse:collapse">${htmlRows}</table><p style="margin-top:18px"><strong>This is a reservation request, not an automatic confirmation.</strong></p></div>`
  };
}

async function verifyTurnstile(token, request, secret, fetcher) {
  if (!secret) return false;
  const remoteip = request.headers.get('X-Client-IP') || request.headers.get('CF-Connecting-IP') || undefined;
  const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip, idempotency_key: crypto.randomUUID() })
  });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true && (!result.action || result.action === 'reservation_request');
}

async function sendViaGoogleAppsScript(value, env, fetcher) {
  const response = await fetcher(env.GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({
      secret: env.GOOGLE_APPS_SCRIPT_SECRET,
      reservation: {
        name: value.name,
        partySize: value.partySize,
        date: value.date,
        dateLabel: formatDate(value.date),
        time: value.time,
        timeLabel: formatTime(value.time),
        email: value.email,
        phone: value.phone,
        requests: value.requests || ''
      }
    }),
    redirect: 'follow'
  });
  if (!response.ok) throw new Error('google_webhook_http_error');
  const result = await response.json().catch(() => null);
  if (!result?.ok) throw new Error('google_webhook_rejected');
  return result;
}

export async function handleReservation(request, env, runtime = { fetch }) {
  if (request.method === 'GET') {
    return json({ enabled: Boolean(env.TURNSTILE_SITE_KEY && googleWebhookConfigured(env)), siteKey: env.TURNSTILE_SITE_KEY || null });
  }
  if (request.method !== 'POST') return json({ ok: false, message: PUBLIC_ERROR }, 405);
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 16_384) return json({ ok: false, message: PUBLIC_ERROR }, 413);
  if (!googleWebhookConfigured(env) || !env.TURNSTILE_SECRET_KEY) return json({ ok: false, message: PUBLIC_ERROR }, 503);

  const ip = request.headers.get('X-Client-IP') || request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.BOOKING_RATE_LIMITER?.limit) {
    const rate = await env.BOOKING_RATE_LIMITER.limit({ key: ip });
    if (!rate.success) return json({ ok: false, message: PUBLIC_ERROR }, 429);
  }

  let input;
  try { input = await request.json(); } catch { return json({ ok: false, message: PUBLIC_ERROR }, 400); }
  if (JSON.stringify(input).length > 16_384) return json({ ok: false, message: PUBLIC_ERROR }, 413);
  const validation = validateReservation(input, { now: runtime.now || new Date() });
  if (validation.value.website) return json({ ok: true, message: SUCCESS_MESSAGE });
  if (!validation.valid) return json({ ok: false, message: 'Please check the highlighted fields.', fields: validation.errors }, 422);

  let verified = false;
  try { verified = await verifyTurnstile(validation.value.turnstileToken, request, env.TURNSTILE_SECRET_KEY, runtime.fetch); } catch { verified = false; }
  if (!verified) return json({ ok: false, message: PUBLIC_ERROR, verificationFailed: true }, 400);

  try {
    await sendViaGoogleAppsScript(validation.value, env, runtime.fetch);
    console.log(JSON.stringify({ event: 'reservation_email_sent', provider: 'google_apps_script' }));
    return json({ ok: true, message: SUCCESS_MESSAGE });
  } catch (error) {
    console.error(JSON.stringify({ event: 'reservation_email_failed', code: error?.code || 'unknown' }));
    return json({ ok: false, message: PUBLIC_ERROR }, 502);
  }
}

export default { fetch: (request, env) => handleReservation(request, env) };
