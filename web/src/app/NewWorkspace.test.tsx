import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { NewWorkspace } from "./NewWorkspace";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});
it("keeps an already-open dialog read-only after losing a confirmed snapshot", () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = () => {};
  const requests = vi.fn(
    async (_input: RequestInfo | URL) => new Response("", { status: 503 }),
  );
  vi.stubGlobal("fetch", requests);
  const props = {
    csrf: "test",
    token: "obs_token123",
    onClose: vi.fn(),
    onCreated: vi.fn(),
    refresh: vi.fn(),
  };
  const view = render(<NewWorkspace {...props} available />);
  fireEvent.click(screen.getByRole("button", { name: "Uusi hakemisto" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Nimi" }), {
    target: { value: "safe-name" },
  });
  view.rerender(<NewWorkspace {...props} available={false} />);
  expect(
    screen
      .getByRole("button", { name: "Luo työtila" })
      .hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Luo työtila" }));
  expect(
    requests.mock.calls.some(([url]) => url === "/api/v1/workspaces"),
  ).toBe(false);
});
it("clones with a live signal under Strict Mode's replayed effects", async () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = () => {};
  const signals: (AbortSignal | undefined)[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/clone/stream")) {
        signals.push(init?.signal ?? undefined);
        return new Response(
          'event: terminal\ndata: {"schema_version":1,"sequence":1,"kind":"terminal","outcome":"confirmed"}\n\n',
          {
            status: 200,
            headers: { "content-type": "text/event-stream; charset=utf-8" },
          },
        );
      }
      return new Response("", { status: 503 });
    }),
  );
  const onCreated = vi.fn();
  render(
    <StrictMode>
      <NewWorkspace
        csrf="test"
        available
        onClose={vi.fn()}
        onCreated={onCreated}
        refresh={vi.fn()}
      />
    </StrictMode>,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Repositorio" }), {
    target: { value: "owner/repo" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Luo työtila" }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith("repo"));
  expect(signals).toHaveLength(1);
  expect(signals[0]?.aborted).toBe(false);
});
