import { act, cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import example from "../../../contracts/v1/examples/own-machines.json";
import { controlledTransport } from "../test/controlledTransport";
import { OwnMachines } from "./OwnMachines";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("does not let an opening read replace a newer connect reply", async () => {
  const transport = controlledTransport();
  const off = {
    ...example,
    tailscale: { state: "off" },
    peers: [],
    machines: [],
  };
  const login = {
    ...off,
    tailscale: {
      state: "login",
      auth_url: "https://login.tailscale.com/a/example",
    },
  };
  let reads = 0;
  let signal: AbortSignal | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve(Response.json(login));
      if (++reads === 1) return Promise.resolve(Response.json(off));
      signal = init?.signal ?? undefined;
      return transport.reply("opening", Response.json(off));
    }),
  );
  const view = render(<OwnMachines csrf="fixture-csrf" />);
  await userEvent.click(await view.findByTestId("own-machines-add"));
  await waitFor(() => expect(reads).toBe(2));
  await userEvent.click(view.getByTestId("own-machines-connect"));
  await view.findByTestId("own-machines-login-open");
  expect(signal?.aborted).toBe(true);
  // Even a transport that delivers after abort cannot regress the page.
  await act(() => transport.deliver("opening"));
  expect(view.getByTestId("own-machines-login-open")).toBeTruthy();
  expect(view.queryByTestId("own-machines-connect")).toBeNull();
  transport.assertDrained();
});
