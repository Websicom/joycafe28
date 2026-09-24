import assert from 'node:assert/strict';
import { getDisplayHours, getLondonToday, getOpenDates, getReservationSlots, validateReservation } from '../shared/reservations.js';
import { buildReservationEmail, handleReservation } from '../workers/reservations.js';
import { onRequestGet, onRequestPost } from '../functions/api/reservations.js';

const now = new Date('2026-09-05T12:00:00Z');
assert.equal(getLondonToday(new Date('2026-03-29T23:30:00Z')), '2026-03-30', 'London date should observe BST');
assert.deepEqual(getReservationSlots('2026-09-06', { now }), [], 'Sunday should be closed');
assert.deepEqual(getReservationSlots('2026-09-07', { now }), [], 'Monday should be closed');
assert.deepEqual(getReservationSlots('2026-09-09', { now }), Array.from({ length: 12 }, (_, index) => `${String(11 + Math.floor(index / 4)).padStart(2, '0')}:${String((index % 4) * 15).padStart(2, '0')}`), 'Wednesday should offer 15-minute slots from 11:00 through 13:45');
assert.equal(getReservationSlots('2026-09-10', { now }).at(11), '13:45', 'Thursday lunch reservations should end at 13:45');
assert.equal(getReservationSlots('2026-09-10', { now }).at(12), '18:00', 'Thursday evening reservations should begin at 18:00');
assert.equal(getReservationSlots('2026-09-10', { now }).at(-1), '20:45', 'Thursday evening reservations should end at 20:45');
assert.equal(getReservationSlots('2026-09-11', { now })[0], '11:00', 'Friday reservations should begin at 11:00');
assert.equal(getReservationSlots('2026-09-11', { now }).at(-1), '18:00', 'Friday reservations should end at 18:00');
assert.equal(getReservationSlots('2026-09-12', { now })[0], '11:00', 'Saturday reservations should begin at 11:00');
assert.equal(getReservationSlots('2026-09-12', { now }).at(-1), '13:30', 'Saturday reservations should end at 13:30');
assert.deepEqual(getReservationSlots('2026-09-05', { now }), [], 'Same-day slots must not be offered');
assert.equal(getOpenDates(now)[0], '2026-09-09', 'Open dates must exclude today');
assert.deepEqual(getReservationSlots('2026-09-04', { now }), [], 'Past dates must have no slots');
assert.deepEqual(getReservationSlots('2026-02-31', { now, excludePast: false }), [], 'Impossible dates must be rejected');
for (const instant of ['2026-03-28T23:30:00Z', '2026-03-29T23:30:00Z', '2026-10-24T23:30:00Z', '2026-10-25T23:30:00Z']) {
  const clock = new Date(instant);
  assert(getOpenDates(clock).every((date) => date > getLondonToday(clock)), 'No same-day bookings around DST transitions');
}
assert.deepEqual(getDisplayHours().find(({ day }) => day === 'Wednesday').times, ['7:30am – 4pm'], 'Public opening hours should remain unchanged');
assert.deepEqual(getDisplayHours().find(({ day }) => day === 'Thursday').times, ['7:30am – 4pm', '6pm – 11pm'], 'Public Thursday opening hours should remain unchanged');

const valid = { name: 'Alex Example', partySize: '2', date: '2026-09-09', time: '12:00', email: 'alex@example.com', phone: '07123 456789', requests: 'Gluten free', turnstileToken: 'test-token', website: '' };
assert.equal(validateReservation(valid, { now }).valid, true, 'Valid reservation should pass');
for (const phone of ['1', '07968 953398', '+44 (0) 7968 953398', '01763/230140', '01763 230140 ext 2']) {
  assert.equal(validateReservation({ ...valid, phone }, { now }).valid, true, `Phone entry should be accepted: ${phone}`);
}
assert.ok(validateReservation({ ...valid, phone: '   ' }, { now }).errors.phone, 'Phone is still required');
assert.equal(validateReservation({ ...valid, time: '13:45' }, { now }).valid, true, 'The final Wednesday slot should be accepted');
assert.equal(validateReservation({ ...valid, time: '14:00' }, { now }).errors.time.length > 0, true, 'Times after the final Wednesday slot should fail');
assert.equal(validateReservation({ ...valid, date: '2026-09-04' }, { now }).errors.date.length > 0, true, 'Past dates should fail');
assert.equal(validateReservation({ ...valid, date: '2026-09-06' }, { now }).errors.date.length > 0, true, 'Closed dates should fail');
assert.equal(validateReservation({ ...valid, time: '16:00' }, { now }).errors.time.length > 0, true, 'Closing time should fail');
assert.equal(validateReservation({ ...valid, partySize: '99' }, { now }).errors.partySize.length > 0, true, 'Altered party size should fail');
assert.equal(validateReservation({ ...valid, partySize: '6' }, { now }).valid, true, 'Party size of six should be accepted');
assert.equal(validateReservation({ ...valid, partySize: '7' }, { now }).errors.partySize.length > 0, true, 'Party size above six should fail');
assert.equal(validateReservation({ ...valid, email: 'bad\r\nBcc:test@example.com' }, { now }).errors.email.length > 0, true, 'Header injection should fail');
assert.equal(validateReservation({ ...valid, name: '' }, { now }).errors.name.length > 0, true, 'Missing required fields should fail');

const email = buildReservationEmail(validateReservation(valid, { now }).value);
assert.equal(email.to, 'steff@joycafe28.com');
assert.deepEqual(email.from, { email: 'bookings@joycafe28.com', name: 'Joy Website Reservations' });
assert.equal(email.replyTo, 'alex@example.com');
assert.match(email.subject, /^New table reservation request: Alex Example, 2026-09-09 at 12:00$/);
for (const value of ['Alex Example', '2', 'Wednesday, 9 September 2026', '12:00pm', 'alex@example.com', '07123 456789', 'Gluten free']) assert(email.text.includes(value));

let sent;
const env = {
  GOOGLE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test-deployment/exec',
  GOOGLE_APPS_SCRIPT_SECRET: '12345678901234567890123456789012',
  BOOKING_RATE_LIMITER: { limit: async () => ({ success: true }) },
};
const request = (body) => new Request('https://example.test/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Client-IP': '192.0.2.1' }, body: JSON.stringify(body) });
const successfulFetch = async (url, options) => {
  if (String(url).includes('siteverify')) return Response.json({ success: true, action: 'reservation_request' });
  sent = JSON.parse(options.body);
  return Response.json({ ok: true });
};
const success = await handleReservation(request(valid), env, { now, fetch: successfulFetch });
assert.equal(success.status, 200, 'Successful Function request should return 200');
assert.equal((await success.json()).ok, true);
assert.equal(sent.secret, '12345678901234567890123456789012', 'Worker should authenticate to the private Google webhook');
assert.equal(sent.reservation.email, valid.email, 'Worker should forward the validated customer address');

sent = undefined;
const deliveryFailure = await handleReservation(request(valid), env, { now, fetch: async () => Response.json({ ok: false }) });
assert.equal(deliveryFailure.status, 502, 'Failed mail delivery must not show success');
assert.equal(sent, undefined);

const validationFailure = await handleReservation(request({ ...valid, partySize: 99 }), env, { now, fetch: async () => Response.json({ success: true }) });
assert.equal(validationFailure.status, 422, 'Server should reject altered fields');
assert.ok((await validationFailure.json()).fields.partySize);

const limited = await handleReservation(request(valid), { ...env, BOOKING_RATE_LIMITER: { limit: async () => ({ success: false }) } }, { now, fetch: successfulFetch });
assert.equal(limited.status, 429, 'Rate limiting should remain in place');
const sameDay = await handleReservation(request({ ...valid, date: '2026-09-05', time: '13:15' }), env, { now, fetch: successfulFetch });
assert.equal(sameDay.status, 422);
assert.match((await sameDay.json()).fields.date, /call 01763/);
const honeypot = await handleReservation(request({ ...valid, website: 'spam.example' }), env, { now, fetch: async () => { throw new Error('Honeypot must not send mail'); } });
assert.equal(honeypot.status, 200);
const tooLong = await handleReservation(request({ ...valid, requests: 'x'.repeat(17000) }), env, { now, fetch: successfulFetch });
assert.equal(tooLong.status, 413);
const badJson = await handleReservation(new Request('https://example.test/', { method: 'POST', body: '{' }), env, { now, fetch: successfulFetch });
assert.equal(badJson.status, 400);

const configResponse = await handleReservation(new Request('https://example.test/'), env);
const config = await configResponse.json();
assert.equal(config.enabled, true);
assert.ok(config.availability);
assert.equal(config.siteKey, undefined);
const disabledConfigResponse = await handleReservation(new Request('https://example.test/'), { ...env, GOOGLE_APPS_SCRIPT_URL: '' });
assert.equal((await disabledConfigResponse.json()).enabled, false);

// Every advertised slot must pass the same server validation; unavailable quarter-hours must fail.
const auditNow = new Date('2026-09-24T08:00:00Z');
const advertised = await (await handleReservation(new Request('https://example.test/'), env, { now: auditNow })).json();
assert(advertised.availability['2026-09-25'].includes('12:15'), 'Reported Friday example must be available');
for (const [date, slots] of Object.entries(advertised.availability)) {
  for (const time of slots) assert(validateReservation({ ...valid, date, time }, { now: auditNow }).valid, `${date} ${time} should validate`);
  for (const time of ['07:30', '10:45', '16:15', '21:00', '23:00']) {
    if (!slots.includes(time)) assert(validateReservation({ ...valid, date, time }, { now: auditNow }).errors.time);
  }
}

const proxyEnv = { BOOKING_SERVICE: { fetch: async (proxied) => Response.json({ method: proxied.method, clientIp: proxied.headers.get('X-Client-IP') }) } };
const proxiedGet = await onRequestGet({ request: new Request('https://example.test/api/reservations', { headers: { 'CF-Connecting-IP': '192.0.2.2' } }), env: proxyEnv });
assert.deepEqual(await proxiedGet.json(), { method: 'GET', clientIp: '192.0.2.2' });
const proxiedPost = await onRequestPost({ request: request(valid), env: proxyEnv });
assert.equal((await proxiedPost.json()).method, 'POST');

const bookingScript = await (await import('node:fs/promises')).readFile(new URL('../assets/js/booking.js', import.meta.url), 'utf8');
assert(bookingScript.includes('if (submitting || completed) return;'), 'Client should prevent duplicate submissions');
assert(!bookingScript.includes('turnstile'), 'Client must not load human verification');
console.log('Reservation tests passed: advertised hours, same-day/DST restrictions, validation, delivery failures, honeypot, rate limits and proxy responses.');
