import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentNavModel } from "../components/Navigation";
import { defaultSoundPreferences } from "./accountPreferences";
import {
  activeDevicePlays,
  answerWaitMs,
  inputReportMs,
  startActiveDevice,
} from "./activeDevice";
import { plays, setDeviceMuted, useAttentionSound } from "./attentionSound";

type Sent = {
  tab: string;
  visible: boolean;
  idle_ms?: number;
  left?: true;
};

let answer: () => Promise<Response>;
let sent: Sent[];
const reply = (play: boolean) =>
  Promise.resolve(
    new Response(JSON.stringify({ schema_version: 1, play }), {
      headers: { "Content-Type": "application/json" },
    }),
  );
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
      "performance",
    ],
  });
  sent = [];
  answer = () => reply(true);
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return answer();
    }),
  );
});
let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("active device reports", () => {
  it("without the feature every tab plays and nothing is sent", async () => {
    expect(await activeDevicePlays()).toBe(true);
    expect(sent).toEqual([]);
  });

  it("a burst of typing is one report at once and one trailing, not one per key", async () => {
    stop = startActiveDevice("csrf");
    await settle();
    expect(sent).toHaveLength(1);
    expect(sent[0]).not.toHaveProperty("idle_ms");
    for (let i = 0; i < 30; i++) {
      window.dispatchEvent(new KeyboardEvent("keydown"));
      await vi.advanceTimersByTimeAsync(100);
    }
    // The first key went at once; the rest wait for the interval.
    expect(sent).toHaveLength(2);
    expect(sent[1].idle_ms).toBeLessThan(100);
    await vi.advanceTimersByTimeAsync(inputReportMs);
    expect(sent).toHaveLength(3);
    // The trailing report carries the last key, not the first.
    expect(sent[2].idle_ms).toBeLessThan(inputReportMs);
    expect(sent[2].idle_ms).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(inputReportMs * 2);
    expect(sent).toHaveLength(3);
    // After a pause the next input is heard at once again.
    window.dispatchEvent(new Event("pointerdown"));
    await settle();
    expect(sent).toHaveLength(4);
    expect(new Set(sent.map((s) => s.tab)).size).toBe(1);
  });

  it("a slow answer does not let typing pile up reports", async () => {
    stop = startActiveDevice("csrf");
    await settle();
    let release: () => void = () => undefined;
    answer = () =>
      new Promise<Response>((resolve) => {
        release = () => void reply(true).then(resolve);
      });
    for (let i = 0; i < 30; i++) {
      window.dispatchEvent(new KeyboardEvent("keydown"));
      await vi.advanceTimersByTimeAsync(100);
    }
    answer = () => reply(true);
    release();
    await settle();
    // The leading report, then nothing until the interval's trailing one.
    expect(sent).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(inputReportMs);
    await settle();
    expect(sent).toHaveLength(3);
  });

  it("asks at sound time and follows the answer", async () => {
    stop = startActiveDevice("csrf");
    await settle();
    answer = () => reply(false);
    expect(await activeDevicePlays()).toBe(false);
    answer = () => reply(true);
    expect(await activeDevicePlays()).toBe(true);
  });

  it("plays when the server cannot be reached or does not answer in time", async () => {
    stop = startActiveDevice("csrf");
    await settle();
    answer = () => Promise.reject(new TypeError("network"));
    expect(await activeDevicePlays()).toBe(true);
    answer = () => Promise.resolve(new Response("{}", { status: 503 }));
    expect(await activeDevicePlays()).toBe(true);
    answer = () => new Promise<Response>(() => undefined);
    const pending = activeDevicePlays();
    await vi.advanceTimersByTimeAsync(answerWaitMs);
    expect(await pending).toBe(true);
  });

  it("a closing tab says it leaves", async () => {
    stop = startActiveDevice("csrf");
    await settle();
    stop();
    stop = undefined;
    expect(sent.at(-1)).toMatchObject({ left: true });
    expect(await activeDevicePlays()).toBe(true);
  });
});

describe("useAttentionSound with the active device", () => {
  const row = (agentId: string, readyKey: string): AgentNavModel => ({
    agentId,
    href: `/agents/${agentId}`,
    title: agentId,
    activityLabel: "",
    controlLabel: "",
    workspaceId: "ws_example00",
    readyKey,
  });
  const sound = { ...defaultSoundPreferences, enabled: true, night: false };
  const mount = (activeDevice: boolean) => {
    plays.length = 0;
    window.localStorage.clear();
    setDeviceMuted(false);
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    return renderHook(
      ({ yours }: { yours: AgentNavModel[] }) =>
        useAttentionSound({
          identity: "wid_example",
          yours,
          loaded: true,
          stale: false,
          activeDevice,
          currentSound: async () => sound,
        }),
      { initialProps: { yours: [row("a", "reply:r1")] } },
    );
  };
  const due = async (hook: ReturnType<typeof mount>) => {
    hook.rerender({ yours: [row("a", "reply:r1")] });
    await vi.advanceTimersByTimeAsync(5000);
    hook.rerender({ yours: [row("a", "reply:r1"), row("b", "reply:r2")] });
    await settle();
  };

  it("stays quiet in a tab the person is not using", async () => {
    stop = startActiveDevice("csrf");
    await settle();
    answer = () => reply(false);
    await due(mount(true));
    expect(plays).toHaveLength(0);
  });

  it("plays in the tab in use", async () => {
    stop = startActiveDevice("csrf");
    await settle();
    answer = () => reply(true);
    await due(mount(true));
    expect(plays).toHaveLength(1);
  });

  it("does not ask, and plays, with the feature off", async () => {
    await due(mount(false));
    expect(plays).toHaveLength(1);
    expect(sent).toEqual([]);
  });

  it("does not ask when the sound is muted on this device", async () => {
    stop = startActiveDevice("csrf");
    await settle();
    const hook = mount(true);
    setDeviceMuted(true);
    const before = sent.length;
    await due(hook);
    expect(sent).toHaveLength(before);
    expect(plays).toHaveLength(0);
    setDeviceMuted(false);
  });
});
