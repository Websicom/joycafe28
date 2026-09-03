const storageKey = 'joy-theme-override-v2';

export function initTheme() {
  const body = document.body;
  const modeButton = document.querySelector('#theme-mode');
  const nightZone = document.querySelector('#night');
  const dayZone = document.querySelector('#reviews');
  let override = sessionStorage.getItem(storageKey);
  if (!['day', 'night'].includes(override)) override = null;

  const apply = (theme) => {
    body.dataset.theme = theme;
    if (modeButton) {
      const nextMode = theme === 'day' ? 'night' : 'day';
      const source = override ? '' : 'Automatic ';
      modeButton.dataset.mode = theme;
      modeButton.title = `Switch to ${nextMode === 'day' ? 'light' : 'dark'} theme`;
      modeButton.setAttribute('aria-label', `${source}${theme === 'day' ? 'light' : 'dark'} theme active. Switch to ${nextMode === 'day' ? 'light' : 'dark'} theme`);
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
    override = body.dataset.theme === 'day' ? 'night' : 'day';
    sessionStorage.setItem(storageKey, override);
    apply(override);
  });

  let ticking = false;
  const updateAutomaticTheme = () => {
    if (!override) {
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

  apply(override || getScrollTheme());
  window.addEventListener('pageshow', () => {
    if (!override) apply(getScrollTheme());
  });
}
