// The theme is a device presentation choice: Päivä (light), Yö (dark) and
// Korkea kontrasti (contrast, dark). Järjestelmä follows the device: a request
// for more contrast wins over the light/dark preference, because a person who
// asked their device for contrast needs it whichever way it leans.
// public/theme-bootstrap.js repeats this resolution before styles load.
export type ThemeChoice = "system" | "light" | "dark" | "contrast";
export type Theme = Exclude<ThemeChoice, "system">;
const key = "nah:theme";
const darkQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
const contrastQuery = window.matchMedia?.("(prefers-contrast: more)");

function initialThemeChoice(): ThemeChoice {
  try {
    const saved = window.localStorage.getItem(key);
    if (saved === "light" || saved === "dark" || saved === "contrast")
      return saved;
  } catch {
    // Private browsing or disabled storage: the system setting remains usable.
  }
  return "system";
}

export function getThemeChoice(): ThemeChoice {
  return current;
}

export function resolveTheme(choice: ThemeChoice): Theme {
  if (choice !== "system") return choice;
  if (contrastQuery?.matches) return "contrast";
  return darkQuery?.matches ? "dark" : "light";
}

/** Whether the theme in effect has a dark ground (Yö and Korkea kontrasti). */
export function isDarkTheme(theme = document.documentElement.dataset.theme) {
  return theme === "dark" || theme === "contrast";
}

function apply(choice: ThemeChoice) {
  const theme = resolveTheme(choice);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = isDarkTheme(theme)
    ? "dark"
    : "light";
}

export function setThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === "system") window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, choice);
  } catch {
    // The selection still works for this page even when storage is blocked.
  }
  current = choice;
  apply(current);
  window.dispatchEvent(new Event("nah:theme-change"));
}

let current = initialThemeChoice();
apply(current);
for (const query of [darkQuery, contrastQuery])
  query?.addEventListener("change", () => {
    if (current === "system") apply(current);
  });
