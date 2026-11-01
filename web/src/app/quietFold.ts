import { useSyncExternalStore } from "react";

// Whether Hiljaiset is folded is this device's choice, not the account's:
// a phone may fold what a desktop keeps open (rail-quiet-all-flat).
const key = "nah:rail-quiet-folded";
const events = new EventTarget();
// Used only where storage refuses the choice.
let memory: boolean | undefined;

function read() {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function setQuietFolded(folded: boolean) {
  try {
    if (folded) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    // Storage denied: the choice lasts until the page reloads.
    memory = folded;
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

export function useQuietFolded() {
  return useSyncExternalStore(subscribe, () => memory ?? read());
}
