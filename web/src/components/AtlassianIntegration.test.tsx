import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { Provider } from "../app/integrations";
import { ConnectDialog } from "./Integrations";

const provider: Provider = {
  id: "atlassian",
  available: true,
  login: "pasted_redirect",
  services: ["jira", "confluence"],
  levels: [
    { id: "read", available: true },
    { id: "full", available: true },
  ],
};
const noop = () => {};
it("defaults to a read request and passes an explicit write choice to the login", async () => {
  const onContinue = vi.fn();
  const view = render(
    <ConnectDialog
      provider={provider}
      stage={{ stage: "intro" }}
      onContinue={onContinue}
      onPassword={noop}
      onPaste={noop}
      onFolders={noop}
      onRestart={noop}
      onClose={noop}
    />,
  );
  expect(
    (
      within(view.getByTestId("integration-level-read")).getByRole(
        "radio",
      ) as HTMLInputElement
    ).checked,
  ).toBe(true);
  await userEvent.click(view.getByTestId("integration-level-full"));
  await userEvent.click(view.getByTestId("integration-continue"));
  expect(onContinue).toHaveBeenCalledWith("full");
});
it("keeps the complete administrator request visible on both sides of opening consent", async () => {
  const user = userEvent.setup();
  const view = render(
    <ConnectDialog
      provider={provider}
      stage={{
        stage: "login",
        view: {
          schema_version: 1,
          state: "open_url",
          provider: "atlassian",
          attempt_id: "20261109T100000.000000001",
          authorization_url:
            "https://auth.atlassian.com/authorize?state=fixture",
          redirect_prefix: "http://127.0.0.1:45678/callback",
          expires_at: "2099-01-01T00:00:00Z",
        },
      }}
      onContinue={noop}
      onPassword={noop}
      onPaste={noop}
      onFolders={noop}
      onRestart={noop}
      onClose={noop}
    />,
  );
  const request = view.getByTestId("atlassian-approval-text").textContent;
  await user.click(
    within(view.getByTestId("atlassian-approval-request")).getByRole("button"),
  );
  expect(await navigator.clipboard.readText()).toBe(request);
  await user.click(view.getByTestId("integration-provider-link"));
  expect(view.getByTestId("atlassian-approval-text").textContent).toBe(request);
  expect(view.getByTestId("integration-redirect-input")).toBeTruthy();
});
