import { act, fireEvent, render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditorOffer } from "../components/EditorOffer";
import { FileLinkContext, type FileLinks } from "../components/fileRefs";
import type { ConversationStore } from "./conversationStore";
import { recentEditorOffers, useRegisterEditorLinks } from "./EditorOffers";
import { Entry } from "./HistoryView";
import { ViewHost } from "./ViewHost";

const offer: EditorOffer = {
  offer_id: "44444444-4444-4444-8444-444444444444",
  workspace_id: "ws_example123",
  path: "cmd/<b>main</b>.go",
  line: 42,
  created_at: new Date().toISOString(),
};

function noticeEntry() {
  return (
    <Entry
      entry={{
        entry_key: "offer",
        kind: "unknown",
        content: { media_type: "text/plain", text: offer.path, complete: true },
        notice: {
          notice_id: offer.offer_id,
          origin: "agent",
          timestamp: offer.created_at,
          text: offer.path,
          persistence: "persisted",
          editor: { ...offer, conversation_id: "pi:1" },
        },
      }}
    />
  );
}

// Stands for the workspace editor: it registers what it can open.
function Editor({
  workspace,
  links,
}: {
  workspace?: string;
  links: FileLinks | null;
}) {
  useRegisterEditorLinks(workspace, links);
  return null;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("agent editor offers", () => {
  it("opens a conversation offer at its line through the editor's file links", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    const open = vi.fn();
    const page = render(
      <FileLinkContext.Provider value={{ open, workspace: offer.workspace_id }}>
        {noticeEntry()}
      </FileLinkContext.Provider>,
    );
    const card = page.getByTestId("editor-offer");
    // Agent text is data.
    expect(card.querySelectorAll("b,script,a")).toHaveLength(0);
    fireEvent.click(page.getByTestId("editor-offer-open"));
    expect(open).toHaveBeenCalledWith(
      { path: offer.path, line: 42 },
      expect.any(String),
    );
  });

  it("offers nothing to press where this page has no editor for the workspace", () => {
    for (const links of [
      null,
      { open: vi.fn(), workspace: "ws_otherworkspace" },
    ]) {
      const page = render(
        <FileLinkContext.Provider value={links}>
          {noticeEntry()}
        </FileLinkContext.Provider>,
      );
      expect(page.getByTestId("editor-offer").dataset.state).toBe(
        "unavailable",
      );
      expect(page.queryByTestId("editor-offer-open")).toBeNull();
      page.unmount();
    }
  });

  it("shows an account offer in the tray, opens it in its workspace's editor and leads elsewhere first", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    let offered: ((offer: EditorOffer) => void) | undefined;
    const store = {
      onViewOffered: () => () => {},
      onEditorOffered: (listener: (offer: EditorOffer) => void) => {
        offered = listener;
        return () => {};
      },
    } as unknown as ConversationStore;
    const open = vi.fn();
    let editorWorkspace = "ws_otherworkspace";
    const Page = () => (
      <ViewHost csrf="csrf" store={store}>
        <Editor workspace={editorWorkspace} links={{ open }} />
      </ViewHost>
    );
    const router = createMemoryRouter(
      [
        { path: "/", element: <Page /> },
        { path: "/workspaces/:id", element: <Page /> },
      ],
      { initialEntries: ["/"] },
    );
    const page = render(<RouterProvider router={router} />);
    await act(async () => {});
    // An offer tied to a conversation is not an account offer.
    act(() => offered?.({ ...offer, conversation_id: "pi:1" }));
    expect(page.queryByTestId("editor-offer")).toBeNull();

    act(() => offered?.(offer));
    expect(page.getByTestId("editor-offer").dataset.state).toBe("elsewhere");
    expect(page.queryByTestId("editor-offer-open")).toBeNull();
    await act(async () => {
      fireEvent.click(page.getByTestId("editor-offer-workspace"));
    });
    expect(router.state.location.pathname).toBe(
      `/workspaces/${offer.workspace_id}`,
    );
    expect(open).not.toHaveBeenCalled();

    editorWorkspace = offer.workspace_id;
    await act(async () => router.navigate("/"));
    expect(page.getByTestId("editor-offer").dataset.state).toBe("ready");
    fireEvent.click(page.getByTestId("editor-offer-open"));
    expect(open).toHaveBeenCalledWith(
      { path: offer.path, line: 42 },
      expect.any(String),
    );
    fireEvent.click(page.getByTestId("editor-offer-dismiss"));
    expect(page.queryByTestId("editor-offer")).toBeNull();
  });

  it("keeps recent account offers only", () => {
    const now = Date.parse("2026-10-25T12:00:00Z");
    const at = (hours: number) =>
      new Date(now - hours * 3600_000).toISOString();
    const kept = recentEditorOffers(
      [
        { ...offer, offer_id: "a", created_at: at(1) },
        { ...offer, offer_id: "b", created_at: at(25) },
        { ...offer, offer_id: "c", created_at: at(2), conversation_id: "pi:1" },
      ],
      now,
    );
    expect(kept.map((o) => o.offer_id)).toEqual(["a"]);
  });
});
