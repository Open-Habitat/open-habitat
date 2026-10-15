export type WorkPreference = "hidden" | "visible";
const key = "nah:agent-work";
let current: WorkPreference = (() => {
  try {
    return window.localStorage.getItem(key) === "visible"
      ? "visible"
      : "hidden";
  } catch {
    return "hidden";
  }
})();

export function getWorkPreference(): WorkPreference {
  return current;
}

export function setWorkPreference(choice: WorkPreference) {
  current = choice;
  try {
    window.localStorage.setItem(key, choice);
  } catch {
    // The choice remains effective for this page when storage is denied.
  }
  window.dispatchEvent(new Event("nah:work-change"));
}
