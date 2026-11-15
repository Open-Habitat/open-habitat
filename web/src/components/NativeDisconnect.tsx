import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import {
  clearDisconnectReturn,
  confirmDisconnectSignIn,
  takeDisconnectReturn,
} from "../app/githubDisconnectReturn";
import { mutationFetch } from "../app/mutations";
import { liveText } from "../i18n";
import { inlineSettingsText } from "../text/inlineSettings";
import { ControlButton } from "./ControlElements";
import { StatusMark } from "./Status";

const txt = liveText(inlineSettingsText);
const path = "/api/v1/account/github/disconnect";
async function needsSignIn(r: Response) {
  if (r.status !== 403) return false;
  const body: unknown = await r
    .clone()
    .json()
    .catch(() => null);
  if (!body || typeof body !== "object") return false;
  const error = (body as Record<string, unknown>).error;
  return (
    !!error &&
    typeof error === "object" &&
    (error as Record<string, unknown>).code === "reauthentication_required"
  );
}
export function NativeDisconnect({
  identity,
  csrf,
  onDisconnected,
}: {
  identity?: string;
  csrf: string;
  onDisconnected?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [reauth, setReauth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [writing, setWriting] = useState(false);
  const [notice, setNotice] = useState("");
  // Closing, unmounting or starting another inspection invalidates old replies.
  const generation = useRef(0);
  const returned = useRef<boolean | undefined>(undefined);
  const close = () => {
    clearDisconnectReturn();
    generation.current++;
    setOpen(false);
    setToken("");
    setBusy(false);
  };
  const inspect = useCallback(async () => {
    const current = ++generation.current;
    setOpen(true);
    setBusy(true);
    setToken("");
    setReauth(false);
    setNotice("");
    try {
      const r = await fetch(path, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const freshRequired = await needsSignIn(r);
      if (current !== generation.current) return;
      if (freshRequired) {
        setReauth(true);
        return;
      }
      if (!r.ok) throw new Error();
      const v: unknown = await r.json();
      if (current !== generation.current) return;
      if (
        !v ||
        typeof v !== "object" ||
        (v as Record<string, unknown>).state !== "connected" ||
        (v as Record<string, unknown>).scope !== "user" ||
        typeof (v as Record<string, unknown>).observation_token !== "string"
      )
        throw new Error();
      setToken((v as { observation_token: string }).observation_token);
    } catch {
      if (current === generation.current) setNotice(txt.stateUnknown);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    if (identity) {
      returned.current ??= takeDisconnectReturn(identity);
      // Let a discarded StrictMode effect clean up before issuing a GET:
      // concurrent observations would invalidate each other's daemon token.
      if (returned.current)
        queueMicrotask(() => {
          if (active) void inspect();
        });
    }
    // Identity changes remount this component in CodeHostSettings.
    return () => {
      active = false;
      generation.current++;
    };
  }, [identity, inspect]);
  const disconnect = async () => {
    if (!token || busy) return;
    const current = ++generation.current;
    setBusy(true);
    setWriting(true);
    setToken("");
    setNotice("");
    try {
      const r = await mutationFetch("github.disconnect", path, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Host-CSRF": csrf,
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          scope: "user",
          confirmation: "disconnect",
          observation_token: token,
        }),
      });
      const freshRequired = await needsSignIn(r);
      if (current !== generation.current) return;
      if (freshRequired) {
        setReauth(true);
        return;
      }
      if (!r.ok) throw new Error();
      const v: unknown = await r.json();
      if (current !== generation.current) return;
      if (
        !v ||
        typeof v !== "object" ||
        (v as Record<string, unknown>).state !== "disconnected" ||
        (v as Record<string, unknown>).revokes_oauth_token !== false
      )
        throw new Error();
      setOpen(false);
      onDisconnected?.();
    } catch {
      if (current === generation.current) setNotice(txt.uncertain);
    } finally {
      if (current === generation.current) {
        setBusy(false);
        setWriting(false);
      }
    }
  };
  return (
    <div>
      <ControlButton
        size="row"
        variant="danger-subtle"
        isDisabled={busy}
        onPress={() => void inspect()}
        data-testid="github-disconnect-inspect"
      >
        {txt.check}
      </ControlButton>
      <ModalOverlay
        className="ah-overlay"
        isOpen={open}
        onOpenChange={(value) => {
          if (!value && !writing) close();
        }}
        isDismissable={!writing}
      >
        <Modal className="ah-modal">
          <Dialog
            className="ah-dialog"
            aria-label={txt.question}
            data-testid="github-disconnect-dialog"
          >
            <Heading slot="title">{txt.question}</Heading>
            <p>{txt.effect}</p>
            <p className="s-desc">
              {txt.note}{" "}
              <a
                href="https://github.com/settings/applications"
                target="_blank"
                rel="noreferrer"
                data-testid="github-grant-settings"
              >
                {txt.grantSettings}
              </a>
            </p>
            {reauth && <p>{txt.reauth}</p>}
            {token && returned.current && (
              <p>
                <StatusMark
                  kind="success"
                  tone="success"
                  label={txt.verified}
                />
              </p>
            )}
            {notice && <p role="status">{notice}</p>}
            <div className="ah-dialog-actions">
              <ControlButton
                data-testid="cancel"
                size="page"
                isDisabled={writing}
                onPress={close}
              >
                {txt.cancel}
              </ControlButton>
              {reauth ? (
                <ControlButton
                  key="reauth"
                  size="page"
                  variant="primary"
                  isDisabled={!identity || busy}
                  onPress={() => {
                    if (identity) confirmDisconnectSignIn(identity);
                  }}
                  data-testid="github-disconnect-reauth"
                >
                  {txt.verify}
                </ControlButton>
              ) : token ? (
                <ControlButton
                  key="confirm"
                  size="page"
                  isDisabled={busy}
                  variant="danger-subtle"
                  onPress={() => void disconnect()}
                  data-testid="github-disconnect-confirm"
                >
                  {txt.confirm}
                </ControlButton>
              ) : (
                <ControlButton
                  key="retry"
                  size="page"
                  isDisabled={busy}
                  onPress={() => void inspect()}
                  data-testid="github-disconnect-retry"
                >
                  {busy ? txt.checking : txt.retry}
                </ControlButton>
              )}
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  );
}
