import Ajv from "ajv/dist/2020.js";
import { useEffect, useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import schema from "../../../contracts/v1/pi-credentials.schema.json";
import { ControlButton } from "../components/ControlElements";
import { StatusMark } from "../components/Status";
import { mutationFetch } from "./mutations";
import { readSiteOnboarding, type SiteOnboarding } from "./onboardingConfig";

const valid = new Ajv({ strict: false }).compile(schema);
/** Pi's providers whose API key a person manages here. */
export type KeyProvider = "openai" | "anthropic" | "deepseek";
const keyProviders: KeyProvider[] = ["openai", "anthropic", "deepseek"];
const names: Record<KeyProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
};
// The daemon accepts one literal shape for every provider; an Anthropic key
// is told apart by its prefix, so a key pasted into the wrong row is caught
// here before it is stored where the other provider would be billed.
const literalKey = /^sk-[A-Za-z0-9_-]{20,200}$/;
const keyFits = (provider: KeyProvider, key: string) =>
  literalKey.test(key) &&
  (provider === "anthropic"
    ? key.startsWith("sk-ant-")
    : !key.startsWith("sk-ant-"));
const givenDay = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getDate()}.${d.getMonth() + 1}.`;
};
const keyHint: Record<KeyProvider, string> = {
  openai: "alkaa sk-",
  anthropic: "alkaa sk-ant-",
  deepseek: "alkaa sk-",
};
type Key = { present: boolean; suffix: string | null };
type Credentials = {
  schema_version: 1;
  subscription: { present: boolean };
} & Record<KeyProvider, Key>;
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
  providers = keyProviders,
  embedded = false,
}: {
  csrf?: string;
  onSaved?: () => void;
  /** Inside the onboarding AI step's key row, which owns the heading: one
   * field with Tallenna on the same line. Settings keeps its rows. */
  embedded?: boolean;
  /** The key rows to show; one native read serves them all. */
  providers?: KeyProvider[];
}) {
  const [data, setData] = useState<Credentials>();
  const [key, setKey] = useState("");
  const [editing, setEditing] = useState<KeyProvider>();
  const [confirm, setConfirm] = useState<KeyProvider>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  // The site's own record of a key it gave this person: their row is marked
  // as the site's only while its last four characters are the stored key's.
  const [given, setGiven] = useState<SiteOnboarding["site_key_copy"]>();
  useEffect(() => {
    if (embedded) return;
    const controller = new AbortController();
    void readSiteOnboarding(controller.signal)
      .then((site) => {
        if (!controller.signal.aborted) setGiven(site.site_key_copy);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [embedded]);
  useEffect(() => {
    void revision;
    const controller = new AbortController();
    setData(undefined);
    setKey("");
    setEditing(undefined);
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
  const change = async (provider: KeyProvider, remove = false) => {
    if (!csrf || busy) return;
    setBusy(true);
    setError("");
    setConfirm(undefined);
    const body = remove ? undefined : JSON.stringify({ provider, key });
    setKey("");
    setEditing(undefined);
    try {
      const response = await mutationFetch(
        "pi.credentials",
        `/api/v1/pi/credentials${remove ? `/${provider}` : ""}`,
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
  if (embedded)
    return (
      <>
        {providers.map((provider) => {
          const stored = data?.[provider];
          const wrong = key !== "" && !keyFits(provider, key);
          return (
            <form
              key={provider}
              className="ah-key-embedded"
              data-testid={`api-key-row-${provider}`}
              onSubmit={(e) => {
                e.preventDefault();
                if (keyFits(provider, key)) void change(provider);
              }}
            >
              <div
                data-testid="api-key-state"
                data-present={stored?.present}
                role="status"
              >
                {stored?.present ? (
                  <StatusMark
                    tone="success"
                    label={
                      stored.suffix
                        ? `${names[provider]}-avain tallennettu · sk-…${stored.suffix}`
                        : `${names[provider]}-avain tallennettu`
                    }
                  />
                ) : null}
              </div>
              <label className="ah-key-embedded-field">
                <strong>
                  {stored?.present ? "Uusi " : ""}
                  {names[provider]} API-avain
                </strong>
                <span className="ah-inline-field">
                  <input
                    data-testid="api-key-input"
                    type="password"
                    autoComplete="off"
                    value={key}
                    maxLength={203}
                    placeholder={provider === "anthropic" ? "sk-ant-…" : "sk-…"}
                    aria-invalid={wrong || undefined}
                    onChange={(e) => setKey(e.target.value)}
                  />
                  <ControlButton
                    data-testid="api-key-save"
                    size="row"
                    variant="primary"
                    type="submit"
                    isDisabled={busy || !csrf || !keyFits(provider, key)}
                  >
                    Tallenna
                  </ControlButton>
                </span>
              </label>
              <p className="ah-sign-in-hint">
                {wrong ? (
                  <span role="alert">
                    Tämä ei näytä {names[provider]}-avaimelta (
                    {keyHint[provider]}).
                  </span>
                ) : (
                  `Avain tallentuu vain omalle käyttäjällesi eikä sitä näytetä uudelleen. ${names[provider]} laskuttaa käytöstä.`
                )}
              </p>
              {error && (
                <div className="ah-sign-in-actions" role="alert">
                  <span>{error}</span>
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
            </form>
          );
        })}
      </>
    );
  return (
    <>
      {providers.map((provider) => {
        const stored = data?.[provider];
        const site =
          given?.provider === provider &&
          stored?.present &&
          stored.suffix === given.suffix
            ? given
            : undefined;
        return (
          <div
            className="s-row"
            key={provider}
            data-testid={`api-key-row-${provider}`}
            data-site={
              site ? (site.current ? "current" : "earlier") : undefined
            }
          >
            <div className="s-lbl">
              <strong>{names[provider]} API-avain</strong>
              <span className="s-desc" data-testid="api-key-desc">
                {site ? (
                  <>
                    Sivuston avain. Sivusto antoi sen {givenDay(site.at)} Käyttö
                    laskutetaan sivuston tililtä.{" "}
                    {site.current
                      ? "Voit vaihtaa sen omaan avaimeesi."
                      : "Sivusto on sittemmin vaihtanut avaimensa, joten tämä kopio voi lakata toimimasta."}
                  </>
                ) : (
                  <>
                    Pi:n omat tunnukset tällä palvelimella. {names[provider]}{" "}
                    laskuttaa käytöstä.
                  </>
                )}
              </span>
            </div>
            <div
              className="s-val"
              data-testid="api-key-state"
              data-present={stored?.present}
            >
              <span data-testid="api-key-suffix">
                {stored
                  ? stored.present
                    ? stored.suffix
                      ? `sk-…${stored.suffix}`
                      : "Avain tallennettu (ei kirjaimellinen avain)"
                    : "Ei avainta"
                  : "Avaimen tilaa ei tiedetä"}
              </span>
              {site && (
                <StatusMark
                  data-testid="api-key-site"
                  tone={site.current ? "info" : "warning"}
                  label={
                    site.current ? "Sivuston avain" : "Sivuston aiempi avain"
                  }
                />
              )}
              {stored && (
                <ControlButton
                  size="row"
                  isDisabled={busy || !csrf}
                  onPress={() => {
                    setKey("");
                    setEditing(provider);
                  }}
                  data-testid="api-key-add"
                >
                  {site
                    ? "Vaihda omaan…"
                    : stored.present
                      ? "Vaihda"
                      : "Lisää avain"}
                </ControlButton>
              )}
              {stored?.present && (
                <ControlButton
                  data-testid="api-key-remove-open"
                  size="row"
                  isDisabled={busy || !csrf}
                  variant="quiet"
                  onPress={() => setConfirm(provider)}
                >
                  Poista avain…
                </ControlButton>
              )}
            </div>
            {editing === provider && (
              <form
                className="s-editor"
                onSubmit={(e) => {
                  e.preventDefault();
                  void change(provider);
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
                  Avain lähetetään kerran eikä sitä palauteta. Palvelun
                  ensimmäinen avain vaihtaa uusien keskustelujen oletukseksi sen
                  mallin; avoimet keskustelut eivät muutu.
                </p>
                <div className="s-actions">
                  <ControlButton
                    data-testid="cancel"
                    size="row"
                    onPress={() => {
                      setKey("");
                      setEditing(undefined);
                    }}
                  >
                    Peruuta
                  </ControlButton>
                  <ControlButton
                    data-testid="api-key-save"
                    size="row"
                    type="submit"
                    isDisabled={busy || !keyFits(provider, key)}
                  >
                    Tallenna avain
                  </ControlButton>
                </div>
              </form>
            )}
          </div>
        );
      })}
      {error && (
        <div className="s-row">
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
        </div>
      )}
      <ModalOverlay
        className="ah-overlay"
        isOpen={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(undefined);
        }}
        isDismissable
      >
        <Modal className="ah-modal">
          <Dialog className="ah-dialog" aria-label="Poistetaanko API-avain?">
            <Heading slot="title">Poistetaanko API-avain?</Heading>
            <p>
              Avain poistuu vain Pi:n tunnuksista tällä palvelimella. Avainta ei
              peruta palvelussa {confirm && names[confirm]}. Avainta käyttävät
              keskustelut eivät voi jatkaa ennen uuden avaimen lisäämistä.
              Tilauskirjautumiset säilyvät.
            </p>
            <div className="ah-dialog-actions">
              <ControlButton
                data-testid="cancel"
                size="row"
                onPress={() => setConfirm(undefined)}
              >
                Peruuta
              </ControlButton>
              <ControlButton
                data-testid="api-key-remove-confirm"
                size="row"
                variant="danger-subtle"
                onPress={() => {
                  if (confirm) void change(confirm, true);
                }}
              >
                Poista avain
              </ControlButton>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}
