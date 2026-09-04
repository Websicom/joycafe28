const storageKey = 'joy-theme-mode-v3';

export function initTheme() {
  const body = document.body;
  const modeButton = document.querySelector('#theme-mode');
  const nightZone = document.querySelector('#night');
  const dayZone = document.querySelector('#visit');
  let mode = sessionStorage.getItem(storageKey) || 'day';
  if (!['day', 'night'].includes(mode)) mode = 'day';

  const apply = (theme) => {
    body.dataset.theme = theme;
    if (modeButton) {
      const nextMode = mode === 'day' ? 'night' : 'day';
      modeButton.dataset.mode = mode;
      modeButton.title = `Switch to ${nextMode === 'day' ? 'day' : 'dark'} theme`;
      modeButton.setAttribute('aria-label', `${mode === 'day' ? 'Day' : 'Dark'} theme active. Switch to ${nextMode === 'day' ? 'day' : 'dark'} theme`);
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'night' ? '#473f3a' : '#fbfaf6');
  };

  function getScrollTheme() {
    if (!nightZone || !dayZone) return 'day';
    const marker = window.innerHeight * 0.42;
    const nightTop = nightZone.getBoundingClientRect().top;
    const dayTop = dayZone.getBoundingClientRect().top;
    return nightTop <= marker && dayTop > marker ? 'night' : 'day';
  }

  modeButton?.addEventListener('click', () => {
    mode = mode === 'day' ? 'night' : 'day';
    sessionStorage.setItem(storageKey, mode);
    apply(mode === 'night' ? 'night' : getScrollTheme());
  });

  let ticking = false;
  const updateAutomaticTheme = () => {
    if (mode === 'day') {
      const theme = getScrollTheme();
      if (body.dataset.theme !== theme) apply(theme);
    }
    ticking = false;
  };
  const requestAutomaticTheme = () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateAutomaticTheme);
    }
  };
  window.addEventListener('scroll', requestAutomaticTheme, { passive: true });
  window.addEventListener('resize', requestAutomaticTheme);

  apply(mode === 'night' ? 'night' : getScrollTheme());
  window.addEventListener('pageshow', () => {
    if (mode === 'day') apply(getScrollTheme());
  });
}
