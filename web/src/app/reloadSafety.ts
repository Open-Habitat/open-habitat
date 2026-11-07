// Drafts persist, but a reload must not interrupt an interaction or discard
// an editor buffer. This is ephemeral tab state, not persisted session state.
const blockers = new Set<() => boolean>();
const recentInput = new WeakMap<Element, number>();
const TYPING_PAUSE_MS = 10_000;

export function blockAutomaticReload(blocked: () => boolean) {
  blockers.add(blocked);
  return () => {
    blockers.delete(blocked);
  };
}

export function watchReloadInput() {
  const input = (event: Event) => {
    if (event.target instanceof Element)
      recentInput.set(event.target, Date.now());
  };
  document.addEventListener("input", input, true);
  return () => document.removeEventListener("input", input, true);
}

export function interactionBlocksReload() {
  const focused = document.activeElement;
  if (
    focused &&
    Date.now() - (recentInput.get(focused) ?? -Infinity) < TYPING_PAUSE_MS
  )
    return true;
  // Dialog values may not have draft persistence. Conservatively leave any
  // editable dialog to its owner, including values selected without typing.
  if (
    document.querySelector(
      '[role="dialog"] input, [role="dialog"] textarea, [role="dialog"] select, [role="alertdialog"] input',
    )
  )
    return true;
  return [...blockers].some((blocked) => blocked());
}
