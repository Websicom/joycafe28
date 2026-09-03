export function getBookingWeek(dateValue) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error('A valid booking date is required.');
  const day = date.getUTCDay();
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const format = (value) => value.toISOString().slice(0, 10);
  return { startDate: format(monday), endDate: format(sunday) };
}

export async function initBooking() {
  const form = document.querySelector('#booking-form');
  if (!form) return;
  const submitButton = form.querySelector('button[type="submit"]');
  const buttonLabel = submitButton?.querySelector('.button-label');
  const dateInput = form.querySelector('#booking-date');
  const status = form.querySelector('#booking-status');
  let config = {
    identifier: 'joycafewinebar',
    apiBaseUrl: 'https://api.sumup.com/public/bookings',
    fallbackUrl: 'https://www.sumupbookings.com/joycafewinebar',
    services: []
  };

  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  if (dateInput) dateInput.min = localToday;

  try {
    const response = await fetch('/data/booking.json');
    if (response.ok) config = await response.json();
  } catch {
    // The fallback link remains available if local configuration cannot be loaded.
  }

  const setLoading = (loading) => {
    if (submitButton) submitButton.disabled = loading;
    form.setAttribute('aria-busy', String(loading));
    if (buttonLabel) buttonLabel.textContent = loading ? 'Finding a table…' : 'Find a table';
  };

  const showError = () => {
    if (!status) return;
    status.classList.add('is-error');
    status.innerHTML = `We couldn't connect to SumUp just now. <a href="${config.fallbackUrl}">Open the booking page instead ↗</a>`;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    status?.classList.remove('is-error');
    if (status) status.textContent = 'Connecting securely to SumUp…';
    setLoading(true);

    try {
      const partySize = String(form.elements.partySize.value);
      const selectedService = config.services.find((service) => service.id === form.elements.service.value);
      const servicesResponse = await fetch(`${config.apiBaseUrl}/${config.identifier}/services?limit=20`, { cache: 'no-store' });
      if (!servicesResponse.ok) throw new Error('SumUp services could not be loaded.');

      const catalogue = await servicesResponse.json();
      const bookingService = catalogue.services?.find((service) => service.name === 'Table Bookings') || catalogue.services?.[0];
      const variant = bookingService?.variants?.find((item) => {
        const optionValues = Object.fromEntries(item.options.map((option) => [option.name, option.value]));
        return optionValues['Quantity of People'] === partySize
          && optionValues['Daytime or Evening booking'] === selectedService?.sumupValue;
      });
      if (!bookingService || !variant) throw new Error('The selected booking option is not available.');

      const cartResponse = await fetch(`${config.apiBaseUrl}/${config.identifier}/carts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ serviceId: bookingService.serviceId, variantId: variant.variantId, position: 0 }] })
      });
      if (!cartResponse.ok) throw new Error('A temporary SumUp cart could not be created.');

      const cartData = await cartResponse.json();
      const cartId = cartData?.cart?.cartId;
      if (!cartId) throw new Error('SumUp did not return a cart reference.');

      const selectedDate = form.elements.date.value;
      const { startDate, endDate } = getBookingWeek(selectedDate);
      const checkout = new URL(`${config.fallbackUrl}/checkout`);
      checkout.search = new URLSearchParams({ selectedDate, startDate, endDate, cartId }).toString();
      if (status) status.textContent = 'Opening available tables…';
      window.location.assign(checkout.toString());
    } catch (error) {
      console.error('Booking handoff failed:', error);
      showError();
      setLoading(false);
    }
  });
}
