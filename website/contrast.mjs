// Korkea kontrasti follows the system only: when the theme menu is on Auto
// and the system asks for more contrast (prefers-contrast: more), the page
// shows data-theme="contrast". It is not in the menu, and a reader who
// picked Day or Night keeps what they picked. Starlight's own theme script
// sets data-theme to light or dark on load, on a menu change and on a
// colour-scheme change, so this watches the attribute and turns it to
// contrast before the next paint. Starlight's styles treat any value other
// than light as dark, which Korkea kontrasti is.
export const contrastScript = `(() => {
  const root = document.documentElement;
  const more = matchMedia('(prefers-contrast: more)');
  const auto = () => { try { return !localStorage.getItem('starlight-theme'); } catch { return true; } };
  const apply = () => {
    const theme = root.dataset.theme;
    if (more.matches && auto()) { if (theme && theme !== 'contrast') root.dataset.theme = 'contrast'; }
    else if (theme === 'contrast') root.dataset.theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  };
  new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  more.addEventListener('change', apply);
  apply();
})();`;
