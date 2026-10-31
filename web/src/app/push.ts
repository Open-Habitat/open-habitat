import Ajv from "ajv/dist/2020.js";
import { useEffect } from "react";
import schema from "../../../contracts/v1/push-notifications.schema.json";
import { currentLanguage } from "../i18n";
import { jsonWrite, mutationFetch, writeOutcome } from "./mutations";

// Phone notifications (experimental push-when-your-turn). The person's
// daemon holds the key pair and the devices and sends; this module only
// subscribes this browser, lists and removes devices, and tells the daemon
// when the person is in front of a tab so it does not buzz the phone then.

export type PushOutcome = "delivered" | "gone" | "rejected" | "unreachable";
export type PushDevice = {
  device_id: string;
  label: string;
  language: "fi" | "en";
  created_at: string;
  last_delivery: { outcome: PushOutcome; at: string } | null;
};
export type PushState = {
  schema_version: 1;
  public_key: string | null;
  devices: PushDevice[];
  device_id?: string;
};
type TestResult = {
  schema_version: 1;
  device_id: string;
  outcome: PushOutcome;
};

const ajv = new Ajv({ strict: false, validateFormats: false });
ajv.addSchema(schema);
const validState = ajv.compile<PushState>({
  $ref: `${schema.$id}#/$defs/state`,
});
const validTest = ajv.compile<TestResult>({
  $ref: `${schema.$id}#/$defs/test_result`,
});

const base = "/api/v1/notifications/push";
const workerPath = "/push-sw.js";

/** Why a step did not complete: a code the card words. */
export class PushProblem extends Error {
  constructor(readonly code: string) {
    super("push problem");
  }
}

/** Whether this browser can take Web Push at all. */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** An iPhone or iPad, where Web Push reaches only a site added to the home
 * screen and opened from there. */
export function appleMobile(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

export function homeScreenApp(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** A short name for this device in the list: platform and browser names,
 * which are the same in every language. */
export function deviceLabel(ua = navigator.userAgent): string {
  const platform = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\/|CriOS\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "";
  return [platform, browser].filter(Boolean).join(" · ") || "Browser";
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of array) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): Uint8Array<ArrayBuffer> {
  const s = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** The daemon's name for a device: the same hash of its endpoint. */
export async function deviceIdOf(endpoint: string): Promise<string> {
  const sum = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(endpoint),
  );
  return `pd_${b64url(new Uint8Array(sum).slice(0, 16))}`;
}

async function readJSON<T>(
  response: Response,
  valid: (value: unknown) => value is T,
): Promise<T> {
  if (
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new PushProblem("unavailable");
  const text = await response.text();
  if (text.length > 16384) throw new PushProblem("unavailable");
  const value: unknown = JSON.parse(text);
  if (!valid(value)) throw new PushProblem("unavailable");
  return value;
}

async function write<T>(
  path: string,
  body: unknown,
  csrf: string,
  valid: (value: unknown) => value is T,
): Promise<T> {
  let response: Response | undefined;
  try {
    response =
      body === undefined
        ? await mutationFetch("account.push", path, {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
              "X-Agent-Host-CSRF": csrf,
              Origin: window.location.origin,
            },
          })
        : await jsonWrite("account.push", path, body, csrf);
  } catch {
    response = undefined;
  }
  const outcome = await writeOutcome(response);
  if (outcome.kind === "ok") return readJSON(outcome.response, valid);
  if (outcome.kind === "refused") throw new PushProblem(outcome.code);
  throw new PushProblem(outcome.kind === "login" ? "login" : "uncertain");
}

export async function readPushState(): Promise<PushState> {
  const response = await fetch(base, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new PushProblem("unavailable");
  return readJSON(response, validState);
}

async function workerRegistration(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register(workerPath, {
    scope: "/",
  });
  await navigator.serviceWorker.ready;
  return registration;
}

/** This browser's own subscription, without registering anything. */
async function existingSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration =
    await navigator.serviceWorker.getRegistration(workerPath);
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** This browser's device id, if it has a subscription. */
export async function thisDeviceId(): Promise<string | undefined> {
  try {
    const sub = await existingSubscription();
    return sub ? await deviceIdOf(sub.endpoint) : undefined;
  } catch {
    return undefined;
  }
}

function sameKey(sub: PushSubscription, publicKey: string): boolean {
  const key = sub.options.applicationServerKey;
  return !!key && b64url(key) === publicKey;
}

async function record(
  sub: PushSubscription,
  publicKey: string,
  csrf: string,
  refresh: boolean,
): Promise<PushState> {
  const json = sub.toJSON();
  return write(
    `${base}/devices`,
    {
      endpoint: sub.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      public_key: publicKey,
      label: deviceLabel(),
      language: currentLanguage(),
      refresh,
    },
    csrf,
    validState,
  );
}

/** Subscribes this browser and records it with the person's daemon.
 * Permission must already be granted (asked on the person's press). Also
 * the repair path: a subscription the browser dropped silently is made
 * again. */
export async function subscribeThisDevice(csrf: string): Promise<PushState> {
  if (!pushSupported()) throw new PushProblem("unsupported");
  if (Notification.permission !== "granted")
    throw new PushProblem("permission");
  const keyed = await write(`${base}/key`, undefined, csrf, validState);
  const publicKey = keyed.public_key;
  if (!publicKey) throw new PushProblem("unavailable");
  const registration = await workerRegistration();
  let sub = await registration.pushManager.getSubscription();
  if (sub && !sameKey(sub, publicKey)) {
    await sub.unsubscribe();
    sub = null;
  }
  try {
    sub ??= await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: fromB64url(publicKey),
    });
  } catch {
    throw new PushProblem("subscribe");
  }
  return record(sub, publicKey, csrf, false);
}

export async function removeDevice(
  csrf: string,
  deviceId: string,
): Promise<PushState> {
  const state = await write(
    `${base}/remove`,
    { device_id: deviceId },
    csrf,
    validState,
  );
  const sub = await existingSubscription().catch(() => null);
  if (sub && (await deviceIdOf(sub.endpoint)) === deviceId)
    await sub.unsubscribe().catch(() => undefined);
  return state;
}

export async function testDevice(
  csrf: string,
  deviceId: string,
): Promise<PushOutcome> {
  const result = await write(
    `${base}/test`,
    { device_id: deviceId },
    csrf,
    validTest,
  );
  return result.outcome;
}

/** Ends this browser's own subscription, when the feature is off. */
export async function dropThisDevice(): Promise<void> {
  const sub = await existingSubscription().catch(() => null);
  await sub?.unsubscribe().catch(() => undefined);
}

/** On load, refreshes this device's record (its language, a subscription
 * the browser rotated). A device removed elsewhere, or made with an older
 * key, is unsubscribed here rather than brought back. */
async function refreshThisDevice(csrf: string): Promise<void> {
  if (Notification.permission !== "granted") return;
  const sub = await existingSubscription();
  if (!sub) return;
  const key = sub.options.applicationServerKey;
  if (!key) return;
  try {
    await record(sub, b64url(key), csrf, true);
  } catch (e) {
    if (
      e instanceof PushProblem &&
      ["push_device_unknown", "push_key_changed", "push_feature_off"].includes(
        e.code,
      )
    )
      await sub.unsubscribe().catch(() => undefined);
  }
}

const reportGapMs = 20_000;
const inputWindowMs = 120_000;

/**
 * While phone notifications are on: tells the person's daemon that they are
 * in front of this tab (visible, and used in the last two minutes; a tab
 * merely left open on a desk is not presence), closes this device's
 * notification of the conversation being looked at, routes a tapped
 * notification inside this window, and refreshes this device's record.
 */
export function usePushNotifications({
  on,
  known,
  csrf,
  viewing,
  open,
}: {
  on: boolean;
  /** The daemon has confirmed the preferences: only then is off off. */
  known: boolean;
  csrf?: string;
  /** The conversation on screen. */
  viewing?: string;
  /** Route to a path inside the app. */
  open: (path: string) => void;
}) {
  useEffect(() => {
    if (!on || !csrf) return;
    let lastInput = document.visibilityState === "visible" ? Date.now() : 0;
    let lastReport = 0;
    const report = () => {
      const now = Date.now();
      if (
        document.visibilityState !== "visible" ||
        now - lastInput > inputWindowMs ||
        now - lastReport < reportGapMs
      )
        return;
      lastReport = now;
      void mutationFetch(
        "account.push_presence",
        "/api/v1/notifications/presence",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "X-Agent-Host-CSRF": csrf,
            Origin: window.location.origin,
          },
        },
      ).catch(() => undefined);
    };
    const input = () => {
      lastInput = Date.now();
      report();
    };
    const visibility = () => {
      if (document.visibilityState === "visible") input();
    };
    const events = ["keydown", "pointerdown", "wheel", "touchstart"] as const;
    for (const name of events)
      window.addEventListener(name, input, { capture: true, passive: true });
    document.addEventListener("visibilitychange", visibility);
    const timer = window.setInterval(report, reportGapMs);
    report();
    return () => {
      for (const name of events)
        window.removeEventListener(name, input, { capture: true });
      document.removeEventListener("visibilitychange", visibility);
      window.clearInterval(timer);
    };
  }, [on, csrf]);

  useEffect(() => {
    if (!pushSupported()) return;
    if (!on) {
      // Off on another device forgot this one too: end its subscription.
      if (known && csrf) void dropThisDevice();
      return;
    }
    if (csrf) void refreshThisDevice(csrf).catch(() => undefined);
  }, [on, known, csrf]);

  // A tapped notification, whatever the switch reads now (signed out, or
  // preferences not read yet): the worker navigates the window itself when
  // this page does not acknowledge.
  useEffect(() => {
    if (!pushSupported()) return;
    const message = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; url?: unknown } | null;
      if (data?.type !== "open-habitat.open" || typeof data.url !== "string")
        return;
      const url = new URL(data.url, window.location.origin);
      if (url.origin !== window.location.origin) return;
      event.ports[0]?.postMessage("routed");
      open(url.pathname + url.search + url.hash);
    };
    navigator.serviceWorker.addEventListener("message", message);
    return () =>
      navigator.serviceWorker.removeEventListener("message", message);
  }, [open]);

  useEffect(() => {
    if (!on || !viewing || !pushSupported()) return;
    const close = () => {
      if (document.visibilityState !== "visible") return;
      void navigator.serviceWorker
        .getRegistration(workerPath)
        .then((r) => r?.getNotifications({ tag: viewing }))
        .then((list) => {
          for (const n of list ?? []) n.close();
        })
        .catch(() => undefined);
    };
    close();
    document.addEventListener("visibilitychange", close);
    return () => document.removeEventListener("visibilitychange", close);
  }, [on, viewing]);
}
