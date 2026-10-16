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
it("trims a name before writing and offers reload if acknowledgement fails", async () => {
  let failed = false;
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (_input, init) => {
      if (init?.method === "PUT") {
        expect(JSON.parse(String(init.body))).toEqual({ name: "Example" });
        failed = true;
        return new Response(null, { status: 503 });
      }
      return new Response(
        JSON.stringify({
          schema_version: 1,
          default_limit_bytes: 1073741824,
          name: "Initial",
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
  fireEvent.click(await screen.findByRole("button", { name: "Muokkaa" }));
  const input = await screen.findByRole("textbox", { name: "Palvelimen nimi" });
  fireEvent.change(input, { target: { value: " Example " } });
  fireEvent.click(screen.getByRole("button", { name: "Tallenna nimi" }));
  await screen.findByRole("button", { name: "Lataa tiedot uudelleen" });
  expect(failed).toBe(true);
  fireEvent.click(
    screen.getByRole("button", { name: "Lataa tiedot uudelleen" }),
  );
  expect(
    (
      (await screen.findByRole("textbox", {
        name: "Palvelimen nimi",
      })) as HTMLInputElement
    ).value,
  ).toBe(" Example ");
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
});
