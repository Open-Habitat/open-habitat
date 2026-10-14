import { fireEvent, render, screen } from "@testing-library/react";
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
