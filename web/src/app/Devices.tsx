import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import {
  LinkCard,
  type LinkPhase,
  SessionList,
} from "../components/DeviceLink";
import { Button } from "../components/Primitives";
import {
  type BrowserSession,
  cancelLink,
  deviceName,
  endSession,
  linkStatus,
  linkURL,
  listSessions,
  mintLink,
} from "./deviceLink";

/** Settings › Laitteet: show a phone sign-in code, list and end sessions. */
export function Devices({
  csrf,
  onLogout,
}: {
  csrf?: string;
  onLogout?: () => void;
}) {
  const [phase, setPhase] = useState<LinkPhase>({ kind: "idle" });
  const [sessions, setSessions] = useState<BrowserSession[]>();
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState<string>();
  const [ending, setEnding] = useState<BrowserSession>();
  const deadline = useRef(0);
  const pending = phase.kind === "pending";

  const refresh = useCallback((signal?: AbortSignal) => {
    void listSessions(signal)
      .then((list) => {
        if (!signal?.aborted) {
          setSessions(list);
          setError("");
        }
      })
      .catch(() => {
        if (!signal?.aborted)
          setError("Laitteita ei voitu hakea. Yritä uudelleen.");
      });
  }, []);
  useEffect(() => {
    void csrf;
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [csrf, refresh]);

  const show = async () => {
    if (!csrf) return;
    setPhase({ kind: "minting" });
    try {
      const minted = await mintLink(csrf);
      deadline.current = Date.now() + minted.expires_in_seconds * 1000;
      setPhase({
        kind: "pending",
        url: linkURL(minted.token),
        left: minted.expires_in_seconds,
        total: minted.expires_in_seconds,
      });
    } catch {
      setPhase({ kind: "failed" });
    }
  };

  // While the code shows: count down locally and ask the gateway whether a
  // device used it. Only the countdown text and bar change each second.
  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    const tick = window.setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000),
      );
      setPhase((p) => (p.kind === "pending" ? { ...p, left } : p));
    }, 250);
    const poll = window.setInterval(() => {
      void linkStatus(controller.signal)
        .then((status) => {
          if (controller.signal.aborted || status.state === "pending") return;
          if (status.state === "used") {
            setFresh(status.session?.id);
            setPhase({ kind: "used", session: status.session });
            refresh();
          } else if (status.state === "failed") setPhase({ kind: "failed" });
          else setPhase({ kind: "expired" });
        })
        .catch(() => {});
    }, 1500);
    return () => {
      controller.abort();
      window.clearInterval(tick);
      window.clearInterval(poll);
    };
  }, [pending, refresh]);
  useEffect(() => {
    if (phase.kind === "pending" && phase.left === 0)
      setPhase({ kind: "expired" });
  }, [phase]);
  // A code is shown only on request: leaving the section cancels it.
  const live = useRef({ pending, csrf });
  live.current = { pending, csrf };
  useEffect(
    () => () => {
      if (live.current.pending && live.current.csrf)
        void cancelLink(live.current.csrf).catch(() => {});
    },
    [],
  );

  const cancel = () => {
    if (csrf) void cancelLink(csrf).catch(() => {});
    setPhase({ kind: "idle" });
  };
  const confirmEnd = async () => {
    const target = ending;
    setEnding(undefined);
    if (!target || !csrf) return;
    try {
      await endSession(csrf, target.id);
      if (phase.kind === "used" && phase.session?.id === target.id)
        setPhase({ kind: "idle" });
    } catch {
      setError("Uloskirjaus epäonnistui. Yritä uudelleen.");
    }
    refresh();
  };

  return (
    <>
      <LinkCard
        phase={phase}
        onShow={() => void show()}
        onCancel={cancel}
        onDone={() => setPhase({ kind: "idle" })}
      />
      <h3 className="dl-h3">
        Kirjautuneet laitteet
        {sessions && <span className="dl-count">{sessions.length}</span>}
      </h3>
      {error && <p role="alert">{error}</p>}
      {sessions && (
        <SessionList
          sessions={sessions}
          fresh={fresh}
          onEnd={setEnding}
          onLogout={onLogout}
        />
      )}
      <ModalOverlay
        isOpen={Boolean(ending)}
        onOpenChange={(open) => {
          if (!open) setEnding(undefined);
        }}
        className="ah-overlay"
        isDismissable
      >
        <Modal className="ah-modal ah-logout-modal">
          <AriaDialog className="ah-dialog">
            <Heading slot="title">
              Kirjataanko {ending ? deviceName(ending) : ""} ulos?
            </Heading>
            <div className="ah-dialog-actions">
              <Button
                label="Peruuta"
                variant="secondary"
                onPress={() => setEnding(undefined)}
              />
              <Button
                label="Kirjaa ulos"
                variant="danger"
                onPress={() => void confirmEnd()}
              />
            </div>
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}
