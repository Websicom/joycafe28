import { formatDate, formatTime, validateReservation } from '/shared/reservations.js?v=20260924';

const fieldIds = { name: 'booking-name', partySize: 'party-size', date: 'booking-date', time: 'booking-time', email: 'booking-email', phone: 'booking-phone', requests: 'booking-requests' };
const failureMessage = 'Your request has not been sent. Please try again or call Joy Café on 01763 230140.';

export async function initBooking() {
  const form = document.querySelector('#booking-form');
  if (!form) return;
  const submitButton = form.querySelector('button[type="submit"]');
  const buttonLabel = submitButton.querySelector('.button-label');
  const dateSelect = form.elements.date;
  const timeSelect = form.elements.time;
  const status = form.querySelector('#booking-status');
  let availability = {};
  let submitting = false;

  const setStatus = (message = '', kind = '') => {
    status.textContent = message;
    status.className = `booking-status${kind ? ` is-${kind}` : ''}`;
  };
  const setFieldError = (name, message = '') => {
    const field = form.querySelector(`#${fieldIds[name]}`);
    const error = form.querySelector(`#${fieldIds[name]}-error`);
    error.textContent = message;
    if (message) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  };
  const showErrors = (errors) => {
    Object.keys(fieldIds).forEach((name) => setFieldError(name, errors[name] || ''));
    const first = Object.keys(fieldIds).find((name) => errors[name]);
    if (first) form.elements[first].focus();
    return Boolean(first);
  };
  const refreshTimes = () => {
    timeSelect.replaceChildren(new Option(dateSelect.value ? 'Choose a time' : 'Choose a date first', ''));
    (availability[dateSelect.value] || []).forEach((time) => timeSelect.add(new Option(formatTime(time), time)));
    timeSelect.disabled = !dateSelect.value;
  };
  const loadAvailability = async () => {
    const response = await fetch('/api/reservations', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    if (!response.ok || !result.enabled || !result.availability) throw new Error('unavailable');
    availability = result.availability;
    const selectedDate = dateSelect.value;
    const selectedTime = timeSelect.value;
    dateSelect.replaceChildren(new Option('Choose a date', ''));
    Object.keys(availability).forEach((date) => dateSelect.add(new Option(formatDate(date), date)));
    dateSelect.value = availability[selectedDate] ? selectedDate : '';
    refreshTimes();
    if (availability[dateSelect.value]?.includes(selectedTime)) timeSelect.value = selectedTime;
  };
  const setLoading = (loading) => {
    submitting = loading;
    submitButton.disabled = loading;
    form.setAttribute('aria-busy', String(loading));
    buttonLabel.textContent = loading ? 'Sending request…' : 'Send reservation request';
  };

  dateSelect.addEventListener('change', () => {
    setFieldError('date');
    setFieldError('time');
    refreshTimes();
  });
  Object.keys(fieldIds).forEach((name) => form.elements[name].addEventListener('input', () => setFieldError(name)));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    const clientPayload = Object.fromEntries(new FormData(form).entries());
    setLoading(true);
    try {
      // Refresh in case the form was left open overnight or hours changed.
      await loadAvailability();
      const validation = validateReservation(clientPayload, { availability });
      showErrors(validation.errors);
      if (!validation.valid) {
        setStatus('Request not sent. Please correct the fields marked in red.', 'error');
        return;
      }
      setStatus('Sending your reservation request…');
      const response = await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clientPayload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        const hasFieldErrors = result.fields && showErrors(result.fields);
        setStatus(hasFieldErrors ? 'Request not sent. Please correct the fields marked in red.' : failureMessage, 'error');
        if (!hasFieldErrors) status.focus();
        return;
      }
      form.reset();
      refreshTimes();
      showErrors({});
      setStatus(result.message, 'success');
      status.focus();
    } catch {
      setStatus(failureMessage, 'error');
      status.focus();
    } finally {
      setLoading(false);
    }
  });

  try {
    await loadAvailability();
  } catch {
    setStatus('Unable to load reservation dates. Please refresh the page or call 01763 230140.', 'error');
  }
}
