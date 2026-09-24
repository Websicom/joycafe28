// Run with agent-browser eval --stdin against tests/booking-server.mjs only.
(async () => {
  if (location.hostname !== '127.0.0.1') throw new Error('Local test server required');
  const results = [];
  const check = (condition, message) => { if (!condition) throw new Error(message); results.push(message); };
  const form = document.querySelector('#booking-form');
  const status = document.querySelector('#booking-status');
  const button = form.querySelector('button');
  const waitFor = async (predicate) => {
    for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise((r) => setTimeout(r, 25)); }
    throw new Error('Timed out waiting for form');
  };
  const change = (name, value) => { form.elements[name].value = value; form.elements[name].dispatchEvent(new Event('input', { bubbles: true })); form.elements[name].dispatchEvent(new Event('change', { bubbles: true })); };
  const submit = () => button.click();
  const originalFetch = window.fetch;
  let posts = 0;
  let mode = 'success';
  window.fetch = async (url, options) => {
    if (options?.method === 'POST') {
      posts++;
      if (mode === 'failure') return Response.json({ ok: false }, { status: 502 });
      if (mode === 'invalid-json') return new Response('not json', { status: 502 });
      if (mode === 'network') throw new TypeError('Network failed');
      if (mode === 'fields') return Response.json({ ok: false, fields: { phone: 'Please enter a valid phone number.' } }, { status: 422 });
    }
    return originalFetch(url, options);
  };
  await waitFor(() => form.elements.date.options.length > 1);
  check(!button.disabled, 'Send button is usable immediately after loading');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  check([...form.elements.date.options].filter((o) => o.value).every((o) => o.value > today), 'Only future dates offered');
  check(!document.querySelector('iframe[src*="cloudflare"],script[src*="challenges.cloudflare"]'), 'No human verification loaded');
  submit();
  await waitFor(() => !button.disabled);
  check(document.activeElement.id === 'booking-name', 'First invalid field receives focus');
  check(form.querySelectorAll('[aria-invalid="true"]').length >= 5, 'Missing fields marked invalid');
  check(getComputedStyle(form.elements.name).borderTopColor === 'rgb(180, 35, 24)', 'Invalid field has red border');
  check(getComputedStyle(document.querySelector('#booking-name-error')).color === 'rgb(180, 35, 24)', 'Field error is red');
  check(status.classList.contains('is-error') && getComputedStyle(status).backgroundColor === 'rgb(255, 241, 240)', 'Failure has red background');
  const date = form.elements.date.options[1].value;
  const fill = () => {
    change('name', 'LOCAL TEST ONLY'); change('partySize', '3'); change('date', date);
    change('time', form.elements.time.options[1].value);
    change('email', 'test@example.com'); change('phone', '07123 456789');
  };
  fill();
  change('date', form.elements.date.options[2].value);
  check(form.elements.time.value === '', 'Changing date clears previous time');
  fill();
  submit(); submit();
  check(button.disabled, 'Send button disables immediately');
  await waitFor(() => !button.disabled);
  check(posts === 1, 'Repeated submits send exactly once');
  check(status.classList.contains('is-success') && getComputedStyle(status).backgroundColor === 'rgb(234, 246, 237)', 'Success has green background');
  check(form.elements.name.value === '' && form.elements.time.disabled, 'Successful send resets fields and time');
  check(document.activeElement === status, 'Success message receives focus');
  for (const failure of ['failure', 'invalid-json', 'network', 'fields']) {
    mode = failure; fill(); submit(); await waitFor(() => !button.disabled);
    check(status.classList.contains('is-error') && form.elements.name.value === 'LOCAL TEST ONLY', `${failure}: clear error and input preserved`);
    if (failure === 'fields') check(document.activeElement.id === 'booking-phone', 'Server field error keeps focus on invalid field');
  }
  mode = 'success'; fill(); submit(); await waitFor(() => !button.disabled);
  check(status.classList.contains('is-success'), 'Retry after failures works');
  submit(); await waitFor(() => !button.disabled);
  window.fetch = originalFetch;
  return results;
})()
