import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentNavModel } from "../components/Navigation";
import {
  defaultSoundPreferences,
  type SoundPreferences,
} from "./accountPreferences";
import {
  plays,
  setDeviceMuted,
  silence,
  useAttentionSound,
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

  const mount = (sound: SoundPreferences = defaultSoundPreferences) =>
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

  it("takes a reconnect's rows as a new baseline, not as news", () => {
    const hook = mount();
    now += 5000;
    hook.rerender({ yours: [row("a", "reply:r1")], stale: true });
    hook.rerender({ yours: [row("a", "reply:r5"), row("b", "reply:r6")] });
    expect(plays).toHaveLength(0);
  });

  it("another tab of this browser that just played claims the burst", () => {
    const hook = mount();
    now += 5000;
    window.localStorage.setItem("nah:attention-sound-last", String(now - 500));
    hook.rerender({ yours: [row("a", "reply:r7")] });
    expect(plays).toHaveLength(0);
  });
});
