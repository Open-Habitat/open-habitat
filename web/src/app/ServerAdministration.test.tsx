import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { ServerAdministration } from "./ServerAdministration";

afterEach(() => vi.restoreAllMocks());
it("renders quota usage, capacity and the bound user's limit", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input) =>
      new Response(
        JSON.stringify(
          String(input).endsWith("/storage")
            ? {
                schema_version: 1,
                users: [
                  {
                    id: "42",
                    username: "alice",
                    administrator: true,
                    unavailable: false,
                    usage_bytes: 2 ** 30,
                    limit_bytes: 8 * 2 ** 30,
                  },
                ],
                filesystem: {
                  capacity_bytes: 4 * 2 ** 30,
                  free_bytes: 2 ** 30,
                },
                overcommitted: true,
              }
            : {
                schema_version: 1,
                default_limit_bytes: 8 * 2 ** 30,
                name: "Example",
                users: [{ id: "42", username: "alice", administrator: true }],
              },
        ),
        { status: 200 },
      ),
  );
  render(
    <MemoryRouter>
      <ServerAdministration csrf="csrf" section="levy" />
    </MemoryRouter>,
  );
  await screen.findByTestId("storage-limit-edit");
  const [disk, user] = screen.getAllByRole("img");
  expect(disk.firstElementChild).toHaveProperty(["style", "width"], "75%");
  expect(user.firstElementChild).toHaveProperty(["style", "width"], "12.5%");
  fireEvent.click(screen.getByTestId("storage-limit-edit"));
  expect(screen.getByTestId("storage-limit-input")).toHaveProperty(
    "value",
    "8",
  );
});
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
  expect(screen.queryByRole("button")).toBeNull();
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
it("treats an equivalent default limit as unchanged", async () => {
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
    if (init?.method === "PUT") writes.push(JSON.parse(String(init.body)));
    return new Response(
      JSON.stringify({
        schema_version: 1,
        default_limit_bytes: 8 * 1024 ** 3,
        name: "A",
        users: [],
      }),
      { status: init?.method === "PUT" ? 204 : 200 },
    );
  });
  render(
    <MemoryRouter>
      <ServerAdministration csrf="csrf" section="levy" />
    </MemoryRouter>,
  );
  const input = (await screen.findByRole("textbox")) as HTMLInputElement;
  for (const text of ["8,0", "8.0", " 8 "]) {
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: text } });
    fireEvent.blur(input);
  }
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "9,5" } });
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.blur(input);
  await waitFor(() =>
    expect(writes).toEqual([{ default_limit_bytes: 9.5 * 1024 ** 3 }]),
  );
});
it("shows healthy storage beside an unavailable account without claiming capacity is safe", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input) =>
      new Response(
        JSON.stringify(
          String(input).endsWith("/storage")
            ? {
                schema_version: 1,
                users: [
                  {
                    id: "42",
                    username: "alice",
                    administrator: true,
                    unavailable: false,
                    usage_bytes: 2 ** 30,
                    limit_bytes: 8 * 2 ** 30,
                  },
                  {
                    id: "43",
                    username: "bob",
                    administrator: false,
                    unavailable: true,
                    usage_bytes: 0,
                    limit_bytes: 0,
                  },
                ],
                filesystem: {
                  capacity_bytes: 40 * 2 ** 30,
                  free_bytes: 32 * 2 ** 30,
                },
                overcommitted: null,
              }
            : {
                schema_version: 1,
                default_limit_bytes: 8 * 2 ** 30,
                name: "Example",
                users: [
                  { id: "42", username: "alice", administrator: true },
                  { id: "43", username: "bob", administrator: false },
                ],
              },
        ),
      ),
  );
  render(
    <MemoryRouter>
      <ServerAdministration csrf="csrf" section="levy" />
    </MemoryRouter>,
  );
  expect(await screen.findByText("1 GiB / 8 GiB")).toBeTruthy();
  expect(
    screen
      .getByTestId("administration-user-bob")
      .querySelector("[data-storage-state=unknown]"),
  ).toBeTruthy();
  expect(
    screen.getByTestId("server-storage").getAttribute("data-overcommitted"),
  ).toBe("unknown");
});
it("says limits are not in use and offers no limit editing without quotas", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input) =>
      new Response(
        JSON.stringify(
          String(input).endsWith("/storage")
            ? {
                schema_version: 1,
                limits: "not_in_use",
                users: [],
                filesystem: {
                  capacity_bytes: 4 * 2 ** 30,
                  free_bytes: 2 ** 30,
                },
                overcommitted: null,
              }
            : {
                schema_version: 1,
                default_limit_bytes: 0,
                name: "Example",
                users: [{ id: "42", username: "alice", administrator: true }],
              },
        ),
        { status: 200 },
      ),
  );
  render(
    <MemoryRouter>
      <ServerAdministration csrf="csrf" section="levy" />
    </MemoryRouter>,
  );
  const disk = await screen.findByTestId("server-storage");
  expect(disk.dataset.limits).toBe("not_in_use");
  await waitFor(() =>
    expect(
      screen.getByTestId("administration-user-alice").textContent,
    ).toContain("Ei rajaa"),
  );
  expect(screen.queryByTestId("storage-limit-edit")).toBeNull();
  expect(screen.queryByText("Oletusraja")).toBeNull();
});
