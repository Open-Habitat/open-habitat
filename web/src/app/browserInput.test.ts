import { describe, expect, it } from "vitest";
import {
  agentMidStep,
  charCount,
  fitsClipboard,
  idleLeft,
  keystrokes,
  keysymOfChar,
  keysymOfKey,
  shortcutOf,
  typeLimit,
  usesCommand,
  XK,
} from "./browserInput";
import type { BrowserStatus } from "./serverBrowser";

const key = (
  k: string,
  code: string,
  mods: Partial<Record<"ctrlKey" | "metaKey" | "altKey", boolean>> = {},
) => ({ key: k, code, ctrlKey: false, metaKey: false, altKey: false, ...mods });

describe("keysyms", () => {
  it("are Latin-1 code points and Unicode keysyms beyond", () => {
    // X11 keysym values (keysymdef.h): an external contract.
    expect(keysymOfChar("a")).toBe(0x61);
    expect(keysymOfChar("ä")).toBe(0xe4);
    expect(keysymOfChar("€")).toBe(0x10020ac);
    expect(keysymOfChar("😀")).toBe(0x101f600);
    expect(keysymOfChar("\n")).toBe(0xff0d);
    expect(keysymOfChar("\u0007")).toBeUndefined();
    expect(keysymOfChar("ab")).toBeUndefined();
    expect(keysymOfKey("ArrowLeft")).toBe(0xff51);
    expect(keysymOfKey("Shift")).toBeUndefined();
  });

  it("type text with newlines as Enter, counting them, within the limit", () => {
    const r = keystrokes("pä\r\nss");
    expect(r).toEqual({
      ok: true,
      keysyms: [0x70, 0xe4, XK.Return, 0x73, 0x73],
      enters: 1,
    });
    expect(keystrokes("")).toEqual({ ok: false, why: "empty" });
    expect(keystrokes("x".repeat(typeLimit + 1))).toEqual({
      ok: false,
      why: "long",
    });
    expect(keystrokes("a\u0000b")).toEqual({ ok: false, why: "unsupported" });
  });

  it("count characters, not UTF-16 units, and bound the clipboard in bytes", () => {
    expect(charCount("😀ä")).toBe(2);
    expect(fitsClipboard("ä".repeat(32 * 1024))).toBe(true);
    expect(fitsClipboard("ä".repeat(32 * 1024 + 1))).toBe(false);
  });
});

describe("shortcuts", () => {
  it("map ⌘ on a Mac and Ctrl elsewhere", () => {
    expect(shortcutOf(key("v", "KeyV", { metaKey: true }), true)).toBe("paste");
    expect(
      shortcutOf(key("v", "KeyV", { ctrlKey: true }), true),
    ).toBeUndefined();
    expect(shortcutOf(key("v", "KeyV", { ctrlKey: true }), false)).toBe(
      "paste",
    );
    expect(
      shortcutOf(key("v", "KeyV", { metaKey: true }), false),
    ).toBeUndefined();
    expect(shortcutOf(key("x", "KeyX", { metaKey: true }), true)).toBe("copy");
    expect(shortcutOf(key("C", "KeyC", { ctrlKey: true }), false)).toBe("copy");
    expect(shortcutOf(key("a", "KeyA", { metaKey: true }), true)).toBe(
      "command",
    );
    expect(
      shortcutOf(key("a", "KeyA", { ctrlKey: true }), false),
    ).toBeUndefined();
    expect(shortcutOf(key("Meta", "MetaLeft", { metaKey: true }), true)).toBe(
      "meta",
    );
    expect(
      shortcutOf(key("v", "KeyV", { ctrlKey: true, altKey: true }), false),
    ).toBeUndefined();
  });

  it("find the letter on a non-Latin layout from the key's position", () => {
    expect(shortcutOf(key("м", "KeyV", { ctrlKey: true }), false)).toBe(
      "paste",
    );
  });

  it("recognise a Mac by platform or user agent", () => {
    expect(usesCommand({ platform: "MacIntel" })).toBe(true);
    expect(
      usesCommand({
        platform: "",
        userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0)",
      }),
    ).toBe(true);
    expect(usesCommand({ platform: "Linux x86_64", userAgent: "X11" })).toBe(
      false,
    );
  });
});

describe("the agent mid-step", () => {
  const base: BrowserStatus = {
    schema_version: 1,
    state: "running",
    survives_restart: true,
    control: "agent",
    agent_connected: false,
    windows: [],
  };
  const pointer = (age: number) => ({
    window: "W",
    x: 0,
    y: 0,
    age_ms: age,
    clicks: [{ x: 0, y: 0, age_ms: age }],
  });
  it("is an operation in progress or a fresh press", () => {
    expect(agentMidStep(base)).toBe(false);
    expect(agentMidStep({ ...base, agent_connected: true })).toBe(true);
    expect(agentMidStep({ ...base, pointer: pointer(500) })).toBe(true);
    expect(agentMidStep({ ...base, pointer: pointer(3000) })).toBe(false);
    expect(
      agentMidStep({ ...base, control: "person", agent_connected: true }),
    ).toBe(false);
    expect(agentMidStep(undefined)).toBe(false);
  });
});

describe("idle return", () => {
  it("counts down the last 30 seconds of three minutes, never while asked", () => {
    expect(idleLeft(149_000, false)).toBeUndefined();
    expect(idleLeft(150_000, false)).toBe(30);
    expect(idleLeft(179_100, false)).toBe(1);
    expect(idleLeft(180_000, false)).toBe(0);
    expect(idleLeft(400_000, false)).toBe(0);
    expect(idleLeft(400_000, true)).toBeUndefined();
  });
});
