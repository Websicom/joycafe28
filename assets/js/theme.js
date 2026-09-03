const storageKey = 'joy-theme-override';

export function initTheme() {
  const body = document.body;
  const modeButton = document.querySelector('#theme-mode');
  let mode = sessionStorage.getItem(storageKey) || 'day';
  if (!['day', 'night'].includes(mode)) mode = 'day';

  const apply = (theme) => {
    body.dataset.theme = theme;
    if (modeButton) {
      const nextMode = mode === 'day' ? 'night' : 'day';
      modeButton.dataset.mode = mode;
      modeButton.title = `Switch to ${nextMode === 'day' ? 'light' : 'dark'} theme`;
      modeButton.setAttribute('aria-label', `${mode === 'day' ? 'Light' : 'Dark'} theme active. Switch to ${nextMode === 'day' ? 'light' : 'dark'} theme`);
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'night' ? '#1b1815' : '#f8f4ec');
  };

  modeButton?.addEventListener('click', () => {
    mode = mode === 'day' ? 'night' : 'day';
    sessionStorage.setItem(storageKey, mode);
    apply(mode);
  });

  apply(mode);
}
