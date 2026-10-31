import { useCallback, useEffect, useState } from "react";
import { ExperimentalFeaturesControl } from "../components/ExperimentalFeatures";
import {
  type PushDeviceRow,
  PushDevices,
  type PushHere,
  type PushNote,
} from "../components/PushDevices";
import {
  type ExperimentalFeatureId,
  experimentalFeatureIds,
  loadAccountPreferences,
  setExperimentalFeature,
  useAccountPreferences,
} from "./accountPreferences";
import {
  appleMobile,
  homeScreenApp,
  PushProblem,
  type PushState,
  pushSupported,
  readPushState,
  removeDevice,
  subscribeThisDevice,
  testDevice,
  thisDeviceId,
} from "./push";

const known = (id: string): id is ExperimentalFeatureId =>
  (experimentalFeatureIds as readonly string[]).includes(id);

const push = "push-when-your-turn";

/** Asks for notification permission. It must start in the person's press:
 * Safari refuses a request made after an awaited write. */
function askPermission(): Promise<NotificationPermission> | undefined {
  if (!pushSupported() || Notification.permission !== "default") return;
  return Notification.requestPermission();
}

function pushHere(): PushHere {
  if (appleMobile() && !homeScreenApp()) return "home-screen";
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ready";
}

function problemNote(e: unknown): PushNote {
  return { kind: "problem", code: e instanceof PushProblem ? e.code : "other" };
}

/** The phone notifications card's devices, while the feature is on. */
function PushDevicesPanel({
  csrf,
  pending,
}: {
  csrf: string;
  /** A subscription the switch's press started (permission asked there). */
  pending?: Promise<unknown>;
}) {
  const [state, setState] = useState<PushState>();
  const [readError, setReadError] = useState(false);
  const [mine, setMine] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [note, setNote] = useState<PushNote>();
  const [here, setHere] = useState<PushHere>(pushHere);
  const read = useCallback(async () => {
    try {
      setState(await readPushState());
      setReadError(false);
    } catch {
      setReadError(true);
    }
    setMine(await thisDeviceId());
    setHere(pushHere());
  }, []);
  useEffect(() => {
    void read();
  }, [read]);
  const enable = useCallback(
    async (permission?: Promise<NotificationPermission>) => {
      setBusy("enable");
      setNote(undefined);
      try {
        if (permission) await permission;
        const now = pushHere();
        setHere(now);
        // The card says why this browser cannot (home screen first, blocked).
        if (now !== "ready") return;
        if (Notification.permission !== "granted")
          throw new PushProblem("permission");
        const next = await subscribeThisDevice(csrf);
        setState(next);
        setMine(next.device_id);
      } catch (e) {
        setNote(problemNote(e));
        setHere(pushHere());
      } finally {
        setBusy(undefined);
      }
    },
    [csrf],
  );
  useEffect(() => {
    if (!pending) return;
    setBusy("enable");
    void pending.then(() => enable());
  }, [pending, enable]);
  const devices: PushDeviceRow[] = (state?.devices ?? []).map((d) => ({
    device_id: d.device_id,
    label: d.label,
    created_at: d.created_at,
    failed: !!d.last_delivery && d.last_delivery.outcome !== "delivered",
  }));
  return (
    <PushDevices
      devices={devices}
      thisDevice={mine}
      here={here}
      busy={busy}
      note={note}
      readError={readError}
      onReload={() => void read()}
      onEnable={() => void enable(askPermission())}
      onTest={(id) => {
        setBusy(id);
        setNote(undefined);
        void testDevice(csrf, id)
          .then((outcome) => setNote({ kind: "outcome", outcome }))
          .catch((e) => setNote(problemNote(e)))
          .finally(() => {
            setBusy(undefined);
            void read();
          });
      }}
      onRemove={(id) => {
        setBusy(id);
        setNote(undefined);
        void removeDevice(csrf, id)
          .then(setState)
          .catch((e) => setNote(problemNote(e)))
          .finally(() => {
            setBusy(undefined);
            void read();
          });
      }}
    />
  );
}

export function ExperimentalFeatures({
  identity,
  csrf,
}: {
  identity?: string;
  csrf?: string;
}) {
  const state = useAccountPreferences(identity, csrf);
  const [pending, setPending] = useState<Promise<unknown>>();
  return (
    <ExperimentalFeaturesControl
      enabled={(id) => !!state.experimental[id]}
      disabled={!identity || !csrf || !state.loaded || !!state.busy}
      busy={state.busy}
      error={state.error}
      onChange={(id, on) => {
        if (!identity || !csrf || !known(id)) return;
        if (id !== push) {
          void setExperimentalFeature(identity, id, on, csrf);
          return;
        }
        if (!on) {
          // The daemon forgets the key and every device; this browser ends
          // its own subscription once the switch is confirmed off
          // (usePushNotifications), never on a failed write.
          void setExperimentalFeature(identity, id, false, csrf);
          return;
        }
        // Turning on subscribes this device: the permission is asked in
        // this press, the subscription made once the switch is saved.
        const permission = askPermission();
        setPending(
          setExperimentalFeature(identity, id, true, csrf).then(
            () => permission,
          ),
        );
      }}
      onReload={
        identity && csrf
          ? () => void loadAccountPreferences(identity, csrf)
          : undefined
      }
      details={(id) =>
        id === push && state.experimental[push] && csrf ? (
          <PushDevicesPanel csrf={csrf} pending={pending} />
        ) : null
      }
    />
  );
}
