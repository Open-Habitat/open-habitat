import Ajv from "ajv/dist/2020.js";
import { useEffect, useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import schema from "../../../contracts/v1/pi-credentials.schema.json";
import { ControlButton } from "../components/ControlElements";
import { mutationFetch } from "./mutations";

const valid = new Ajv({ strict: false }).compile(schema);
type Credentials = {
  schema_version: 1;
  openai: { present: boolean; suffix: string | null };
  subscription: { present: boolean };
};
async function read(response: Response): Promise<Credentials> {
  if (!response.ok) throw Error("unavailable");
  // The credential reply is tiny. Bound the stream, never render diagnostics.
  const reader = response.body?.getReader();
  if (!reader) throw Error("unavailable");
  let text = "";
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4096) {
        await reader.cancel();
        throw Error("oversize");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  const data: unknown = JSON.parse(text);
  if (!valid(data)) throw Error("contract");
  return data as Credentials;
}
export function PiCredentials({
  csrf,
  onSaved,
}: {
  csrf?: string;
  onSaved?: () => void;
}) {
  const [data, setData] = useState<Credentials>();
  const [key, setKey] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    void revision;
    const controller = new AbortController();
    setData(undefined);
    setKey("");
    setEditing(false);
    void fetch("/api/v1/pi/credentials", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(read)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Tunnuksia ei voitu tarkistaa.");
      });
    return () => controller.abort();
  }, [revision]);
  const change = async (remove = false) => {
    if (!csrf || busy) return;
    setBusy(true);
    setError("");
    setConfirm(false);
    const body = remove
      ? undefined
      : JSON.stringify({ provider: "openai", key });
    setKey("");
    setEditing(false);
    try {
      const response = await mutationFetch(
        "pi.credentials",
        `/api/v1/pi/credentials${remove ? "/openai" : ""}`,
        {
          method: remove ? "DELETE" : "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "X-Agent-Host-CSRF": csrf,
          },
          body,
        },
      );
      setData(await read(response));
      onSaved?.();
    } catch {
      setData(undefined);
      setError(
        "Muutoksen tulosta ei voitu vahvistaa. Tarkista tunnukset ennen uutta yritystä.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="s-row">
      <div className="s-lbl">
        <strong>OpenAI API-avain</strong>
        <span className="s-desc">
          Pi:n omat tunnukset tällä palvelimella. OpenAI laskuttaa käytöstä.
        </span>
      </div>
      <div
        className="s-val"
        data-testid="api-key-state"
        data-present={data?.openai.present}
      >
        <span data-testid="api-key-suffix">
          {data
            ? data.openai.present
              ? data.openai.suffix
                ? `sk-…${data.openai.suffix}`
                : "Avain tallennettu (ei kirjaimellinen avain)"
              : "Ei avainta"
            : "Avaimen tilaa ei tiedetä"}
        </span>
        {data && (
          <ControlButton
            size="row"
            isDisabled={busy || !csrf}
            onPress={() => setEditing(true)}
            data-testid="api-key-add"
          >
            {data.openai.present ? "Vaihda" : "Lisää avain"}
          </ControlButton>
        )}
        {data?.openai.present && (
          <ControlButton
            data-testid="api-key-remove-open"
            size="row"
            isDisabled={busy || !csrf}
            variant="quiet"
            onPress={() => setConfirm(true)}
          >
            Poista avain…
          </ControlButton>
        )}
      </div>
      {editing && (
        <form
          className="s-editor"
          onSubmit={(e) => {
            e.preventDefault();
            void change();
          }}
        >
          <label className="s-field">
            API-avain
            <input
              data-testid="api-key-input"
              type="password"
              autoComplete="off"
              value={key}
              maxLength={203}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <p className="s-desc">
            Avain lähetetään kerran eikä sitä palauteta. Ensimmäinen avain
            vaihtaa uusien keskustelujen oletukseksi API-avaimen; avoimet
            keskustelut eivät muutu.
          </p>
          <div className="s-actions">
            <ControlButton
              data-testid="cancel"
              size="row"
              onPress={() => {
                setKey("");
                setEditing(false);
              }}
            >
              Peruuta
            </ControlButton>
            <ControlButton
              data-testid="api-key-save"
              size="row"
              type="submit"
              isDisabled={busy || !/^sk-[A-Za-z0-9_-]{20,200}$/.test(key)}
            >
              Tallenna avain
            </ControlButton>
          </div>
        </form>
      )}
      {error && (
        <div className="s-editor" role="alert">
          {error}
          <ControlButton
            size="row"
            onPress={() => {
              setError("");
              setRevision((r) => r + 1);
            }}
          >
            Tarkista tunnukset
          </ControlButton>
        </div>
      )}
      <ModalOverlay
        className="ah-overlay"
        isOpen={confirm}
        onOpenChange={setConfirm}
        isDismissable
      >
        <Modal className="ah-modal">
          <Dialog className="ah-dialog" aria-label="Poistetaanko API-avain?">
            <Heading slot="title">Poistetaanko API-avain?</Heading>
            <p>
              Avain poistuu vain Pi:n tunnuksista tällä palvelimella. Avainta ei
              peruta OpenAI:ssa. Avainta käyttävät keskustelut eivät voi jatkaa
              ennen uuden avaimen lisäämistä. ChatGPT-kirjautuminen säilyy.
            </p>
            <div className="ah-dialog-actions">
              <ControlButton
                data-testid="cancel"
                size="row"
                onPress={() => setConfirm(false)}
              >
                Peruuta
              </ControlButton>
              <ControlButton
                data-testid="api-key-remove-confirm"
                size="row"
                variant="danger-subtle"
                onPress={() => void change(true)}
              >
                Poista avain
              </ControlButton>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  );
}
