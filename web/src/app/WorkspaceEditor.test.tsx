import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EditorHeaderControls, WorkspaceEditor } from "./WorkspaceEditor";

vi.mock("./editor", async (original) => ({
  ...(await original<typeof import("./editor")>()),
  editorStatus: vi.fn().mockResolvedValue("running"),
  mintEditorHandoff: vi.fn().mockResolvedValue({
    token: "synthetic-handoff",
    origin: "https://editor.example.test",
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("focuses the conversation after expanding it, without racing an animation frame", async () => {
  // A browser animation frame is not evidence that React committed expansion.
  // Keep frames pending: focus must follow the commit that unhides the field.
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
  render(
    <WorkspaceEditor workspaceId="ws_synthetic" csrf="synthetic-csrf">
      <EditorHeaderControls />
      <textarea data-testid="message-input" />
    </WorkspaceEditor>,
  );
  fireEvent.click(await screen.findByTestId("toggle-editor"));
  const frame = await screen.findByTestId("workspace-editor");
  fireEvent.click(screen.getByTestId("hide-conversation"));
  const column = document.getElementById("ah-editor-conversation");
  const input = screen.getByTestId("message-input");
  const inertAtFocus: boolean[] = [];
  // jsdom does not enforce inert on focus. Record the browser's focusability
  // boundary so moving focus before the expansion commit also fails here.
  vi.spyOn(input, "focus").mockImplementation(function (this: HTMLElement) {
    inertAtFocus.push(column?.hasAttribute("inert") ?? true);
    HTMLElement.prototype.focus.call(this);
  });
  expect(column?.parentElement?.classList.contains("ah-editor-collapsed")).toBe(
    true,
  );
  (frame as HTMLIFrameElement).focus();
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://editor.example.test",
        source: (frame as HTMLIFrameElement).contentWindow,
        data: { source: "open-habitat-editor", type: "toggle" },
      }),
    );
  });
  expect(column?.parentElement?.classList.contains("ah-editor-collapsed")).toBe(
    false,
  );
  expect(inertAtFocus).toEqual([false]);
  expect(document.activeElement).toBe(input);
});

it("keeps local close and size controls reachable while editor startup fails", async () => {
  const { mintEditorHandoff } = await import("./editor");
  vi.mocked(mintEditorHandoff).mockRejectedValueOnce(
    new Error("synthetic failure"),
  );
  render(
    <WorkspaceEditor workspaceId="ws_synthetic" csrf="synthetic-failure-csrf">
      <EditorHeaderControls />
      <textarea data-testid="message-input" defaultValue="Luonnos" />
    </WorkspaceEditor>,
  );
  fireEvent.click(await screen.findByTestId("toggle-editor"));
  await screen.findByRole("status");
  fireEvent.click(screen.getByTestId("hide-conversation"));
  expect(
    screen.getByTestId("hide-conversation").getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByTestId("close-editor"));
  expect(document.activeElement).toBe(screen.getByTestId("message-input"));
  expect(
    (screen.getByTestId("message-input") as HTMLTextAreaElement).value,
  ).toBe("Luonnos");
  fireEvent.click(screen.getByTestId("toggle-editor"));
  expect(
    screen.getByTestId("hide-conversation").getAttribute("aria-pressed"),
  ).toBe("false");
});
