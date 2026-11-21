import { useSyncExternalStore } from "react";

// Whether Hiljaiset is folded is this device's choice, not the account's:
// a phone may fold what a desktop keeps open (rail-quiet-all-flat). Until
// the person chooses on this device, Hiljaiset folds itself while the rail
// is crowded (rail-scroll-region), so Sinun vuorosi and Käynnissä keep the
// room; a press on its heading is a choice and is kept either way.
const key = "nah:rail-quiet-folded";
const events = new EventTarget();
/** "auto" until the person has folded or opened Hiljaiset on this device. */
export type QuietFoldChoice = "folded" | "open" | "auto";
// Used only where storage refuses the choice.
let memory: QuietFoldChoice | undefined;

function read(): QuietFoldChoice {
  try {
    const value = window.localStorage.getItem(key);
    return value === "1" ? "folded" : value === "0" ? "open" : "auto";
  } catch {
    return "auto";
  }
}

export function setQuietFolded(folded: boolean) {
  try {
    window.localStorage.setItem(key, folded ? "1" : "0");
  } catch {
    // Storage denied: the choice lasts until the page reloads.
    memory = folded ? "folded" : "open";
  }
  events.dispatchEvent(new Event("change"));
}

function subscribe(callback: () => void) {
  events.addEventListener("change", callback);
  // Another tab of the same browser folds this one too.
  const storage = (event: StorageEvent) => {
    if (event.key === key) callback();
  };
  window.addEventListener("storage", storage);
  return () => {
    events.removeEventListener("change", callback);
    window.removeEventListener("storage", storage);
  };
}

export function useQuietFoldChoice(): QuietFoldChoice {
  return useSyncExternalStore(subscribe, () => memory ?? read());
}

/** Folded by the person's choice, or by itself while the rail is crowded
 * and the person has not chosen. */
export function quietFolded(choice: QuietFoldChoice, crowded: boolean) {
  return choice === "folded" || (choice === "auto" && crowded);
}
