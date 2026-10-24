import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { IntegrationsSettings } from "./IntegrationsSettings";

// The Gitea half of Asetukset › Integraatiot against a stubbed host: what the
// page does with a write whose outcome it cannot know, and with a reply that
// arrives for a session that is no longer this tab's.

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const connection = {
  id: "gitea_0123456789abcdef01234567",
  base_url: "https://git.example.test",
  user: "person",
  kind: "pat",
  owned: true,
  ambiguous: false,
  git: "registered",
};
const list = (connections: unknown[]) => ({
  schema_version: 1,
  providers: [
    {
      id: "gitea",
      available: true,
      login: "personal_token",
      services: ["git"],
    },
  ],
  skill: "current",
  accounts: [],
  gitea: { state: "ok", connections },
});

/** A host whose tea file gains the connection when the connect write
 * reaches it; the reply to that write is decided by `reply`. */
function host(reply: (written: () => void) => Promise<Response>) {
  const writes: unknown[] = [];
  let connected = false;
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/v1/integrations")
      return json(list(connected ? [connection] : []));
    if (url === "/api/v1/integrations/gitea" && init?.method === "POST") {
      writes.push(JSON.parse(String(init.body)));
      return reply(() => {
        connected = true;
      });
    }
    return new Response("", { status: 404 });
  });
  vi.stubGlobal("fetch", fetch);
  return {
    writes,
    reads: () =>
      fetch.mock.calls.filter(([u]) => String(u) === "/api/v1/integrations")
        .length,
  };
}

async function fillForm() {
  const tile = await screen.findByTestId("integration-tile-gitea");
  await userEvent.click(within(tile).getByTestId("integration-connect-open"));
  const dialog = await screen.findByTestId("gitea-dialog");
  await userEvent.type(
    within(dialog).getByTestId("gitea-address"),
    "git.example.test",
  );
  await userEvent.type(within(dialog).getByTestId("gitea-token"), "pat-1");
  return dialog;
}

it("reads tea's state after a lost connect reply and never sends the token again", async () => {
  const h = host(async (written) => {
    written();
    throw new TypeError("network");
  });
  render(<IntegrationsSettings csrf="session-a" />);
  const dialog = await fillForm();
  const before = h.reads();
  await userEvent.click(within(dialog).getByTestId("gitea-submit"));
  await waitFor(() =>
    expect(screen.getByTestId("gitea-dialog").getAttribute("data-stage")).toBe(
      "uncertain",
    ),
  );
  // The native state is observed: the connection the write made appears.
  await waitFor(() =>
    expect(screen.getAllByTestId("gitea-connection")).toHaveLength(1),
  );
  expect(h.reads()).toBeGreaterThan(before);
  expect(h.writes).toEqual([
    { action: "connect", base_url: "https://git.example.test", token: "pat-1" },
  ]);
  // Nothing in the uncertain dialog offers to send it again.
  expect(within(dialog).queryByTestId("gitea-submit")).toBeNull();
  expect(within(dialog).queryByTestId("gitea-token")).toBeNull();
});

it("a 5xx is as uncertain as a lost reply", async () => {
  const h = host(async (written) => {
    written();
    return json({ error: { code: "internal" } }, 502);
  });
  render(<IntegrationsSettings csrf="session-a" />);
  const dialog = await fillForm();
  await userEvent.click(within(dialog).getByTestId("gitea-submit"));
  await waitFor(() =>
    expect(dialog.getAttribute("data-stage")).toBe("uncertain"),
  );
  expect(h.writes).toHaveLength(1);
});

it("closes the form with its token when another login replaces the session", async () => {
  let answer: (r: Response) => void = () => {};
  const h = host(
    (written) =>
      new Promise<Response>((resolve) => {
        answer = (r) => {
          written();
          resolve(r);
        };
      }),
  );
  const view = render(<IntegrationsSettings csrf="session-a" />);
  const dialog = await fillForm();
  await userEvent.click(within(dialog).getByTestId("gitea-submit"));
  await waitFor(() =>
    expect(
      within(dialog).getByTestId("gitea-submit").hasAttribute("disabled"),
    ).toBe(true),
  );
  view.rerender(<IntegrationsSettings csrf="session-b" />);
  // The previous person's form, token and pending write are not the next
  // person's: the dialog is gone, not left waiting.
  expect(screen.queryByTestId("gitea-dialog")).toBeNull();
  await act(async () => {
    answer(
      json({
        schema_version: 1,
        outcome: "written",
        connection,
        api: "ok",
      }),
    );
  });
  expect(screen.queryByTestId("gitea-dialog")).toBeNull();
  expect(screen.queryByTestId("gitea-check-result")).toBeNull();
  expect(h.writes).toHaveLength(1);
});
