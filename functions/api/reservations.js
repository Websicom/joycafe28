const unavailable = () => Response.json({ ok: false, enabled: false, message: 'Online reservation requests are temporarily unavailable. Please call Joy Café on 01763 230140.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });

async function forward(context) {
  if (!context.env.BOOKING_SERVICE?.fetch) return unavailable();
  const headers = new Headers(context.request.headers);
  headers.set('X-Client-IP', context.request.headers.get('CF-Connecting-IP') || 'unknown');
  const body = context.request.method === 'GET' || context.request.method === 'HEAD' ? undefined : await context.request.arrayBuffer();
  const request = new Request('https://booking-service.internal/', {
    method: context.request.method,
    headers,
    body
  });
  try { return await context.env.BOOKING_SERVICE.fetch(request); } catch { return unavailable(); }
}

export const onRequestGet = forward;
export const onRequestPost = forward;
