export function initFaq() {
  document.querySelectorAll('.faq-question').forEach((button) => {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    if (!panel) return;
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      panel.setAttribute('aria-hidden', String(open));
      panel.style.maxHeight = open ? '0px' : `${panel.scrollHeight}px`;
    });
  });
}
