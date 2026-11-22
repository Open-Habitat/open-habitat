import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentNavModel } from "../components/Navigation";
import {
  defaultSoundPreferences,
  type SoundPreferences,
} from "./accountPreferences";
import {
  deviceNight,
  plays,
  setDeviceMuted,
  silence,
  useAttentionSound,
  useDeviceNight,
} from "./attentionSound";

const row = (
  agentId: string,
  readyKey: string | undefined,
  extra: Partial<AgentNavModel> = {},
): AgentNavModel => ({
  agentId,
  href: `/agents/${agentId}`,
  title: agentId,
  activityLabel: "",
  controlLabel: "",
  workspaceId: "ws_example00",
  readyKey,
  ...extra,
});

describe("local-clock night", () => {
  const window = { night_start: 22, night_end: 7 };
  it.each([
    [21, 59, false],
    [22, 0, true],
    [23, 59, true],
    [0, 0, true],
    [6, 59, true],
    [7, 0, false],
    [14, 0, false],
  ])(
    "checks %i:%i with inclusive start and exclusive end",
    (hour, minute, quiet) => {
      expect(deviceNight(window, new Date(2026, 10, 22, hour, minute))).toBe(
        quiet,
      );
    },
  );
  it("supports a start after midnight", () => {
    const late = { night_start: 1, night_end: 4 };
    expect(deviceNight(late, new Date(2026, 10, 22, 23))).toBe(false);
    expect(deviceNight(late, new Date(2026, 10, 23, 1))).toBe(true);
    expect(deviceNight(late, new Date(2026, 10, 23, 4))).toBe(false);
  });
  it("uses wall-clock boundaries on the spring and autumn DST days", () => {
    for (const [month, day] of [
      [2, 29],
      [9, 25],
    ]) {
      expect(deviceNight(window, new Date(2026, month, day, 6, 59))).toBe(true);
      expect(deviceNight(window, new Date(2026, month, day, 7))).toBe(false);
      // The two occurrences of 03:30 on Helsinki's autumn clock change.
      if (month === 9) {
        const first = new Date(2026, month, day, 3, 30);
        expect(deviceNight(window, first)).toBe(true);
        expect(deviceNight(window, new Date(first.getTime() + 3_600_000))).toBe(
          true,
        );
      }
    }
  });
  it("updates a mounted view at the boundary and on return from sleep", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 10, 22, 21, 59, 59));
      const hook = renderHook(() => useDeviceNight(window));
      expect(hook.result.current).toBe(false);
      act(() => vi.advanceTimersByTime(1000));
      expect(hook.result.current).toBe(true);
      act(() => {
        vi.setSystemTime(new Date(2026, 10, 23, 7));
        globalThis.window.dispatchEvent(new Event("focus"));
      });
      expect(hook.result.current).toBe(false);
      hook.unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("silence", () => {
  const on = defaultSoundPreferences;
  it("names the strongest reason: off, then this device, then night, then the view", () => {
    const all = { muted: true, night: true, inView: true };
    expect(silence({ sound: { ...on, enabled: false }, ...all })).toBe("off");
    expect(silence({ sound: on, ...all })).toBe("muted");
    expect(silence({ sound: on, ...all, muted: false })).toBe("night");
    expect(
      silence({ sound: on, muted: false, night: false, inView: true }),
    ).toBe("in-view");
    expect(silence({ sound: on, muted: false, night: false })).toBeUndefined();
  });
  it("follows the person's choices for night and the conversation in view", () => {
    expect(
      silence({ sound: { ...on, night: false }, muted: false, night: true }),
    ).toBeUndefined();
    expect(
      silence({
        sound: { ...on, in_view: "play" },
        muted: false,
        night: false,
        inView: true,
      }),
    ).toBeUndefined();
  });
});

describe("useAttentionSound", () => {
  let now = 1_800_000_000_000;
  beforeEach(() => {
    plays.length = 0;
    window.localStorage.clear();
    setDeviceMuted(false);
    vi.spyOn(Date, "now").mockImplementation(() => now);
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  const mount = (
    sound: SoundPreferences = { ...defaultSoundPreferences, night: false },
  ) =>
    renderHook(
      ({ yours, stale = false }: { yours: AgentNavModel[]; stale?: boolean }) =>
        useAttentionSound({
          enabled: true,
          identity: "wid_example",
          yours,
          sound,
          loaded: true,
          stale,
        }),
      {
        initialProps: {
          yours: [row("a", "reply:r1")],
          stale: false,
        } as { yours: AgentNavModel[]; stale?: boolean },
      },
    );

  it("plays once for a new reply after the page settles, never for what was there", () => {
    const hook = mount();
    // Replies already waiting, and those the rail fills in while loading.
    hook.rerender({ yours: [row("a", "reply:r1"), row("b", "reply:r2")] });
    expect(plays).toHaveLength(0);
    now += 5000;
    hook.rerender({ yours: [row("a", "reply:r1"), row("b", "reply:r2")] });
    expect(plays).toHaveLength(0);
    hook.rerender({ yours: [row("a", "reply:r3"), row("b", "reply:r2")] });
    expect(plays).toHaveLength(1);
    expect(plays[0]).toMatchObject({ id: "kalimba", length: "short" });
    // The same observation again is not news.
    now += 5000;
    hook.rerender({ yours: [row("a", "reply:r3"), row("b", "reply:r2")] });
    expect(plays).toHaveLength(1);
  });

  it("plays one sound when several become ready together, the workspace's own", () => {
    const hook = mount({
      ...defaultSoundPreferences,
      length: "long",
      night: false,
      workspaces: { ws_example01: "pisara" },
    });
    now += 5000;
    hook.rerender({
      yours: [
        row("a", "reply:r1"),
        row("b", "question", { workspaceId: "ws_example01" }),
        row("c", "reply:r9"),
      ],
    });
    expect(plays).toEqual([
      expect.objectContaining({ id: "pisara", length: "long" }),
    ]);
  });

  it("stays quiet for the conversation in view, but not when Habitat is in the background", () => {
    const hook = mount();
    now += 5000;
    hook.rerender({ yours: [row("a", "reply:r2", { selected: true })] });
    expect(plays).toHaveLength(0);
    vi.mocked(document.hasFocus).mockReturnValue(false);
    now += 5000;
    hook.rerender({ yours: [row("a", "reply:r3", { selected: true })] });
    expect(plays).toHaveLength(1);
  });

  it("stays quiet on a muted device and when off, and a raise carries no key", () => {
    const off = mount({ ...defaultSoundPreferences, enabled: false });
    now += 5000;
    off.rerender({ yours: [row("a", "reply:r2")] });
    expect(plays).toHaveLength(0);
    off.unmount();
    setDeviceMuted(true);
    const muted = mount();
    now += 5000;
    muted.rerender({ yours: [row("a", "reply:r4"), row("r", undefined)] });
    expect(plays).toHaveLength(0);
  });

  it("checks the current clock for each reply and never replays a silenced reply at dawn", () => {
    const hour = vi.spyOn(Date.prototype, "getHours").mockReturnValue(23);
    const hook = mount(defaultSoundPreferences);
    now += 5000;
    hook.rerender({ yours: [row("a", "reply:r2")] });
    expect(plays).toHaveLength(0);
    hour.mockReturnValue(7);
    now += 5000;
    hook.rerender({ yours: [row("a", "reply:r2")] });
    expect(plays).toHaveLength(0);
    hook.rerender({ yours: [row("a", "reply:r3")] });
    expect(plays).toHaveLength(1);
  });

  it("takes a reconnect's rows as a new baseline, not as news", () => {
    const hook = mount();
    now += 5000;
    hook.rerender({ yours: [row("a", "reply:r1")], stale: true });
    // However long the connection was lost, the rows it brings back are
    // the baseline, and the settle window starts at the recovery.
    now += 60_000;
    hook.rerender({ yours: [row("a", "reply:r1")] });
    hook.rerender({ yours: [row("a", "reply:r5"), row("b", "reply:r6")] });
    expect(plays).toHaveLength(0);
    now += 5000;
    hook.rerender({ yours: [row("a", "reply:r8"), row("b", "reply:r6")] });
    expect(plays).toHaveLength(1);
  });

  it("another tab of this browser that just played claims the burst", () => {
    const hook = mount();
    now += 5000;
    window.localStorage.setItem("nah:attention-sound-last", String(now - 500));
    hook.rerender({ yours: [row("a", "reply:r7")] });
    expect(plays).toHaveLength(0);
  });
});
