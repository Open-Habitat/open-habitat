import { afterEach, expect, it, vi } from "vitest";
import {
  blockAutomaticReload,
  interactionBlocksReload,
  watchReloadInput,
} from "./reloadSafety";

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

it("protects recent focused input, not an idle persisted draft", () => {
  vi.useFakeTimers();
  const stop = watchReloadInput();
  const composer = document.createElement("textarea");
  document.body.append(composer);
  composer.value = "draft";
  composer.focus();
  expect(interactionBlocksReload()).toBe(false);
  composer.dispatchEvent(new Event("input", { bubbles: true }));
  expect(interactionBlocksReload()).toBe(true);
  composer.blur();
  expect(interactionBlocksReload()).toBe(false);
  composer.focus();
  vi.advanceTimersByTime(10_000);
  expect(interactionBlocksReload()).toBe(false);
  stop();
});

it("protects editable dialogs even when their input is not focused", () => {
  document.body.innerHTML = '<div role="dialog"><input value="unsaved"></div>';
  expect(interactionBlocksReload()).toBe(true);
  document.body.replaceChildren();
  expect(interactionBlocksReload()).toBe(false);
});

it("reads the editor's current dirty/saving state and releases it on unmount", () => {
  let dirty = false;
  const dispose = blockAutomaticReload(() => dirty);
  expect(interactionBlocksReload()).toBe(false);
  dirty = true;
  expect(interactionBlocksReload()).toBe(true);
  dispose();
  expect(interactionBlocksReload()).toBe(false);
});
