import { describe, expect, it } from "vitest";
import type { Snapshot } from "./snapshot";
import {
  authenticated,
  authenticationRequired,
  clearIdentity,
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
