export async function initBooking() {
  const form = document.querySelector('#booking-form');
  if (!form) return;
  let config = { fallbackUrl: 'https://www.sumupbookings.com/joycafewinebar', mode: 'fallback' };
  try {
    const response = await fetch('/data/booking.json');
    if (response.ok) config = await response.json();
  } catch {
    // The documented fallback remains available when configuration cannot be loaded.
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const status = document.querySelector('#booking-status');
    if (status) status.textContent = 'Opening the secure SumUp booking page.';
    window.open(config.fallbackUrl, '_blank', 'noopener,noreferrer');
  });
}
