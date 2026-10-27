import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GitLabConnection as Connection } from "../app/gitlab";
import { GitLabCard, GitLabDialog } from "./GitLabConnection";

const noop = () => {};
const now = Date.parse("2026-10-27T10:00:00Z");
const connection: Connection = {
  id: "gitlab_0123456789abcdef01234567",
  base_url: "https://gitlab.com",
  user: "aino",
  kind: "pat",
  ambiguous: false,
  git: "registered",
};
const card = (props: Partial<Parameters<typeof GitLabCard>[0]> = {}) =>
  render(
    <GitLabCard
      connection={connection}
      now={now}
      onCheck={noop}
      onReplace={noop}
      onRepair={noop}
      onDisconnect={noop}
      {...props}
    />,
  );

describe("GitLab connect form", () => {
  it("starts from gitlab.com, links GitLab's token page for the typed address and refuses a second account on a server", async () => {
    const onSubmit = vi.fn();
    const view = render(
      <GitLabDialog
        stage={{ stage: "form" }}
        taken={[{ ...connection, base_url: "https://gitlab.yritys.fi" }]}
        onSubmit={onSubmit}
        onRepair={noop}
        onClose={noop}
      />,
    );
    const address = view.getByTestId("gitlab-address") as HTMLInputElement;
    expect(address.value).toBe("https://gitlab.com");
    expect(view.getByTestId("gitlab-token-link").getAttribute("href")).toBe(
      "https://gitlab.com/-/user_settings/personal_access_tokens?name=Open+Habitat&scopes=read_api,write_repository",
    );
    await userEvent.clear(address);
    await userEvent.type(address, "gitlab.yritys.fi");
    await userEvent.tab();
    expect(address.value).toBe("https://gitlab.yritys.fi");
    expect(
      view.getByTestId("gitlab-token-link").getAttribute("href"),
    ).toContain("https://gitlab.yritys.fi/-/user_settings/");
    await userEvent.type(view.getByTestId("gitlab-token-input"), "glpat-x");
    await userEvent.click(view.getByTestId("gitlab-submit"));
    expect(view.getByTestId("gitlab-error").dataset.field).toBe("server");
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.clear(address);
    await userEvent.type(address, "https://gitlab.example.test:8443/gitlab");
    await userEvent.click(view.getByTestId("gitlab-submit"));
    expect(onSubmit).toHaveBeenCalledWith(
      "https://gitlab.example.test:8443/gitlab",
      "glpat-x",
    );
  });

  it("says a read-only connection cannot push once connected", () => {
    const view = render(
      <GitLabDialog
        stage={{
          stage: "done",
          connection,
          token: {
            push: "no",
            scopes: ["read_api"],
            expires_at: "2027-10-27",
            fine: false,
          },
        }}
        onSubmit={noop}
        onRepair={noop}
        onClose={noop}
      />,
    );
    expect(view.getByTestId("gitlab-connected").dataset.push).toBe("no");
    expect(view.getByTestId("gitlab-readonly")).toBeTruthy();
    expect(view.getByTestId("gitlab-done-facts").textContent).toContain(
      "27.10.2027",
    );
  });
});

describe("GitLab card", () => {
  it("shows push and expiry from GitLab's own description", () => {
    const view = card({
      token: {
        state: "ok",
        token: {
          push: "yes",
          scopes: ["read_api", "write_repository"],
          expires_at: "2027-10-27",
          fine: false,
        },
      },
    });
    expect(view.getByTestId("gitlab-push").textContent).toContain(
      "Push toimii",
    );
    expect(view.getByTestId("gitlab-token").dataset.soon).toBeUndefined();
    expect(view.queryByTestId("gitlab-renew")).toBeNull();
  });

  it("warns within 30 days of expiry and offers a new token", () => {
    const view = card({
      token: {
        state: "ok",
        token: {
          push: "unknown",
          scopes: [],
          expires_at: "2026-11-05",
          fine: true,
        },
      },
    });
    expect(view.getByTestId("gitlab-token").dataset.soon).toBe("");
    expect(view.getByTestId("gitlab-token").textContent).toContain(
      "Vanhenee 9 pv:n päästä",
    );
    expect(view.getByTestId("gitlab-renew")).toBeTruthy();
    expect(view.getByTestId("gitlab-push").textContent).toContain(
      "Push ei tiedossa",
    );
  });

  it("says an expired token stops pull and push", () => {
    const view = card({ token: { state: "failed", api: "token_expired" } });
    expect(view.getByTestId("gitlab-connection").dataset.state).toBe("expired");
    expect(view.getByTestId("gitlab-git").textContent).toContain(
      "pull ja push eivät onnistu",
    );
  });

  it("shows a keyring login but never uses it", () => {
    const view = card({ connection: { ...connection, kind: "keyring" } });
    expect(view.getByTestId("gitlab-unsupported").textContent).toContain(
      "avainnipussa",
    );
    expect(view.queryByTestId("gitlab-check")).toBeNull();
  });
});
