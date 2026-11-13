import { Terminal } from "@xterm/xterm";
import { afterEach, expect, test, vi } from "vitest";
import {
  isReport,
  type MouseMode,
  TerminalModes,
  wheelLines,
  wheelReport,
} from "./terminalModes";
import { offerableUrl, readTitle } from "./terminalTitle";

afterEach(() => {
  vi.useRealTimers();
});

// tmux 3.4's full redraw, as recorded from a real attach and resize.
const redraw =
  "\x1b[?1006l\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006h\x1b[?1000h\x1b[?1002h";

function harness() {
  let applied: MouseMode = "none";
  let cursor = true;
  const writes: string[] = [];
  const modes = new TerminalModes(
    () => applied,
    (s) => writes.push(s),
  );
  const feed = (data: string) => {
    for (const m of data.matchAll(
      new RegExp(`${"\x1b"}\\[\\?([0-9;]+)([hl])`, "g"),
    )) {
      const params = m[1].split(";").map(Number);
      if (!modes.handle(m[2] === "h", params)) {
        // What xterm.js would do with a sequence it is given.
        for (const p of params) {
          if (p === 25) cursor = m[2] === "h";
          if ([9, 1000, 1002, 1003].includes(p))
            applied =
              m[2] === "l"
                ? "none"
                : ({ 9: "x10", 1000: "vt200", 1002: "drag", 1003: "any" }[
                    p
                  ] as MouseMode);
        }
      }
    }
  };
  return { modes, writes, feed, applied: () => applied, cursor: () => cursor };
}

test("a redraw that turns the mouse off and on again changes nothing in xterm", () => {
  vi.useFakeTimers();
  const h = harness();
  h.feed(redraw);
  vi.runAllTimers();
  expect(h.writes).toEqual(["\x1b[?1002h"]);
  h.feed(h.writes[0]);
  expect(h.applied()).toBe("drag");
  expect(h.modes.sgr).toBe(true);
  for (let i = 0; i < 3; i++) {
    h.feed(redraw);
    vi.runAllTimers();
  }
  expect(h.writes).toHaveLength(1);
  // Detaching turns it off for good.
  h.feed("\x1b[?1006l\x1b[?1000l\x1b[?1002l\x1b[?1003l");
  vi.runAllTimers();
  expect(h.writes[1]).toBe("\x1b[?1000l");
  h.feed(h.writes[1]);
  expect(h.applied()).toBe("none");
});

test("the cursor stays hidden in tmux's history and comes back as the program left it", () => {
  const h = harness();
  // The terminal parses what the filter writes, as xterm.js would.
  const flush = () => {
    for (const w of h.writes.splice(0)) h.feed(w);
  };
  h.modes.hideCursor(true);
  expect(h.writes).toEqual(["\x1b[?25l"]);
  flush();
  expect(h.cursor()).toBe(false);
  // tmux shows its copy-mode cursor with every redraw: swallowed.
  h.feed("\x1b[?25l\x1b[?25h");
  expect(h.cursor()).toBe(false);
  h.modes.hideCursor(false);
  expect(h.writes).toEqual(["\x1b[?25h"]);
  flush();
  expect(h.cursor()).toBe(true);
  h.feed("\x1b[?25l");
  h.modes.hideCursor(true);
  flush();
  h.modes.hideCursor(false);
  // The program had hidden it: it stays hidden.
  expect(h.writes).toEqual([]);
  expect(h.cursor()).toBe(false);
});

test("the filter keeps a real xterm's mode without a protocol change on redraw", async () => {
  const term = new Terminal({ allowProposedApi: true });
  const modes = new TerminalModes(
    () => term.modes.mouseTrackingMode,
    (s) => term.write(s),
    0,
  );
  term.parser.registerCsiHandler({ prefix: "?", final: "h" }, (p) =>
    modes.handle(true, p),
  );
  term.parser.registerCsiHandler({ prefix: "?", final: "l" }, (p) =>
    modes.handle(false, p),
  );
  const seen: string[] = [];
  const watch = setInterval(() => seen.push(term.modes.mouseTrackingMode), 0);
  const write = (s: string) =>
    new Promise<void>((resolve) => term.write(s, resolve));
  await write(redraw);
  await new Promise((r) => setTimeout(r, 20));
  await write("");
  expect(term.modes.mouseTrackingMode).toBe("drag");
  seen.length = 0;
  await write(redraw);
  await new Promise((r) => setTimeout(r, 20));
  await write("");
  clearInterval(watch);
  expect(seen.every((m) => m === "drag")).toBe(true);
  modes.dispose();
  term.dispose();
});

test("wheel pixels become whole lines, carrying the rest", () => {
  let carried = 0;
  let total = 0;
  for (let i = 0; i < 10; i++) {
    const step = wheelLines({ deltaY: -7, deltaMode: 0 }, 16, 24, carried);
    carried = step.carried;
    total += step.lines;
  }
  expect(total).toBe(-4);
  expect(wheelLines({ deltaY: 3, deltaMode: 1 }, 16, 24, 0).lines).toBe(3);
  expect(wheelLines({ deltaY: 1, deltaMode: 2 }, 16, 24, 0).lines).toBe(24);
  expect(wheelLines({ deltaY: 100000, deltaMode: 0 }, 16, 24, 0).lines).toBe(
    72,
  );
  expect(wheelReport(true, 3, 7)).toBe("\x1b[<64;3;7M");
  expect(wheelReport(false, 1, 1)).toBe("\x1b[<65;1;1M");
});

test("mouse and focus reports are not typing", () => {
  expect(isReport("\x1b[<64;3;7M")).toBe(true);
  expect(isReport("\x1b[I")).toBe(true);
  expect(isReport("a")).toBe(false);
  expect(isReport("\x1b[A")).toBe(false);
});

test("the title channel and the addresses it may offer", () => {
  expect(readTitle("oh;0;")).toEqual({ mode: false, offer: undefined });
  expect(readTitle("oh;1;17 https://example.test/a?b=1#c")).toEqual({
    mode: true,
    offer: { nonce: "17", url: "https://example.test/a?b=1#c" },
  });
  expect(readTitle("bash")).toBeUndefined();
  expect(readTitle("oh;0;17 https://example.test/a b")).toBeUndefined();
  expect(readTitle("oh;0;17 https://e.test/\x1b]52;;x")).toBeUndefined();
  expect(offerableUrl("https://github.com/login/device")?.host).toBe(
    "github.com",
  );
  expect(offerableUrl("http://localhost:8080/cb")?.port).toBe("8080");
  for (const bad of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "data:text/html,x",
    "https://github.com@evil.test/",
    "https://user:pw@example.test/",
    "not a url",
  ])
    expect(offerableUrl(bad)).toBeUndefined();
});
