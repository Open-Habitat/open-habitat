import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { ServerAdministration } from "./ServerAdministration";

afterEach(() => vi.restoreAllMocks());
it("saves a trimmed name on blur and keeps the typed text when the save fails", async () => {
  let fail = true;
  const writes: unknown[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (String(input).endsWith("/storage"))
      return new Response(
        JSON.stringify({
          schema_version: 1,
          users: [],
          filesystem: { capacity_bytes: 4 * 2 ** 30, free_bytes: 2 ** 30 },
          overcommitted: false,
        }),
        { status: 200 },
      );
    if (init?.method === "PUT") {
      writes.push(JSON.parse(String(init.body)));
      return new Response(null, { status: fail ? 503 : 204 });
    }
    return new Response(
      JSON.stringify({
        schema_version: 1,
        default_language: "system",
        default_limit_bytes: 1073741824,
        name: writes.length && !fail ? "Example" : "Initial",
        users: [],
      }),
      { status: 200 },
    );
  });
  render(
    <MemoryRouter>
      <ServerAdministration csrf="csrf" />
    </MemoryRouter>,
  );
  const input = (await screen.findByRole("textbox")) as HTMLInputElement;
  // The name saves on blur: no save button beside it.
  expect(screen.queryByRole("button", { name: /tallenna/i })).toBeNull();
  // Leaving the field unchanged writes nothing.
  fireEvent.focus(input);
  fireEvent.blur(input);
  expect(writes).toEqual([]);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: " Example " } });
  fireEvent.blur(input);
  await screen.findByRole("alert");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(writes).toEqual([{ name: "Example" }]);
  expect(input.value).toBe(" Example ");
  fail = false;
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => {
    expect(input.readOnly).toBe(false);
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(input.value).toBe("Example");
  });
  expect(writes).toEqual([{ name: "Example" }, { name: "Example" }]);
  expect(screen.queryByRole("alert")).toBeNull();
  // An empty name is not sent; Escape returns to the saved value.
  fireEvent.change(input, { target: { value: "  " } });
  fireEvent.blur(input);
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(writes).toHaveLength(2);
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input.value).toBe("Example");
});

it("does not let typing during a save be overwritten by its reply", async () => {
  let release!: () => void;
  const writes: unknown[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (String(input).endsWith("/storage"))
      return new Response(
        JSON.stringify({
          schema_version: 1,
          users: [],
          filesystem: { capacity_bytes: 4 * 2 ** 30, free_bytes: 2 ** 30 },
          overcommitted: false,
        }),
        { status: 200 },
      );
    if (init?.method === "PUT") {
      writes.push(JSON.parse(String(init.body)));
      await new Promise<void>((r) => {
        release = r;
      });
      return new Response(null, { status: 204 });
    }
    return new Response(
      JSON.stringify({
        schema_version: 1,
        default_language: "system",
        default_limit_bytes: 8 * 1024 ** 3,
        name: writes.length ? "B" : "A",
        users: [],
      }),
      { status: 200 },
    );
  });
  render(
    <MemoryRouter>
      <ServerAdministration csrf="csrf" section="palvelin" />
    </MemoryRouter>,
  );
  const input = (await screen.findByRole("textbox")) as HTMLInputElement;
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "B" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(input.readOnly).toBe(true);
  release();
  await waitFor(() => expect(input.readOnly).toBe(false));
  expect(input.readOnly).toBe(false);
});
