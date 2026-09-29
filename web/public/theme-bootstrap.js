// Runs before styles and the application; no inline script or CSP exception needed.
(() => {
  let choice;
  try { choice = localStorage.getItem("nah:theme"); } catch { /* Storage may be disabled. */ }
  const dark = choice === "dark" || (choice !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
})();
