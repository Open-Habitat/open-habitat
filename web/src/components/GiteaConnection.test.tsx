import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GiteaConnection } from "../app/gitea";
import { GiteaDialog, type GiteaStage } from "./GiteaConnection";

const noop = () => {};
const connection: GiteaConnection = {
  id: "gitea_0123456789abcdef01234567",
  base_url: "https://git.example.test",
  user: "person",
  kind: "pat",
  owned: true,
  ambiguous: false,
  git: "registered",
};

describe("Gitea connect form", () => {
  it("adds https only on leaving the address and refuses before sending", async () => {
    const onSubmit = vi.fn();
    const view = render(
      <GiteaDialog
        stage={{ stage: "form" }}
        onSubmit={onSubmit}
        onRepair={noop}
        onClose={noop}
      />,
    );
    const address = view.getByTestId("gitea-address") as HTMLInputElement;
    await userEvent.type(address, "git.example.test:3000/gitea");
    expect(address.value).toBe("git.example.test:3000/gitea");
    await userEvent.click(view.getByTestId("gitea-submit"));
    // No token: refused here, at the top, with focus on the error and the
    // token field marked; the address the person gave is kept, completed.
    const error = view.getByTestId("gitea-error");
    expect(error.dataset.field).toBe("token");
    expect(document.activeElement).toBe(error);
    expect(view.getByTestId("gitea-token").getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(address.value).toBe("https://git.example.test:3000/gitea");
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.type(view.getByTestId("gitea-token"), "pat-1");
    await userEvent.click(view.getByTestId("gitea-submit"));
    expect(onSubmit).toHaveBeenCalledWith(
      "https://git.example.test:3000/gitea",
      "pat-1",
    );
  });

  it("keeps both fields on a refusal and drops the token once connected", async () => {
    const stage = (s: GiteaStage) => (
      <GiteaDialog stage={s} onSubmit={noop} onRepair={noop} onClose={noop} />
    );
    const view = render(stage({ stage: "form" }));
    await userEvent.type(view.getByTestId("gitea-address"), "http://x.test");
    await userEvent.type(view.getByTestId("gitea-token"), "pat-1");
    view.rerender(
      stage({ stage: "form", error: { field: "token", text: "refused" } }),
    );
    const error = view.getByTestId("gitea-error");
    expect(document.activeElement).toBe(error);
    expect((view.getByTestId("gitea-address") as HTMLInputElement).value).toBe(
      "http://x.test",
    );
    expect((view.getByTestId("gitea-token") as HTMLInputElement).value).toBe(
      "pat-1",
    );
    view.rerender(stage({ stage: "done", connection }));
    expect(view.getByTestId("gitea-connected").dataset.git).toBe("registered");
    // Back on the form (another connection) nothing of the token remains.
    view.rerender(stage({ stage: "form" }));
    expect((view.getByTestId("gitea-token") as HTMLInputElement).value).toBe(
      "",
    );
  });

  it("an explicit non-https scheme is never rewritten into https", async () => {
    const onSubmit = vi.fn();
    const view = render(
      <GiteaDialog
        stage={{ stage: "form" }}
        onSubmit={onSubmit}
        onRepair={noop}
        onClose={noop}
      />,
    );
    await userEvent.type(view.getByTestId("gitea-address"), "http://x.test");
    await userEvent.type(view.getByTestId("gitea-token"), "pat-1");
    await userEvent.click(view.getByTestId("gitea-submit"));
    expect(view.getByTestId("gitea-error").dataset.field).toBe("server");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("offers repair when the token was stored but Git does not use it", async () => {
    const onRepair = vi.fn();
    const view = render(
      <GiteaDialog
        stage={{ stage: "done", connection: { ...connection, git: "absent" } }}
        onSubmit={noop}
        onRepair={onRepair}
        onClose={noop}
      />,
    );
    await userEvent.click(view.getByTestId("gitea-repair"));
    expect(onRepair).toHaveBeenCalledWith({ ...connection, git: "absent" });
  });
});
