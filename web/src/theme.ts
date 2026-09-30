export type ThemeChoice = "system" | "light" | "dark";
const key = "nah:theme";
const query = window.matchMedia?.("(prefers-color-scheme: dark)");

function initialThemeChoice(): ThemeChoice {
  try {
    const saved = window.localStorage.getItem(key);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Private browsing or disabled storage: the system setting remains usable.
  }
  return "system";
}

export function getThemeChoice(): ThemeChoice {
  return current;
}

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && query?.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
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
query?.addEventListener("change", () => {
  if (current === "system") apply(current);
});
