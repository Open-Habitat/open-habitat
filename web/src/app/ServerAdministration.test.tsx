import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { ServerAdministration } from "./ServerAdministration";

afterEach(() => vi.restoreAllMocks());
it("renders quota usage, capacity, overcommit and the bound user's limit", async () => {
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
  const { rerender } = render(
    <MemoryRouter>
      <ServerAdministration csrf="csrf" section="kayttajat" />
    </MemoryRouter>,
  );
  expect(await screen.findByText("1 GiB / 8 GiB")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Raja…" }));
  expect(
    screen.getByRole("textbox", { name: "alice: raja (GiB)" }),
  ).toHaveProperty("value", "8");
  rerender(
    <MemoryRouter>
      <ServerAdministration csrf="csrf" section="levy" />
    </MemoryRouter>,
  );
  expect(screen.getByText(/4 GiB yhteensä · 1 GiB vapaana/)).toBeTruthy();
  expect(screen.getByText(/Rajojen summa ylittää levyn koon/)).toBeTruthy();
});
it("lists only bound identities and refreshes after a role update", async () => {
  let admin = false;
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (_input, init) => {
      if (init?.method === "PUT") {
        expect(init.headers).toMatchObject({ "X-Agent-Host-CSRF": "csrf" });
        expect(JSON.parse(String(init.body))).toEqual({
          subject: "42",
          administrator: true,
        });
        admin = true;
        return new Response(null, { status: 204 });
      }
      return new Response(
        JSON.stringify({
          schema_version: 1,
          default_limit_bytes: 1073741824,
          name: "Example host",
          users: [{ id: "42", username: "alice", administrator: admin }],
        }),
        { status: 200 },
      );
    });
  render(
    <MemoryRouter>
      <ServerAdministration csrf="csrf" section="kayttajat" />
    </MemoryRouter>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Anna ylläpitäjärooli" }),
  );
  await screen.findByRole("button", { name: "Poista ylläpitäjärooli" });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  expect(screen.queryByText(/credentials|home path/i)).toBeNull();
});
it("saves a trimmed name on blur and keeps the typed text when the save fails", async () => {
  let fail = true;
  const writes: unknown[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
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
  const input = (await screen.findByRole("textbox", {
    name: "Palvelimen nimi",
  })) as HTMLInputElement;
  expect(screen.queryByRole("button", { name: /Muokkaa|Tallenna/ })).toBeNull();
  // Leaving the field unchanged writes nothing.
  fireEvent.focus(input);
  fireEvent.blur(input);
  expect(writes).toEqual([]);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: " Example " } });
  fireEvent.blur(input);
  expect(await screen.findByText(/Ei tallennettu/)).toBeTruthy();
  expect(writes).toEqual([{ name: "Example" }]);
  expect(input.value).toBe(" Example ");
  fail = false;
  fireEvent.keyDown(input, { key: "Enter" });
  expect(await screen.findByText("Tallennettu")).toBeTruthy();
  expect(writes).toEqual([{ name: "Example" }, { name: "Example" }]);
  expect(screen.queryByText(/Ei tallennettu/)).toBeNull();
  // An empty name is not sent; Escape returns to the saved value.
  fireEvent.change(input, { target: { value: "  " } });
  fireEvent.blur(input);
  expect(await screen.findByText(/tyhjä/)).toBeTruthy();
  expect(writes).toHaveLength(2);
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input.value).toBe("Example");
});
