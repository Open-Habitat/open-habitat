// Runs before styles and the application; no inline script or CSP exception needed.
// Resolves the theme the same way as src/theme.ts.
(() => {
  let choice;
  try {
    choice = localStorage.getItem("nah:theme");
  } catch {
    /* Storage may be disabled. */
  }
  const theme =
    choice === "light" || choice === "dark" || choice === "contrast"
      ? choice
      : matchMedia("(prefers-contrast: more)").matches
        ? "contrast"
        : matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme =
    theme === "light" ? "light" : "dark";
})();
