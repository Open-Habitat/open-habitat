// The attention sound (attention-sound, experimental): one short sound when a
// conversation becomes the person's turn. The personal choices come from the
// account preferences and follow the person; mute and volume are this
// device's own, kept in its browser like the theme, because muting a phone
// must not silence the computer beside it. Night is the device's own dark
// mode, the same signal the System theme follows.
//
// Nothing here reaches the host: the decision is made from the rail state
// the browser already has, and the sounds are rendered from their recipes
// (soundSynth.ts) on first play.
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { AgentNavModel } from "../components/Navigation";
import type { SoundPreferences } from "./accountPreferences";
import {
  type RenderedSound,
  renderSound,
  SAMPLE_RATE,
  type SoundId,
  type SoundLength,
  type Strike,
  soundDuration,
  soundStrikes,
  volumeGain,
} from "./soundSynth";

// ---- This device: mute and volume ----

export type DeviceSound = { muted: boolean; volume: number };
const deviceKey = "nah:attention-sound-device";
const deviceEvents = new EventTarget();
let device: DeviceSound = readDevice();

function readDevice(): DeviceSound {
  try {
    const value = JSON.parse(window.localStorage.getItem(deviceKey) ?? "{}");
    const volume = Number(value?.volume);
    return {
      muted: value?.muted === true,
      volume:
        Number.isFinite(volume) && volume >= 0 && volume <= 100
          ? Math.round(volume)
          : 70,
    };
  } catch {
    return { muted: false, volume: 70 };
  }
}
function setDevice(next: DeviceSound) {
  device = next;
  try {
    window.localStorage.setItem(deviceKey, JSON.stringify(next));
  } catch {
    // The choice still holds for this page when storage is denied.
  }
  deviceEvents.dispatchEvent(new Event("change"));
}
// Another tab of this browser is the same device.
window.addEventListener("storage", (event) => {
  if (event.key !== deviceKey) return;
  device = readDevice();
  deviceEvents.dispatchEvent(new Event("change"));
});
export function setDeviceMuted(muted: boolean) {
  setDevice({ ...device, muted });
}
export function setDeviceVolume(volume: number) {
  setDevice({ ...device, volume: Math.max(0, Math.min(100, volume)) });
}
const subscribeDevice = (callback: () => void) => {
  deviceEvents.addEventListener("change", callback);
  return () => deviceEvents.removeEventListener("change", callback);
};
export function useDeviceSound(): DeviceSound {
  return useSyncExternalStore(subscribeDevice, () => device);
}

// ---- Night: the device's dark mode ----

const darkQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
const subscribeNight = (callback: () => void) => {
  darkQuery?.addEventListener("change", callback);
  return () => darkQuery?.removeEventListener("change", callback);
};
/** Whether the device is in night mode now. Habitat's own Yö theme is a
 * look, not a time of day, so it does not count. */
export const deviceNight = () => !!darkQuery?.matches;
export function useDeviceNight(): boolean {
  return useSyncExternalStore(subscribeNight, deviceNight);
}

// ---- Why the sound stays quiet ----

export type Silence = "off" | "muted" | "night" | "in-view";

/** The strongest reason the sound stays quiet now, or undefined when it
 * plays. Off (everywhere) wins over this device's mute, which wins over
 * night; the conversation in view is asked about last. */
export function silence({
  sound,
  muted,
  night,
  inView = false,
}: {
  sound: Pick<SoundPreferences, "enabled" | "night" | "in_view">;
  muted: boolean;
  night: boolean;
  inView?: boolean;
}): Silence | undefined {
  if (!sound.enabled) return "off";
  if (muted) return "muted";
  if (sound.night && night) return "night";
  if (inView && sound.in_view === "quiet") return "in-view";
  return undefined;
}

/** The sound a workspace plays: its own, else the person's default. */
export function workspaceSound(
  sound: Pick<SoundPreferences, "default" | "workspaces">,
  workspaceId: string,
): SoundId {
  return sound.workspaces[workspaceId] ?? sound.default;
}

// ---- Playback ----

let audio: AudioContext | undefined;
const rendered = new Map<string, RenderedSound>();

/** The browser plays sound only after a press on the page: the first one
 * prepares the audio, so a later sound from the rail can play. */
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    // No audio output: the sounds stay silent and nothing else changes.
  }
}

export type Playing = {
  id: SoundId;
  length: SoundLength;
  /** Where it was started, so only that emblem ripples. */
  where: string;
  n: number;
};
let playing: Playing | undefined;
let playCount = 0;
let playTimer: ReturnType<typeof setTimeout> | undefined;
const playEvents = new EventTarget();
const subscribePlaying = (callback: () => void) => {
  playEvents.addEventListener("change", callback);
  return () => playEvents.removeEventListener("change", callback);
};

/** Plays a sound at this device's volume. A press plays even when the
 * sound is off, muted or quiet at night: listening is what the press asks
 * for. Returns false when the browser has no audio for the page yet. */
export function playSound(
  id: SoundId,
  length: SoundLength,
  where = "",
  volume = device.volume,
) {
  let played = false;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const k = `${id}/${length}`;
    let sound = rendered.get(k);
    if (!sound) {
      sound = renderSound(id, length);
      rendered.set(k, sound);
    }
    const buffer = audio.createBuffer(2, sound.left.length, SAMPLE_RATE);
    buffer.copyToChannel(sound.left as Float32Array<ArrayBuffer>, 0);
    buffer.copyToChannel(sound.right as Float32Array<ArrayBuffer>, 1);
    const source = audio.createBufferSource();
    const gain = audio.createGain();
    source.buffer = buffer;
    gain.gain.value = volumeGain(volume);
    source.connect(gain).connect(audio.destination);
    source.start();
    played = audio.state === "running";
  } catch {
    // No audio output: the emblem still shows the strikes.
  }
  plays.push({ id, length, where, volume, at: Date.now() });
  playing = { id, length, where, n: ++playCount };
  clearTimeout(playTimer);
  playTimer = setTimeout(
    () => {
      playing = undefined;
      playEvents.dispatchEvent(new Event("change"));
    },
    soundDuration(id, length) * 1000 + 450,
  );
  playEvents.dispatchEvent(new Event("change"));
  return played;
}

/** The sounds this page started, newest last: the browser tests read it,
 * because headless Chromium has no ears. */
export const plays: {
  id: SoundId;
  length: SoundLength;
  where: string;
  volume: number;
  at: number;
}[] = [];
declare global {
  interface Window {
    __ohSoundPlays?: typeof plays;
  }
}
window.__ohSoundPlays = plays;

const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");

/** The strikes to ripple while `id` plays at `where`; null at rest or with
 * reduced motion. `key` restarts the ripples on every play. */
export function usePlaying(
  id: SoundId,
  where: string,
): { key: number; strikes: Strike[] } | null {
  const now = useSyncExternalStore(subscribePlaying, () => playing);
  if (!now || now.id !== id || now.where !== where || reducedMotion?.matches)
    return null;
  return { key: now.n, strikes: soundStrikes(id, now.length) };
}

/** Whether anything is playing at `where` now (the tile's Soi). */
export function usePlayingAt(where: string): SoundId | undefined {
  const now = useSyncExternalStore(subscribePlaying, () => playing);
  return now?.where === where ? now.id : undefined;
}

// ---- When a conversation becomes the person's turn ----

/** Each row of Sinun vuorosi that the agent made ready: a new reply or a
 * question, by its key. A new conversation the person opened, a raise
 * and a read reply carry none. */
export function readyRows(yours: readonly AgentNavModel[]) {
  const rows = new Map<string, AgentNavModel>();
  for (const row of yours)
    if (row.readyKey) rows.set(`${row.agentId}:${row.readyKey}`, row);
  return rows;
}

/** A row became ready since the last observation: its key is new. */
export function newlyReady(
  before: ReadonlySet<string>,
  now: ReadonlyMap<string, AgentNavModel>,
) {
  return [...now].filter(([k]) => !before.has(k)).map(([, row]) => row);
}

// One sound when several become ready together, in this tab and across
// this browser's tabs, which are one device.
const burstMs = 2000;
const lastKey = "nah:attention-sound-last";
function claimBurst(now: number) {
  try {
    const last = Number(window.localStorage.getItem(lastKey));
    if (Number.isFinite(last) && now - last >= 0 && now - last < burstMs)
      return false;
    window.localStorage.setItem(lastKey, String(now));
  } catch {
    // Without storage each tab decides alone.
  }
  return true;
}

/** While the page settles after loading or reconnecting, the rail fills in
 * with replies that are not news; they set the baseline instead. */
const settleMs = 4000;

/**
 * Plays one sound when a conversation becomes the person's turn: an agent
 * replied or asks. No sound for the conversation in view (unless the person
 * chose otherwise), when the sound is off, this device is muted or it is
 * night; the first rows after loading are the baseline, not news.
 */
export function useAttentionSound({
  enabled,
  identity,
  yours,
  sound,
  loaded,
  stale,
}: {
  /** The experimental feature is on. */
  enabled: boolean;
  identity?: string;
  yours: readonly AgentNavModel[];
  sound: SoundPreferences;
  /** The preferences have been read, so `sound` is the person's. */
  loaded: boolean;
  /** The connection is lost: the rail is the last observation. */
  stale: boolean;
}) {
  const seen = useRef<Set<string>>(new Set());
  const settleUntil = useRef(0);
  const owner = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, [enabled]);
  const now = readyRows(yours);
  useEffect(() => {
    const at = Date.now();
    if (owner.current !== identity || !enabled || !loaded || stale) {
      owner.current = identity;
      seen.current = new Set(now.keys());
      settleUntil.current = at + settleMs;
      return;
    }
    const fresh = newlyReady(seen.current, now);
    seen.current = new Set(now.keys());
    if (!fresh.length || at < settleUntil.current) return;
    const viewing =
      document.visibilityState === "visible" && document.hasFocus();
    const heard = fresh.find(
      (row) =>
        !silence({
          sound,
          muted: device.muted,
          night: deviceNight(),
          inView: viewing && !!row.selected,
        }),
    );
    if (!heard || !claimBurst(at)) return;
    playSound(
      heard.workspaceId
        ? workspaceSound(sound, heard.workspaceId)
        : sound.default,
      sound.length,
    );
  });
}
