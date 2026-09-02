const storageKey = 'joy-theme-override';

export function initTheme() {
  const body = document.body;
  const themeSwitch = document.querySelector('#theme-switch');
  const autoButton = document.querySelector('#theme-auto');
  const nightZone = document.querySelector('#night');
  const dayZone = document.querySelector('#reviews');
  let override = sessionStorage.getItem(storageKey);
  let autoTheme = getScrollTheme();

  const apply = (theme, automatic = false) => {
    body.dataset.theme = theme;
    themeSwitch.checked = theme === 'night';
    themeSwitch.setAttribute('aria-checked', String(theme === 'night'));
    autoButton.setAttribute('aria-pressed', String(automatic));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'night' ? '#1b1815' : '#f8f4ec');
  };
  const useAuto = () => {
    override = null;
    sessionStorage.removeItem(storageKey);
    autoTheme = getScrollTheme();
    apply(autoTheme, true);
  };

  function getScrollTheme() {
    if (!nightZone || !dayZone) return 'day';
    const marker = window.innerHeight * 0.42;
    const nightTop = nightZone.getBoundingClientRect().top;
    const dayTop = dayZone.getBoundingClientRect().top;
    return nightTop <= marker && dayTop > marker ? 'night' : 'day';
  }

  themeSwitch?.addEventListener('change', () => {
    override = themeSwitch.checked ? 'night' : 'day';
    sessionStorage.setItem(storageKey, override);
    apply(override, false);
  });
  autoButton?.addEventListener('click', useAuto);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(() => {
      autoTheme = getScrollTheme();
      if (!override) apply(autoTheme, true);
    }, { rootMargin: '-42% 0px -42% 0px', threshold: 0 });
    if (nightZone) observer.observe(nightZone);
    if (dayZone) observer.observe(dayZone);
  }
  apply(override || autoTheme, !override);
  window.addEventListener('pageshow', () => {
    autoTheme = getScrollTheme();
    if (!override) apply(autoTheme, true);
  });
}
