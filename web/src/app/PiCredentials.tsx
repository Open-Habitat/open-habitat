import { useEffect, useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import schema from "../../../contracts/v1/pi-credentials.schema.json";
import { ControlButton } from "../components/ControlElements";
import { Icon } from "../components/Icon";
import { LetterMark } from "../components/Integrations";
import { type ModelChoice, refused } from "../components/ModelPicker";
import { modelDisplayName } from "../components/modelPresentation";
import { Badge, StatusMark } from "../components/Status";
import { formatDate, liveText } from "../i18n";
import { piCredentialsText } from "../text/piCredentials";
import { LazyAjv } from "./lazyAjv";
import { mutationFetch } from "./mutations";
import { readSiteOnboarding, type SiteOnboarding } from "./onboardingConfig";
import { usePiModels } from "./PiModels";

const txt = liveText(piCredentialsText);

const valid = new LazyAjv({ strict: false }).compile(schema);
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
  return Number.isNaN(d.getTime())
    ? ""
    : formatDate(d, { day: "numeric", month: "numeric" });
};
/** The letter tiles of round 2 of proto-integration-grouping; the
 * subscriptions' tiles (Ch, Cl) are in Account. */
const marks: Record<KeyProvider, [string, 1 | 2 | 3]> = {
  openai: ["OA", 1],
  anthropic: ["An", 2],
  deepseek: ["DS", 3],
};
const keyHint = (provider: KeyProvider) =>
  txt.startsWith(provider === "anthropic" ? "sk-ant-" : "sk-");
/** OpenAI's own credential in Pi, never another provider's (subscription is
 * Pi's openai-codex sign-in). */
export type OpenAIState =
  | "signed_in"
  | "api_key"
  | "missing"
  | "checking"
  | "unknown";
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
  onOpenAI,
  providers = keyProviders,
  embedded = false,
}: {
  csrf?: string;
  onSaved?: () => void;
  /** The same native read, as the settings' OpenAI sign-in row needs it. */
  onOpenAI?: (state: OpenAIState) => void;
  /** Inside the onboarding AI step's key row, which owns the heading: one
   * field with Tallenna on the same line. Settings keeps its rows. */
  embedded?: boolean;
  /** The key rows to show; one native read serves them all. */
  providers?: KeyProvider[];
}) {
  const [data, setData] = useState<Credentials>();
  const [key, setKey] = useState("");
  // The add/replace dialog: null while it asks which provider.
  const [adding, setAdding] = useState<KeyProvider | null>();
  const { data: catalog } = usePiModels();
  const models = catalog?.models ?? [];
  const defaultProvider = catalog?.default_provider;
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
    setAdding(undefined);
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
        if (!controller.signal.aborted) setError(txt.readFailed);
      });
    return () => controller.abort();
  }, [revision]);
  const openAI: OpenAIState = data
    ? data.subscription.present
      ? "signed_in"
      : data.openai.present
        ? "api_key"
        : "missing"
    : error
      ? "unknown"
      : "checking";
  useEffect(() => onOpenAI?.(openAI), [openAI, onOpenAI]);
  const change = async (provider: KeyProvider, remove = false) => {
    if (!csrf || busy) return;
    setBusy(true);
    setError("");
    setConfirm(undefined);
    const body = remove ? undefined : JSON.stringify({ provider, key });
    setKey("");
    setAdding(undefined);
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
      setError(txt.uncertain);
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
                    label={txt.stored(
                      names[provider],
                      stored.suffix ?? undefined,
                    )}
                  />
                ) : null}
              </div>
              <label className="ah-key-embedded-field">
                <strong>
                  {txt.apiKey(names[provider], !!stored?.present)}
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
                    {txt.save}
                  </ControlButton>
                </span>
              </label>
              <p className="ah-sign-in-hint">
                {wrong ? (
                  <span role="alert">
                    {txt.notThisKey(names[provider], keyHint(provider))}
                  </span>
                ) : (
                  txt.ownOnly(names[provider])
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
                    {txt.checkCredentials}
                  </ControlButton>
                </div>
              )}
            </form>
          );
        })}
      </>
    );
  const present = data
    ? keyProviders.filter((p) => providers.includes(p) && data[p].present)
    : [];
  const missing = data
    ? keyProviders.filter((p) => providers.includes(p) && !data[p].present)
    : [];
  const siteOf = (provider: KeyProvider) => {
    const stored = data?.[provider];
    return given?.provider === provider &&
      stored?.present &&
      stored.suffix === given.suffix
      ? given
      : undefined;
  };
  const keyText = (provider: KeyProvider) => {
    const stored = data?.[provider];
    return stored?.suffix
      ? `${provider === "anthropic" ? "sk-ant-" : "sk-"}…${stored.suffix}`
      : txt.notLiteral;
  };
  const close = () => {
    setKey("");
    setAdding(undefined);
  };
  const chosen = adding ?? undefined;
  const wrong = !!chosen && key !== "" && !keyFits(chosen, key);
  return (
    <section
      className="s-keys"
      data-settings-row="api-keys"
      tabIndex={-1}
      aria-labelledby="api-keys-heading"
    >
      <h3 className="s-h3" id="api-keys-heading">
        {txt.apiKeys}
        {present.length ? (
          <span className="s-count">{present.length}</span>
        ) : null}
      </h3>
      <div className="s-card">
        {present.map((provider) => {
          const site = siteOf(provider);
          const offered = models.filter(
            (m) => m.provider === provider && !m.older,
          );
          // Pi refused every model of this key on its latest attempt: the
          // provider no longer takes the key, whatever the reason.
          const refusedAll =
            offered.length > 0 && offered.every((m) => refused(m));
          return (
            <div
              className="s-row s-marked"
              key={provider}
              data-testid={`api-key-row-${provider}`}
              data-site={
                site ? (site.current ? "current" : "earlier") : undefined
              }
            >
              <LetterMark mark={marks[provider][0]} tone={marks[provider][1]} />
              <div className="s-lbl">
                <strong className="s-key-name">
                  {names[provider]}{" "}
                  <code data-testid="api-key-suffix">{keyText(provider)}</code>{" "}
                  {site ? (
                    <StatusMark
                      data-testid="api-key-site"
                      kind="pill"
                      tone={site.current ? "info" : "warning"}
                      label={txt.fromAdmin}
                    />
                  ) : (
                    <Badge label={txt.own} />
                  )}
                </strong>
                <span
                  className={`s-desc${refusedAll ? " s-bad" : ""}`}
                  data-testid="api-key-desc"
                >
                  {refusedAll ? txt.refusedAll(names[provider]) : null}
                  {site
                    ? site.current
                      ? txt.givenCurrent(givenDay(site.at))
                      : txt.givenEarlier(givenDay(site.at))
                    : txt.ownKey(names[provider])}
                </span>
              </div>
              <div
                className="s-val"
                data-testid="api-key-state"
                data-present="true"
              >
                {refusedAll ? (
                  <StatusMark
                    tone="danger"
                    kind="error"
                    label={txt.notAnswering}
                  />
                ) : null}
                <ControlButton
                  size="row"
                  variant={refusedAll ? "primary" : "secondary"}
                  isDisabled={busy || !csrf}
                  onPress={() => {
                    setKey("");
                    setAdding(provider);
                  }}
                  data-testid="api-key-add"
                >
                  {site ? txt.changeToOwn : txt.change}
                </ControlButton>
                <ControlButton
                  data-testid="api-key-remove-open"
                  size="row"
                  isDisabled={busy || !csrf}
                  variant="quiet"
                  onPress={() => setConfirm(provider)}
                >
                  {txt.remove}
                </ControlButton>
              </div>
              {offered.length ? (
                <div className="s-key-models">
                  <span className="s-desc">{txt.opens}</span>
                  <ModelChips models={offered} />
                </div>
              ) : null}
            </div>
          );
        })}
        <div className="s-row s-key-add">
          <p className="s-desc" data-testid="api-key-missing">
            {!data
              ? error
                ? ""
                : txt.checking
              : present.length
                ? missing.length
                  ? txt.missing(missing.map((p) => names[p]).join(", "))
                  : txt.allHave
                : txt.none}
          </p>
          <div className="s-val">
            <ControlButton
              data-testid="api-key-add-open"
              size="row"
              isDisabled={busy || !csrf || !data || !missing.length}
              onPress={() => {
                setKey("");
                setAdding(missing.length === 1 ? missing[0] : null);
              }}
            >
              <Icon name="plus" />
              {txt.add}
            </ControlButton>
          </div>
        </div>
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
                {txt.checkCredentials}
              </ControlButton>
            </div>
          </div>
        )}
      </div>
      <ModalOverlay
        className="ah-overlay"
        isOpen={adding !== undefined}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        isDismissable
      >
        <Modal className="ah-modal s-key-dialog">
          <Dialog
            className="ah-dialog"
            data-testid="api-key-dialog"
            aria-label={
              chosen && data?.[chosen].present
                ? txt.replaceTitle(names[chosen])
                : txt.add
            }
          >
            <Heading slot="title">
              {chosen && data?.[chosen].present
                ? txt.replaceTitle(names[chosen])
                : txt.add}
            </Heading>
            <p className="s-desc">{txt.dialogIntro}</p>
            <fieldset className="s-prov-opts">
              <legend className="ah-visually-hidden">{txt.provider}</legend>
              {providers.map((provider) => {
                const stored = data?.[provider];
                const count = models.filter(
                  (m) => m.provider === provider && !m.older,
                ).length;
                return (
                  <button
                    type="button"
                    key={provider}
                    className="s-prov-opt"
                    data-testid={`api-key-provider-${provider}`}
                    aria-pressed={chosen === provider}
                    onClick={() => {
                      setKey("");
                      setAdding(provider);
                    }}
                  >
                    <LetterMark
                      mark={marks[provider][0]}
                      tone={marks[provider][1]}
                    />
                    <span className="s-lbl">
                      <strong>{names[provider]}</strong>
                      <span className="s-desc">
                        {stored?.present
                          ? siteOf(provider)
                            ? txt.replacesAdmin(keyText(provider))
                            : txt.replaces(keyText(provider))
                          : count
                            ? txt.models(count)
                            : txt.noKey}
                      </span>
                    </span>
                  </button>
                );
              })}
            </fieldset>
            {chosen ? (
              <form
                className="s-editor"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (keyFits(chosen, key)) void change(chosen);
                }}
              >
                <label className="s-field">
                  {txt.apiKey(names[chosen], false)}
                  <input
                    data-testid="api-key-input"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={key}
                    maxLength={203}
                    placeholder={chosen === "anthropic" ? "sk-ant-…" : "sk-…"}
                    aria-invalid={wrong || undefined}
                    onChange={(e) => setKey(e.target.value)}
                  />
                </label>
                <p className={`s-desc${wrong ? " s-bad" : ""}`}>
                  {wrong ? (
                    <span role="alert">
                      {txt.notThisKey(names[chosen], keyHint(chosen))}
                    </span>
                  ) : data?.[chosen].present ? (
                    siteOf(chosen) ? (
                      txt.ownReplacesAdmin
                    ) : (
                      txt.newReplaces(keyText(chosen))
                    )
                  ) : (
                    txt.firstKey
                  )}
                </p>
                <div className="ah-dialog-actions">
                  <ControlButton
                    data-testid="cancel"
                    size="row"
                    onPress={close}
                  >
                    {txt.cancel}
                  </ControlButton>
                  <ControlButton
                    data-testid="api-key-save"
                    size="row"
                    variant="primary"
                    type="submit"
                    isDisabled={busy || !csrf || !keyFits(chosen, key)}
                  >
                    {txt.saveKey}
                  </ControlButton>
                </div>
              </form>
            ) : (
              <div className="ah-dialog-actions">
                <ControlButton data-testid="cancel" size="row" onPress={close}>
                  {txt.cancel}
                </ControlButton>
              </div>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
      <ModalOverlay
        className="ah-overlay"
        isOpen={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(undefined);
        }}
        isDismissable
      >
        <Modal className="ah-modal">
          <Dialog className="ah-dialog" aria-label={txt.removeQuestion}>
            <Heading slot="title">{txt.removeQuestion}</Heading>
            <p>
              {txt.removeEffect(
                confirm ? names[confirm] : "",
                !!confirm && defaultProvider === confirm,
              )}
            </p>
            <div className="ah-dialog-actions">
              <ControlButton
                data-testid="cancel"
                size="row"
                onPress={() => setConfirm(undefined)}
              >
                {txt.cancel}
              </ControlButton>
              <ControlButton
                data-testid="api-key-remove-confirm"
                size="row"
                variant="danger-subtle"
                onPress={() => {
                  if (confirm) void change(confirm, true);
                }}
              >
                {txt.removeKey}
              </ControlButton>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </section>
  );
}

/** The models a key or subscription opens, as Pi's catalog lists them; one
 * Pi refused on its latest attempt is struck through. */
export function ModelChips({ models }: { models: ModelChoice[] }) {
  return (
    <ul className="s-model-chips">
      {models.map((m) => (
        <li key={m.id} data-refused={refused(m) || undefined}>
          {modelDisplayName(`${m.provider ?? "openai-codex"}/${m.id}`, [m])}
        </li>
      ))}
    </ul>
  );
}

/** "3 mallia: A, B, C." for a subscription row; empty while unknown. */
export function modelsLine(
  models: ModelChoice[] | undefined,
  provider: NonNullable<ModelChoice["provider"]>,
) {
  const offered = (models ?? []).filter(
    (m) => (m.provider ?? "openai-codex") === provider && !m.older,
  );
  return offered.length
    ? txt.modelsLine(
        offered.length,
        offered
          .map((m) => modelDisplayName(`${provider}/${m.id}`, [m]))
          .join(", "),
      )
    : "";
}
