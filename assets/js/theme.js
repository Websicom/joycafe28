const storageKey = 'joy-theme-override';

export function initTheme() {
  const body = document.body;
  const modeButton = document.querySelector('#theme-mode');
  const nightZone = document.querySelector('#night');
  const dayZone = document.querySelector('#reviews');
  let mode = sessionStorage.getItem(storageKey) || 'auto';
  if (!['auto', 'day', 'night'].includes(mode)) mode = 'auto';
  let autoTheme = getScrollTheme();

  const apply = (theme) => {
    body.dataset.theme = theme;
    if (modeButton) {
      const nextMode = mode === 'auto' ? 'day' : mode === 'day' ? 'night' : 'auto';
      modeButton.dataset.mode = mode;
      modeButton.title = `Theme: ${mode === 'auto' ? 'automatic' : mode}`;
      modeButton.setAttribute('aria-label', `Theme: ${mode === 'auto' ? 'automatic' : mode}. Activate for ${nextMode} mode`);
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'night' ? '#1b1815' : '#f8f4ec');
  };

  function getScrollTheme() {
    if (!nightZone || !dayZone) return 'day';
    const marker = window.innerHeight * 0.42;
    const nightTop = nightZone.getBoundingClientRect().top;
    const dayTop = dayZone.getBoundingClientRect().top;
    return nightTop <= marker && dayTop > marker ? 'night' : 'day';
  }

  modeButton?.addEventListener('click', () => {
    mode = mode === 'auto' ? 'day' : mode === 'day' ? 'night' : 'auto';
    if (mode === 'auto') sessionStorage.removeItem(storageKey);
    else sessionStorage.setItem(storageKey, mode);
    autoTheme = getScrollTheme();
    apply(mode === 'auto' ? autoTheme : mode);
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(() => {
      autoTheme = getScrollTheme();
      if (mode === 'auto') apply(autoTheme);
    }, { rootMargin: '-42% 0px -42% 0px', threshold: 0 });
    if (nightZone) observer.observe(nightZone);
    if (dayZone) observer.observe(dayZone);
  }
  apply(mode === 'auto' ? autoTheme : mode);
  window.addEventListener('pageshow', () => {
    autoTheme = getScrollTheme();
    if (mode === 'auto') apply(autoTheme);
  });
}
