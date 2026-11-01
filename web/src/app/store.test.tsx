import { describe, expect, it } from "vitest";
import type { Snapshot } from "./snapshot";
import {
  authenticated,
  authenticationRequired,
  clearIdentity,
  hostChanged,
  stale,
  store,
  unavailable,
} from "./store";

const alice = {
  identity: { web_identity_id: "alice" },
  workspaces: [],
} as unknown as Snapshot;
const bob = {
  identity: { web_identity_id: "bob" },
  workspaces: [],
} as unknown as Snapshot;

describe("connection authority", () => {
  it("retains only a verified snapshot on transient failure and replaces it on retry", () => {
    store.dispatch(clearIdentity());
    store.dispatch(stale());
    expect(store.getState().connection.snapshot).toBeUndefined();
    store.dispatch(authenticated(alice));
    store.dispatch(stale());
    expect(store.getState().connection).toMatchObject({
      phase: "stale",
      snapshot: alice,
    });
    store.dispatch(authenticated(alice));
    expect(store.getState().connection.phase).toBe("authenticated");
  });
  it("clears on authority loss and never carries Alice into Bob's session", () => {
    store.dispatch(authenticated(alice));
    store.dispatch(stale());
    store.dispatch(authenticationRequired());
    expect(store.getState().connection.snapshot).toBeUndefined();
    store.dispatch(authenticated(bob));
    expect(store.getState().connection.snapshot).toBe(bob);
    store.dispatch(unavailable());
    expect(store.getState().connection.snapshot).toBeUndefined();
  });
});

describe("host changes from replies and events (ADR 0023)", () => {
  const instance = "11111111-1111-4111-8111-111111111111";
  const restarted = "22222222-2222-4222-8222-222222222222";
  const snap = (
    cursor: string,
    visibility: "visible" | "hidden",
    who = "alice",
  ) =>
    ({
      identity: { web_identity_id: who },
      event_cursor: cursor,
      workspaces: [
        {
          workspace_id: "ws_aaaaaaaaaa",
          observation_token: "obs_aaaaaaaa",
          name: "a",
          display_name: "a",
          visibility,
        },
      ],
      agents: [],
    }) as unknown as Snapshot;
  const hide = (cursor: string) =>
    hostChanged({
      kind: "workspace",
      cursor,
      change: {
        workspace_id: "ws_aaaaaaaaaa",
        observation_token: "obs_aaaaaaaa",
        name: "a",
        display_name: "a",
        visibility: "hidden",
      },
    });
  const shown = () =>
    store.getState().connection.snapshot?.workspaces[0].visibility;
  it("re-applies a change over an older snapshot until one has passed it", () => {
    store.dispatch(clearIdentity());
    store.dispatch(authenticated(snap(`ev1:${instance}:5`, "visible")));
    store.dispatch(hide(`ev1:${instance}:7`));
    expect(shown()).toBe("hidden");
    // A read that started before the write arrives late.
    store.dispatch(authenticated(snap(`ev1:${instance}:6`, "visible")));
    expect(shown()).toBe("hidden");
    // A snapshot past the change is the truth, even when it disagrees.
    store.dispatch(authenticated(snap(`ev1:${instance}:8`, "visible")));
    expect(shown()).toBe("visible");
    expect(store.getState().connection.changes).toEqual([]);
  });
  it("keeps a confirmed conversation name over an older in-flight snapshot", () => {
    const before = {
      ...snap(`ev1:${instance}:5`, "visible"),
      agents: [
        {
          agent_id: "pi:example",
          title: { display: "Before", source: "native_session" },
        },
      ],
    } as Snapshot;
    store.dispatch(clearIdentity());
    store.dispatch(authenticated(before));
    store.dispatch(
      hostChanged({
        kind: "name",
        agent_id: "pi:example",
        name: "After",
        cursor: `ev1:${instance}:7`,
      }),
    );
    store.dispatch(
      authenticated({
        ...structuredClone(before),
        event_cursor: `ev1:${instance}:6`,
      }),
    );
    expect(store.getState().connection.snapshot?.agents[0].title.display).toBe(
      "After",
    );
    store.dispatch(
      authenticated({
        ...structuredClone(before),
        event_cursor: `ev1:${instance}:8`,
      }),
    );
    expect(store.getState().connection.snapshot?.agents[0].title.display).toBe(
      "Before",
    );
  });
  it("drops changes from a previous daemon instance and a previous person", () => {
    store.dispatch(clearIdentity());
    store.dispatch(authenticated(snap(`ev1:${instance}:5`, "visible")));
    store.dispatch(hide(`ev1:${instance}:7`));
    store.dispatch(authenticated(snap(`ev1:${restarted}:1`, "visible")));
    expect(shown()).toBe("visible");
    expect(store.getState().connection.changes).toEqual([]);
    store.dispatch(hide(`ev1:${restarted}:3`));
    store.dispatch(authenticated(snap(`ev1:${restarted}:2`, "visible", "bob")));
    expect(shown()).toBe("visible");
  });
});
