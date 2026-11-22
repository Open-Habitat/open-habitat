import { beforeEach, describe, expect, it } from "vitest";
import {
  browserRowStates,
  noteBrowserUse,
  noteBrowserWindows,
  ownerOfWindow,
  resetBrowserConversations,
  settleBrowserUse,
} from "./browserConversations";
import type { BrowserStatus } from "./serverBrowser";

const W1 = "0A1B2C3D4E5F60718293A4B5C6D7E8F9";
const W2 = "F9E8D7C6B5A4938271605F4E3D2C1B0A";
const status = (over: Partial<BrowserStatus> = {}): BrowserStatus => ({
  schema_version: 1,
  state: "running",
  survives_restart: true,
  control: "agent",
  agent_connected: false,
  windows: [
    {
      id: W1,
      title: "Omat laskut",
      origin: "https://energia.example",
      agent: true,
    },
    {
      id: W2,
      title: "Vahvista",
      origin: "https://tunnistus.example",
      agent: false,
    },
  ],
  ...over,
});

describe("which conversation the browser works for", () => {
  beforeEach(() => resetBrowserConversations());

  it("marks the conversation whose own command named the asking window, and no other", () => {
    noteBrowserWindows("pi:a", [W2]);
    const asking = status({ request: { window: W2, text: "x", age_ms: 0 } });
    expect([...browserRowStates(asking, new Set())]).toEqual([["pi:a", "ask"]]);
    expect([
      ...browserRowStates({ ...asking, control: "person" }, new Set()),
    ]).toEqual([["pi:a", "control"]]);
    // A request in a window no conversation named stays the rail's alone.
    expect(
      browserRowStates(
        status({ request: { window: W1, text: "x", age_ms: 0 } }),
        new Set(),
      ).size,
    ).toBe(0);
  });

  it("follows the window to the conversation whose command named it last", () => {
    noteBrowserWindows("pi:a", [W1]);
    noteBrowserWindows("pi:b", [W1]);
    expect(ownerOfWindow(W1)).toBe("pi:b");
  });

  it("marks a running conversation that used the browser as working until it stops", () => {
    noteBrowserUse("pi:a");
    const running = new Set(["pi:a"]);
    expect(browserRowStates(status(), running).get("pi:a")).toBe("working");
    settleBrowserUse(new Set());
    expect(browserRowStates(status(), running).size).toBe(0);
    // A stopped browser marks nothing.
    noteBrowserUse("pi:a");
    expect(browserRowStates(status({ state: "stopped" }), running).size).toBe(
      0,
    );
  });
});
