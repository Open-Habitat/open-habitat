import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import type { StatusItem } from "../components/StatusBell";
import { liveText } from "../i18n";
import { statusText } from "../text/status";
import { settingsHref } from "./settingsRoute";
import { bytes, type OwnStorage, ownStorage } from "./storageQuota";

const txt = liveText(statusText);

// Room left and its bound: the person's quota, or without per-user limits the
// shared home disk, which anyone's files can fill.
const room = (s: OwnStorage) =>
  s.limits === "not_in_use"
    ? {
        used: s.filesystem.capacity_bytes - s.filesystem.free_bytes,
        bound: s.filesystem.capacity_bytes,
        shared: true,
      }
    : { used: s.usage_bytes, bound: s.limit_bytes, shared: false };

const Pressure = createContext<{
  full: boolean;
  quota?: OwnStorage;
  unavailable: boolean;
  check: number;
  retry: () => void;
}>({ full: false, unavailable: false, check: 0, retry: () => {} });
export const useStoragePressure = () => useContext(Pressure);

// Mounted inside the identity-keyed subtree: no observation survives a login change.
// Reads remain available at quota, and never resend a prompt or start Pi.
export function StoragePressureProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const [quota, setQuota] = useState<OwnStorage>();
  const [request, setRequest] = useState(0);
  const [check, setCheck] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    void request; // Explicit recheck restarts the single-flight read loop.
    if (!enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        const next = await ownStorage(controller.signal);
        if (!controller.signal.aborted) {
          setQuota(next);
          setUnavailable(false);
        }
      } catch {
        if (!controller.signal.aborted) setUnavailable(true);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(read, 10000);
      }
    };
    void read();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, request]);
  // ext4 allocates whole blocks: a final partial block is not writable space.
  const full = !!quota && room(quota).bound - room(quota).used < 4096;
  const wasFull = useRef(false);
  useEffect(() => {
    if (wasFull.current && !full) setCheck((n) => n + 1);
    wasFull.current = full;
  }, [full]);
  return (
    <Pressure.Provider
      value={{
        full,
        quota,
        unavailable,
        check,
        retry: () => {
          setRequest((n) => n + 1);
          setCheck((n) => n + 1);
        },
      }}
    >
      {children}
    </Pressure.Provider>
  );
}

// A full quota cuts writes mid-file, agents' as well as the person's (29.10.
// 2026 it cut a conversation's history). The bell says so early: quietly from
// 85 %, and from 95 % on the bell itself, while there is still room to act.
const NEAR = 0.85;
const CRITICAL = 0.95;

/** Storage near its limit or full, as the bell's item; nothing below 85 %. */
export function useStorageStatus(): StatusItem | undefined {
  const { full, quota, unavailable, retry } = useStoragePressure();
  const navigate = useNavigate();
  if (!quota) return undefined;
  const { used, bound, shared } = room(quota);
  if (used < bound * NEAR) return undefined;
  const critical = !full && used >= bound * CRITICAL;
  const what = shared ? txt.serverDisk : txt.yourStorage;
  const percent = Math.floor((used / bound) * 100);
  return {
    key: "storage",
    tone: full || critical ? "danger" : "warning",
    icon: "disk",
    group: "own",
    short: full ? txt.full : critical ? txt.critical : txt.near,
    title: full ? txt.fullTitle(what) : txt.nearTitle(what, critical, percent),
    meta: `${bytes(used)} / ${bytes(bound)}`,
    body: txt.storageBody(shared, critical, full, unavailable),
    data: {
      full: String(full),
      critical: String(critical),
      shared: String(shared),
      unavailable: String(unavailable),
    },
    actions: [
      {
        testId: "quota-storage-open",
        label: txt.storageOpen,
        primary: true,
        onPress: () => navigate(settingsHref("tila")),
      },
      {
        testId: "quota-recheck",
        label: txt.recheckStorage,
        keepOpen: true,
        onPress: retry,
      },
    ],
  };
}
