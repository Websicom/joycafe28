export const RESERVATION_CONFIG = Object.freeze({
  timeZone: 'Europe/London',
  slotMinutes: 15,
  bookingWindowDays: 90,
  partySize: { min: 1, max: 6 },
  limits: Object.freeze({ name: 100, email: 254, phone: 40, requests: 1000, turnstileToken: 2048 }),
  schedule: Object.freeze({
    0: Object.freeze([]),
    1: Object.freeze([]),
    2: Object.freeze([]),
    3: Object.freeze([{ start: '07:30', end: '16:00' }]),
    4: Object.freeze([{ start: '07:30', end: '16:00' }, { start: '18:00', end: '23:00' }]),
    5: Object.freeze([{ start: '07:30', end: '19:00' }]),
    6: Object.freeze([{ start: '09:00', end: '15:00' }])
  }),
  reservationSchedule: Object.freeze({
    0: Object.freeze([]),
    1: Object.freeze([]),
    2: Object.freeze([]),
    3: Object.freeze([{ start: '11:00', lastSlot: '13:45' }]),
    4: Object.freeze([{ start: '11:00', lastSlot: '13:45' }, { start: '18:00', lastSlot: '20:45' }]),
    5: Object.freeze([{ start: '11:00', lastSlot: '18:00' }]),
    6: Object.freeze([{ start: '11:00', lastSlot: '13:30' }])
  })
});

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const dateParts = (date, timeZone = RESERVATION_CONFIG.timeZone) => Object.fromEntries(
  new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value])
);

export function getLondonToday(now = new Date()) {
  const { year, month, day } = dateParts(now);
  return `${year}-${month}-${day}`;
}

export function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getWeekday(dateValue) {
  return new Date(`${dateValue}T12:00:00Z`).getUTCDay();
}

const toMinutes = (value) => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
};

const fromMinutes = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

const getLondonTimeMinutes = (now) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: RESERVATION_CONFIG.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return (Number(parts.hour) * 60) + Number(parts.minute);
};

export function getReservationSlots(dateValue, { now = new Date(), excludePast = true } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return [];
  const periods = RESERVATION_CONFIG.reservationSchedule[getWeekday(dateValue)] || [];
  const slots = periods.flatMap(({ start, lastSlot }) => {
    const slots = [];
    for (let time = toMinutes(start); time <= toMinutes(lastSlot); time += RESERVATION_CONFIG.slotMinutes) {
      slots.push(fromMinutes(time));
    }
    return slots;
  });
  if (!excludePast || dateValue !== getLondonToday(now)) return slots;
  const currentMinutes = getLondonTimeMinutes(now);
  return slots.filter((time) => toMinutes(time) > currentMinutes);
}

export function getOpenDates(now = new Date()) {
  const today = getLondonToday(now);
  return Array.from({ length: RESERVATION_CONFIG.bookingWindowDays + 1 }, (_, offset) => addDays(today, offset))
    .filter((date) => getReservationSlots(date, { now }).length > 0);
}

export function formatTime(time) {
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'pm' : 'am';
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, '0')}${suffix}`;
}

export function formatDate(dateValue) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(`${dateValue}T12:00:00Z`));
}

const displayTime = (time) => formatTime(time).replace(':00', '');

export function getDisplayHours() {
  return DAYS.map((day, weekday) => {
    const periods = RESERVATION_CONFIG.schedule[weekday] || [];
    return { day, times: periods.length ? periods.map(({ start, end }) => `${displayTime(start)} – ${displayTime(end)}`) : ['Closed'] };
  }).slice(1).concat([{ day: DAYS[0], times: ['Closed'] }]);
}

const cleanSingleLine = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const cleanMultiline = (value) => String(value ?? '').trim().replace(/\r\n?/g, '\n').replace(/[\t ]+/g, ' ');
const validEmail = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
const validPhone = /^[+()\d][+()\d\s.-]{5,39}$/;

export function validateReservation(input, { now = new Date(), requireTurnstile = true } = {}) {
  const limits = RESERVATION_CONFIG.limits;
  const value = {
    name: cleanSingleLine(input?.name),
    partySize: Number(input?.partySize),
    date: cleanSingleLine(input?.date),
    time: cleanSingleLine(input?.time),
    email: cleanSingleLine(input?.email).toLowerCase(),
    phone: cleanSingleLine(input?.phone),
    requests: cleanMultiline(input?.requests),
    website: cleanSingleLine(input?.website),
    turnstileToken: cleanSingleLine(input?.turnstileToken || input?.['cf-turnstile-response'])
  };
  const errors = {};
  if (!value.name) errors.name = 'Please enter your name.';
  else if (value.name.length > limits.name || /[\r\n]/.test(value.name)) errors.name = `Name must be ${limits.name} characters or fewer.`;
  if (!Number.isInteger(value.partySize) || value.partySize < RESERVATION_CONFIG.partySize.min || value.partySize > RESERVATION_CONFIG.partySize.max) errors.partySize = 'Please choose a valid party size.';
  const today = getLondonToday(now);
  const lastDate = addDays(today, RESERVATION_CONFIG.bookingWindowDays);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date) || value.date < today || value.date > lastDate || getReservationSlots(value.date, { now }).length === 0) errors.date = 'Please choose an available date.';
  if (!errors.date && !getReservationSlots(value.date, { now }).includes(value.time)) errors.time = 'Please choose an available time.';
  if (!value.email || value.email.length > limits.email || !validEmail.test(value.email)) errors.email = 'Please enter a valid email address.';
  if (!value.phone || value.phone.length > limits.phone || !validPhone.test(value.phone)) errors.phone = 'Please enter a valid phone number.';
  if (value.requests.length > limits.requests) errors.requests = `Please keep requests to ${limits.requests} characters or fewer.`;
  if (requireTurnstile && (!value.turnstileToken || value.turnstileToken.length > limits.turnstileToken)) errors.turnstileToken = 'Please complete the security check.';
  return { valid: Object.keys(errors).length === 0 && !value.website, errors, value };
}
