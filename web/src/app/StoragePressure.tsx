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
import { settingsHref } from "./settingsRoute";
import { bytes, type OwnStorage, ownStorage } from "./storageQuota";

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
  const what = shared ? "Palvelimen levy" : "Tallennustilasi";
  const percent = Math.floor((used / bound) * 100);
  return {
    key: "storage",
    tone: full || critical ? "danger" : "warning",
    icon: "disk",
    group: "own",
    short: full
      ? "Tila täynnä"
      : critical
        ? "Tila melkein täynnä"
        : "Tila lähes täynnä",
    title: full
      ? `${what} on täynnä`
      : `${what} on ${critical ? "melkein" : "lähes"} täynnä (${percent} %)`,
    meta: `${bytes(used)} / ${bytes(bound)}`,
    body: `${shared ? "Levy on kaikkien käyttäjien yhteinen; myös muiden tiedostot täyttävät sitä. " : ""}${critical ? "Kun tila loppuu, tallennukset katkeavat kesken, myös agenttien kirjoittamat keskusteluhistoriat. " : ""}Vapauta tilaa roskakorista tai pyydä agenttia siivoamaan tarpeettomia tiedostoja, esimerkiksi käännösvälimuistit ja vanhat worktreet. Roskakoriin siirtäminen ei vapauta tilaa ennen sen tyhjentämistä.${full ? " Tallennus on voinut epäonnistua. Viestejä ei lähetetä uudelleen automaattisesti." : ""}${unavailable ? " Tallennustilaa ei voitu tarkistaa; tämä on viimeisin tieto." : ""}`,
    data: {
      full: String(full),
      critical: String(critical),
      shared: String(shared),
      unavailable: String(unavailable),
    },
    actions: [
      {
        testId: "quota-storage-open",
        label: "Tallennustila ja roskakori",
        primary: true,
        onPress: () => navigate(settingsHref("tila")),
      },
      {
        testId: "quota-recheck",
        label: "Tarkista vapautettu tila",
        keepOpen: true,
        onPress: retry,
      },
    ],
  };
}
