export function initNavigation() {
  const header = document.querySelector('#site-header');
  const nav = document.querySelector('#primary-nav');
  const toggle = document.querySelector('.nav-toggle');
  const dropdown = document.querySelector('.nav-dropdown');
  const dropdownButton = dropdown?.querySelector('button');

  const closeNav = () => {
    nav?.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
  };
  const closeDropdown = () => {
    dropdown?.classList.remove('is-open');
    dropdownButton?.setAttribute('aria-expanded', 'false');
  };

  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    nav?.classList.toggle('is-open', !open);
  });
  dropdownButton?.addEventListener('click', () => {
    const open = dropdownButton.getAttribute('aria-expanded') === 'true';
    dropdownButton.setAttribute('aria-expanded', String(!open));
    dropdown?.classList.toggle('is-open', !open);
  });
  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    closeNav();
    closeDropdown();
  }));
  document.addEventListener('click', (event) => {
    if (dropdown && !dropdown.contains(event.target)) closeDropdown();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeNav();
      closeDropdown();
      toggle?.focus();
    }
  });

  const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 80);
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();
}
