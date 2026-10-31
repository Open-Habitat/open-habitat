import { useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { mutationFetch } from "../app/mutations";
import { liveText } from "../i18n";
import { inlineSettingsText } from "../text/inlineSettings";
import { ControlButton } from "./ControlElements";

const txt = liveText(inlineSettingsText);

const path = "/api/v1/account/github/disconnect";
export function NativeDisconnect({
  csrf,
  onDisconnected,
}: {
  csrf: string;
  onDisconnected?: () => void;
}) {
  const [token, setToken] = useState("");
  const confirmation = "disconnect";
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const inspect = async () => {
    setBusy(true);
    setToken("");
    setNotice("");
    try {
      const r = await fetch(path, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (r.status === 403) {
        setNotice(txt.reauth);
        return;
      }
      if (!r.ok) throw new Error();
      const v: unknown = await r.json();
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
      setNotice(txt.stateUnknown);
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    if (!token || confirmation !== "disconnect" || busy) return;
    setBusy(true);
    setToken("");
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
          confirmation,
          observation_token: token,
        }),
      });
      if (!r.ok) throw new Error();
      const v: unknown = await r.json();
      if (
        !v ||
        typeof v !== "object" ||
        (v as Record<string, unknown>).state !== "disconnected" ||
        (v as Record<string, unknown>).revokes_oauth_token !== false
      )
        throw new Error();
      setNotice(txt.disconnected);
      onDisconnected?.();
    } catch {
      setNotice(txt.uncertain);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <p>{txt.note}</p>
      <ControlButton
        size="row"
        isDisabled={busy}
        onPress={() => void inspect()}
        data-testid="github-disconnect-inspect"
      >
        {txt.check}
      </ControlButton>
      <ModalOverlay
        className="ah-overlay"
        isOpen={!!token}
        onOpenChange={(open) => {
          if (!open) setToken("");
        }}
        isDismissable
      >
        <Modal className="ah-modal">
          <Dialog className="ah-dialog" aria-label={txt.question}>
            <Heading slot="title">{txt.question}</Heading>
            <p>{txt.effect}</p>
            <div className="ah-dialog-actions">
              <ControlButton
                data-testid="cancel"
                size="page"
                onPress={() => setToken("")}
              >
                {txt.cancel}
              </ControlButton>
              <ControlButton
                size="page"
                isDisabled={busy}
                variant="danger-subtle"
                onPress={() => void disconnect()}
                data-testid="github-disconnect-confirm"
              >
                {txt.confirm}
              </ControlButton>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
