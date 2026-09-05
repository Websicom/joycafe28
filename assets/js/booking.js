import { formatDate, formatTime, getOpenDates, getReservationSlots, validateReservation } from '/shared/reservations.js';

const fieldIds = { name: 'booking-name', partySize: 'party-size', date: 'booking-date', time: 'booking-time', email: 'booking-email', phone: 'booking-phone', requests: 'booking-requests' };

const loadTurnstile = () => new Promise((resolve, reject) => {
  if (window.turnstile) return resolve(window.turnstile);
  const existing = document.querySelector('script[data-joy-turnstile]');
  if (existing) {
    existing.addEventListener('load', () => resolve(window.turnstile), { once: true });
    existing.addEventListener('error', reject, { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.defer = true;
  script.dataset.joyTurnstile = '';
  script.onload = () => resolve(window.turnstile);
  script.onerror = reject;
  document.head.append(script);
});

export async function initBooking() {
  const form = document.querySelector('#booking-form');
  if (!form) return;
  const submitButton = form.querySelector('button[type="submit"]');
  const buttonLabel = submitButton.querySelector('.button-label');
  const dateSelect = form.elements.date;
  const timeSelect = form.elements.time;
  const status = form.querySelector('#booking-status');
  const turnstileHost = form.querySelector('#booking-turnstile');
  let turnstileToken = '';
  let widgetId;
  let submitting = false;

  const setStatus = (message = '', kind = '') => {
    status.textContent = message;
    status.className = `booking-status${kind ? ` is-${kind}` : ''}`;
  };
  const setFieldError = (name, message = '') => {
    const field = form.querySelector(`#${fieldIds[name]}`);
    const error = form.querySelector(`#${fieldIds[name]}-error`);
    if (!field || !error) return;
    error.textContent = message;
    field.toggleAttribute('aria-invalid', Boolean(message));
  };
  const showErrors = (errors) => {
    Object.keys(fieldIds).forEach((name) => setFieldError(name, errors[name] || ''));
    const first = Object.keys(fieldIds).find((name) => errors[name]);
    if (first) form.querySelector(`#${fieldIds[first]}`)?.focus();
  };
  const payload = () => Object.fromEntries(new FormData(form).entries());
  const setLoading = (loading) => {
    submitting = loading;
    submitButton.disabled = loading || !turnstileToken;
    form.setAttribute('aria-busy', String(loading));
    buttonLabel.textContent = loading ? 'Sending request…' : 'Send reservation request';
  };
  const resetTurnstile = () => {
    turnstileToken = '';
    if (window.turnstile && widgetId !== undefined) window.turnstile.reset(widgetId);
    setLoading(false);
  };

  getOpenDates().forEach((date) => dateSelect.add(new Option(formatDate(date), date)));
  dateSelect.addEventListener('change', () => {
    setFieldError('date');
    setFieldError('time');
    timeSelect.replaceChildren(new Option(dateSelect.value ? 'Choose a time' : 'Choose a date first', ''));
    getReservationSlots(dateSelect.value).forEach((time) => timeSelect.add(new Option(formatTime(time), time)));
    timeSelect.disabled = !dateSelect.value;
  });
  Object.keys(fieldIds).forEach((name) => form.elements[name]?.addEventListener('input', () => setFieldError(name)));

  try {
    const configResponse = await fetch('/api/reservations', { cache: 'no-store' });
    const config = await configResponse.json();
    if (!configResponse.ok || !config.enabled || !config.siteKey) throw new Error('Reservation service is not configured.');
    const turnstile = await loadTurnstile();
    turnstileHost.replaceChildren();
    widgetId = turnstile.render(turnstileHost, {
      sitekey: config.siteKey,
      action: 'reservation_request',
      theme: 'auto',
      appearance: 'interaction-only',
      callback: (token) => { turnstileToken = token; setLoading(false); },
      'expired-callback': resetTurnstile,
      'error-callback': resetTurnstile
    });
  } catch {
    turnstileHost.innerHTML = '<p>Online reservation requests are temporarily unavailable. Please call <a href="tel:01763230140">01763 230140</a>.</p>';
    setStatus('Online reservation requests are temporarily unavailable. Please call Joy Café on 01763 230140.', 'error');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    const clientPayload = { ...payload(), turnstileToken };
    const validation = validateReservation(clientPayload);
    showErrors(validation.errors);
    if (!validation.valid) {
      setStatus('Please check the highlighted fields.', 'error');
      return;
    }
    setStatus('Sending your reservation request…');
    setLoading(true);
    try {
      const response = await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clientPayload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        if (result.fields) showErrors(result.fields);
        throw new Error(result.message || 'We could not send your reservation request. Please try again or call Joy Café on 01763 230140.');
      }
      form.reset();
      timeSelect.replaceChildren(new Option('Choose a date first', ''));
      timeSelect.disabled = true;
      showErrors({});
      setStatus(result.message, 'success');
      status.focus();
      resetTurnstile();
    } catch (error) {
      setStatus(error.message || 'We could not send your reservation request. Please try again or call Joy Café on 01763 230140.', 'error');
      status.focus();
      resetTurnstile();
    }
  });
}
