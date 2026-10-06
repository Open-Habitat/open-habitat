import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { ServerAdministration } from "./ServerAdministration";
afterEach(() => vi.restoreAllMocks());
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
          name: "Example host",
          users: [{ id: "42", username: "alice", administrator: admin }],
        }),
        { status: 200 },
      );
    });
  render(
    <MemoryRouter>
      <ServerAdministration csrf="csrf" />
    </MemoryRouter>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Anna ylläpitäjärooli" }),
  );
  await screen.findByRole("button", { name: "Poista ylläpitäjärooli" });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
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
        JSON.stringify({ schema_version: 1, name: "Initial", users: [] }),
        { status: 200 },
      );
    });
  render(
    <MemoryRouter>
      <ServerAdministration csrf="csrf" />
    </MemoryRouter>,
  );
  const input = await screen.findByRole("textbox", { name: "Palvelimen nimi" });
  fireEvent.change(input, { target: { value: " Example " } });
  fireEvent.click(screen.getByRole("button", { name: "Tallenna nimi" }));
  await screen.findByRole("button", { name: "Lataa tiedot uudelleen" });
  expect(failed).toBe(true);
  fireEvent.click(
    screen.getByRole("button", { name: "Lataa tiedot uudelleen" }),
  );
  await screen.findByRole("textbox", { name: "Palvelimen nimi" });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
});
