import { act, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ConversationJournal } from "./conversationJournal";
import { ConversationPager } from "./conversationPager";
import { ConversationStore } from "./conversationStore";
import type { Snapshot } from "./snapshot";
import { authenticated, clearIdentity, store } from "./store";

const snapshot = (person: string): Snapshot => ({
  schema_version: 1,
  event_cursor: "",
  server_instance_id: "instance",
  identity: { web_identity_id: person, display_name: person },
  sources: [{ source: "filesystem", state: "confirmed", observed_at: "now" }],
  workspaces: [],
  agents: [],
  write_state: "writable",
});
afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  store.dispatch(clearIdentity());
});
describe("App", () => {
  it("disposes the old stream and pages before a different identity paints, without erasing the new person's markers", () => {
    store.dispatch(authenticated(snapshot("alice")));
    const stop = vi.spyOn(ConversationJournal.prototype, "stop");
    const dispose = vi.spyOn(ConversationStore.prototype, "dispose");
    const cancel = vi.spyOn(ConversationPager.prototype, "cancelAll");
    vi.spyOn(ConversationJournal.prototype, "start").mockImplementation(
      () => {},
    );
    sessionStorage.setItem("nah:alice:draft:one", "private");
    sessionStorage.setItem("nah:alice:last-send:one", "pending");
    sessionStorage.setItem("nah:bob:draft:two", "his");
    const { unmount } = render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/workspaces"]}>
          <App />
        </MemoryRouter>
      </Provider>,
    );
    act(() => store.dispatch(authenticated(snapshot("bob"))));
    expect(stop).toHaveBeenCalled();
    expect(dispose).toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
    expect(sessionStorage.getItem("nah:alice:draft:one")).toBeNull();
    expect(sessionStorage.getItem("nah:alice:last-send:one")).toBeNull();
    expect(sessionStorage.getItem("nah:bob:draft:two")).toBe("his");
    unmount();
  });
  it("rejects a late page from the disposed person's store", async () => {
    store.dispatch(authenticated(snapshot("alice")));
    vi.spyOn(ConversationJournal.prototype, "start").mockImplementation(
      () => {},
    );
    let resolve!: (value: never) => void;
    vi.spyOn(ConversationPager.prototype, "tail").mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const applied = vi.spyOn(ConversationStore.prototype, "applySnapshot");
    const { unmount } = render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/workspaces"]}>
          <App />
        </MemoryRouter>
      </Provider>,
    );
    const id = "pi:00000000-1111-4111-8111-111111111111";
    // Drive a page read through the same store App owns.
    // A delayed network reply must not reinsert it after identity replacement.
    const oldStore = applied.mock.instances[0] as ConversationStore;
    expect(oldStore).toBeDefined();
    oldStore.view(id);
    act(() => store.dispatch(authenticated(snapshot("bob"))));
    resolve({
      agent_id: id,
      entries: [],
      older_complete: true,
      boundary_found: true,
    } as never);
    await act(async () => {
      await Promise.resolve();
    });
    expect(oldStore?.read(id)).toBeUndefined();
    expect(() => oldStore?.view(id)).toThrow("disposed store");
    unmount();
  });
  it("starts behind an honest loading boundary", () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByRole("heading", { name: "Ladataan" })).toBeTruthy();
  });
});
