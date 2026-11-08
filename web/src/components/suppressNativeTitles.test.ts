import { expect, test } from "vitest";
import { suppressNativeTitles } from "./suppressNativeTitles";

test("native help stays suppressed across inserts and updates, then restores current titles and names", async () => {
  const root = document.createElement("div");
  root.innerHTML =
    '<button title="Original"></button><button aria-label="Name" title="Help">Text</button>';
  document.body.append(root);
  const [empty, named] = root.querySelectorAll("button");
  const restore = suppressNativeTitles(root);
  expect(empty.title).toBe("");
  expect(empty.getAttribute("aria-label")).toBe("Original");
  expect(named.getAttribute("aria-label")).toBe("Name");
  empty.title = "Updated";
  const inserted = document.createElement("span");
  inserted.title = "Inserted";
  root.append(inserted);
  await Promise.resolve();
  expect(empty.title).toBe("");
  expect(empty.getAttribute("aria-label")).toBe("Updated");
  expect(inserted.title).toBe("");
  named.removeAttribute("title");
  await Promise.resolve();
  restore();
  expect(empty.title).toBe("Updated");
  expect(empty.hasAttribute("aria-label")).toBe(false);
  expect(named.hasAttribute("title")).toBe(false);
  expect(named.getAttribute("aria-label")).toBe("Name");
  expect(inserted.title).toBe("Inserted");
  root.remove();
});

test("keeps explicit label associations and respects a title cleared during Explain", async () => {
  const root = document.createElement("div");
  root.innerHTML =
    '<label for="hover-input">Field</label><input id="hover-input" title="Hint"><button title="Clear me"></button>';
  document.body.append(root);
  const input = root.querySelector("input");
  const button = root.querySelector("button");
  if (!input || !button) throw new Error("Missing test controls");
  const restore = suppressNativeTitles(root);
  expect(input.hasAttribute("aria-label")).toBe(false);
  button.title = "";
  await Promise.resolve();
  restore();
  expect(button.title).toBe("");
  expect(button.hasAttribute("aria-label")).toBe(false);
  expect(input.title).toBe("Hint");
  root.remove();
});
