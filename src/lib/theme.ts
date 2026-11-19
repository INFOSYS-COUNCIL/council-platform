export const THEME_KEY = "council-theme";
// maple: 단풍색 도트 테마(라이트 계열)
export type ThemePreference = "light" | "dark" | "system" | "maple";

// 첫 화면을 그리기 전에 적용해 저장한 테마와 화면이 잠깐 달라지는 것을 막는다.
export const THEME_SCRIPT = `(() => {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['light', 'dark', 'system', 'maple'].includes(value);
  const apply = value => {
    root.dataset.theme = valid(value) ? value : 'system';
    root.dataset.colorScheme = root.dataset.theme === 'system' ? (media.matches ? 'dark' : 'light') : root.dataset.theme === 'maple' ? 'light' : root.dataset.theme;
  };
  const restore = () => {
    let value;
    try { value = localStorage.getItem('${THEME_KEY}'); } catch {}
    apply(value);
  };
  restore();
  media.addEventListener('change', () => apply(root.dataset.theme));
  window.addEventListener('storage', event => {
    if (event.key === '${THEME_KEY}' || event.key === null) restore();
  });
})();`;
