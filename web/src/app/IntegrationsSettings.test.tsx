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

// Gitea in Asetukset › Koodipalvelut against a stubbed host: what the
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
 * reaches it; the reply to that write is decided by `reply`. A check,
 * which the page also makes by itself, answers with `push`. */
function host(
  reply: (written: () => void) => Promise<Response>,
  opts: { connected?: boolean; push?: string } = {},
) {
  const writes: unknown[] = [];
  const checks: unknown[] = [];
  let connected = !!opts.connected;
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/v1/integrations")
      return json(list(connected ? [connection] : []));
    if (url === "/api/v1/integrations/gitea" && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      if (body.action === "check") {
        checks.push(body);
        return json({
          schema_version: 1,
          outcome: "checked",
          connection,
          api: "ok",
          push: opts.push ?? "allowed",
        });
      }
      writes.push(body);
      return reply(() => {
        connected = true;
      });
    }
    return new Response("", { status: 404 });
  });
  vi.stubGlobal("fetch", fetch);
  return {
    writes,
    checks,
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

it("checks a shown connection once by itself and names a read-only token", async () => {
  const h = host(async () => json({}, 500), {
    connected: true,
    push: "read_only",
  });
  render(<IntegrationsSettings csrf="session-a" />);
  const card = await screen.findByTestId("gitea-connection");
  await waitFor(() => expect(card.getAttribute("data-push")).toBe("read_only"));
  expect(within(card).getByTestId("gitea-push").textContent).toContain(
    "push ei onnistu",
  );
  expect(h.checks).toEqual([{ action: "check", connection_id: connection.id }]);
  expect(h.writes).toEqual([]);
});

it("a connect's own answer is not checked again", async () => {
  const h = host(async (written) => {
    written();
    return json({
      schema_version: 1,
      outcome: "written",
      connection,
      api: "ok",
      push: "allowed",
    });
  });
  render(<IntegrationsSettings csrf="session-a" />);
  const dialog = await fillForm();
  await userEvent.click(within(dialog).getByTestId("gitea-submit"));
  await waitFor(() => expect(dialog.getAttribute("data-stage")).toBe("done"));
  await waitFor(() =>
    expect(
      screen.getByTestId("gitea-connection").getAttribute("data-push"),
    ).toBe("allowed"),
  );
  expect(h.checks).toEqual([]);
});

it("the person's own write waits for the automatic check in flight", async () => {
  const order: string[] = [];
  let answerCheck: () => void = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/integrations") return json(list([connection]));
      if (url !== "/api/v1/integrations/gitea")
        return new Response("", { status: 404 });
      const body = JSON.parse(String(init?.body));
      order.push(`${body.action}:start`);
      if (body.action === "check")
        await new Promise<void>((resolve) => {
          answerCheck = resolve;
        });
      order.push(`${body.action}:end`);
      return body.action === "check"
        ? json({
            schema_version: 1,
            outcome: "checked",
            connection,
            api: "ok",
            push: "read_only",
          })
        : json({
            schema_version: 1,
            outcome: "written",
            removed: { id: connection.id },
          });
    }),
  );
  render(<IntegrationsSettings csrf="session-a" />);
  const card = await screen.findByTestId("gitea-connection");
  await waitFor(() => expect(order).toEqual(["check:start"]));
  await userEvent.click(within(card).getByTestId("gitea-disconnect-open"));
  await userEvent.click(await screen.findByTestId("gitea-disconnect-confirm"));
  // Not sent beside the check, where the daemon would refuse it as busy.
  expect(order).toEqual(["check:start"]);
  await act(async () => answerCheck());
  await waitFor(() =>
    expect(order).toEqual([
      "check:start",
      "check:end",
      "disconnect:start",
      "disconnect:end",
    ]),
  );
});

// A start the host refuses before any attempt exists (here: another
// provider's first synchronization holds the single sign-in slot) says why,
// not only that the sign-in did not succeed.
it("shows why the host refused to start a sign-in", async () => {
  const starts: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/integrations")
        return json({
          schema_version: 1,
          providers: [
            {
              id: "dropbox",
              available: true,
              login: "pasted_redirect",
              services: ["dropbox"],
            },
          ],
          skill: "current",
          accounts: [],
        });
      if (url === "/api/v1/integrations/login" && init?.method === "POST") {
        starts.push(JSON.parse(String(init.body)));
        return json(
          {
            schema_version: 1,
            error: {
              code: "attempt_active",
              message: "Request could not be completed",
              retryable: false,
              correlation_id: "req_00000000",
            },
          },
          409,
        );
      }
      if (url === "/api/v1/integrations/login")
        return json({ schema_version: 1, state: "none" });
      return new Response("", { status: 404 });
    }),
  );
  render(<IntegrationsSettings csrf="session-a" />);
  const tile = await screen.findByTestId("integration-tile-dropbox");
  await userEvent.click(within(tile).getByTestId("integration-connect-open"));
  const dialog = await screen.findByTestId("integration-dialog");
  const go = within(dialog).queryByTestId("integration-continue");
  if (go) await userEvent.click(go);
  const failed = await within(dialog).findByTestId("integration-login-failed");
  expect(starts).toEqual([{ action: "start", provider: "dropbox" }]);
  expect(failed.textContent).toContain("ensimmäinen synkronointi on kesken");
});

// A refused write's text belongs to the step it answered. When the daemon
// then fails the attempt for its own reason, the failure is not relabelled
// with the earlier refusal.
it("does not carry a refused paste into the daemon's later failure", async () => {
  const attempt = "20261110T080000.000000001";
  let state: "open_url" | "failed" = "open_url";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/integrations")
        return json({
          schema_version: 1,
          providers: [
            {
              id: "dropbox",
              available: true,
              login: "pasted_redirect",
              services: ["dropbox"],
            },
          ],
          skill: "current",
          accounts: [],
        });
      if (url.split("?")[0] !== "/api/v1/integrations/login")
        return new Response("", { status: 404 });
      if (init?.method === "PUT") {
        state = "failed";
        return json(
          {
            schema_version: 1,
            error: {
              code: "redirect_invalid",
              message: "Request could not be completed",
              retryable: false,
              correlation_id: "req_00000000",
            },
          },
          422,
        );
      }
      return json(
        state === "open_url"
          ? {
              schema_version: 1,
              state,
              provider: "dropbox",
              attempt_id: attempt,
              authorization_url: "https://www.dropbox.com/oauth2/authorize",
              redirect_prefix: "http://127.0.0.1:53682/",
              expires_at: "2099-01-01T00:00:00Z",
            }
          : {
              schema_version: 1,
              state,
              provider: "dropbox",
              attempt_id: attempt,
              failure: "tool_failed",
            },
      );
    }),
  );
  render(<IntegrationsSettings csrf="session-a" />);
  const tile = await screen.findByTestId("integration-tile-dropbox");
  await userEvent.click(within(tile).getByTestId("integration-connect-open"));
  const dialog = await screen.findByTestId("integration-dialog");
  const go = within(dialog).queryByTestId("integration-continue");
  if (go) await userEvent.click(go);
  await userEvent.click(
    await within(dialog).findByTestId("integration-provider-link"),
  );
  await userEvent.type(
    within(dialog).getByTestId("integration-redirect-input"),
    "http://127.0.0.1:53682/?code=x&state=y",
  );
  await userEvent.keyboard("{Enter}");
  const failed = await within(dialog).findByTestId(
    "integration-login-failed",
    {},
    { timeout: 4000 },
  );
  expect(failed.textContent).toContain("Kirjautuminen ei onnistunut");
});

// Each provider has its own sign-in at the host. A dialog reads only its
// own provider's attempt, so another provider's first sync, which is the
// session's latest attempt, never stands in for it or stops its polling.
it("polls only its own provider's sign-in while another first sync runs", async () => {
  const attempt = "20261110T080000.000000002";
  let pasted = false;
  const reads: string[] = [];
  const microsoft = {
    schema_version: 1,
    state: "completing",
    provider: "microsoft",
    attempt_id: "20261110T090000.000000001",
    address: "person@work.example.test",
    progress: { service: "onedrive", phase: "transferring" },
  };
  const dropbox = (state: string) => ({
    schema_version: 1,
    state,
    provider: "dropbox",
    attempt_id: attempt,
    ...(state === "open_url"
      ? {
          authorization_url: "https://www.dropbox.com/oauth2/authorize",
          redirect_prefix: "http://127.0.0.1:53682/",
          expires_at: "2099-01-01T00:00:00Z",
        }
      : state === "completed"
        ? { address: "person@example.test" }
        : {}),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/integrations")
        return json({
          schema_version: 1,
          providers: [
            {
              id: "dropbox",
              available: true,
              login: "pasted_redirect",
              services: ["dropbox"],
            },
          ],
          skill: "current",
          accounts: [],
        });
      if (url.split("?")[0] !== "/api/v1/integrations/login")
        return new Response("", { status: 404 });
      if (init?.method === "POST") return json(dropbox("open_url"));
      if (init?.method === "PUT") {
        pasted = true;
        return json(dropbox("completing"));
      }
      reads.push(url);
      if (url.endsWith("?provider=dropbox"))
        return json(dropbox(pasted ? "completed" : "open_url"));
      return json(microsoft);
    }),
  );
  render(<IntegrationsSettings csrf="session-a" />);
  const tile = await screen.findByTestId("integration-tile-dropbox");
  await userEvent.click(within(tile).getByTestId("integration-connect-open"));
  const dialog = await screen.findByTestId("integration-dialog");
  const go = within(dialog).queryByTestId("integration-continue");
  if (go) await userEvent.click(go);
  await userEvent.click(
    await within(dialog).findByTestId("integration-provider-link"),
  );
  await userEvent.type(
    within(dialog).getByTestId("integration-redirect-input"),
    "http://127.0.0.1:53682/?code=x&state=y",
  );
  await userEvent.keyboard("{Enter}");
  const done = await within(dialog).findByTestId(
    "integration-connected",
    {},
    { timeout: 4000 },
  );
  expect(done.textContent).toContain("person@example.test");
  // The page's one unscoped read resumes a sign-in after a reload; every
  // poll of the open dialog names its provider.
  expect(reads.slice(1).length).toBeGreaterThan(0);
  expect(reads.slice(1).every((r) => r.endsWith("?provider=dropbox"))).toBe(
    true,
  );
});
