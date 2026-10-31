import { type ReactNode, useCallback, useEffect, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { Icon } from "../components/Icon";
import { formatDate, liveText } from "../i18n";
import { speechSettingsText } from "../text/speechSettings";
import {
  deleteSiteSpeechKey,
  readSiteSpeechKey,
  readSpeechKey,
  removeSpeechKey,
  type SiteSpeechKey,
  type SpeechKeyState,
  type SpeechRegion,
  saveSpeechKey,
  setSiteSpeechKey,
  validSonioxKey,
} from "./speech";

const txt = liveText(speechSettingsText);

const regionNames: Record<SpeechRegion, string> = { eu: "EU", us: "USA" };

/** The region a save found, said once after it. The EU is the default
 * here, so a US key says it was found elsewhere. */
const savedIn = (region: SpeechRegion | null | undefined) =>
  region === "eu" ? txt.savedEu : region === "us" ? txt.savedUs : "";

const sonioxConsole = () => (
  <a
    href="https://console.soniox.com"
    target="_blank"
    rel="noopener noreferrer"
    referrerPolicy="no-referrer"
  >
    {txt.fromConsole}
  </a>
);

/** Why a key was not saved, by the code its save answered. Nothing was
 * stored, so the form stays as it was. */
const refusals = new Proxy({} as Record<string, ReactNode>, {
  get: (_target, code: string) =>
    code === "speech_key_rejected"
      ? txt.rejected(sonioxConsole())
      : code === "speech_unavailable"
        ? txt.unavailable
        : code === "speech_limit_reached"
          ? txt.limit
          : undefined,
});

const refusal = (error: unknown): ReactNode =>
  error instanceof Error ? refusals[error.message] : undefined;

/** A Soniox key, sent once and never shown again. Its region is not asked:
 * a key works only in its Soniox project's region, which the save finds. */
function SpeechKeyForm({
  busy,
  onSave,
  onCancel,
  note,
}: {
  busy: boolean;
  onSave: (key: string) => void;
  onCancel?: () => void;
  note: string;
}) {
  const [key, setKey] = useState("");
  const wrong = key.length > 0 && !validSonioxKey(key.trim());
  return (
    <form
      className="s-editor"
      data-testid="speech-key-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (validSonioxKey(key.trim())) onSave(key.trim());
      }}
    >
      <label className="s-field">
        {txt.apiKey}
        <input
          data-testid="speech-key-input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          maxLength={256}
          value={key}
          aria-invalid={wrong || undefined}
          onChange={(event) => setKey(event.target.value)}
        />
      </label>
      <p className={`s-desc${wrong ? " s-bad" : ""}`}>
        {wrong ? <span role="alert">{txt.notKey}</span> : note}
      </p>
      <div className="s-actions">
        {onCancel ? (
          <ControlButton
            data-testid="speech-key-cancel"
            size="row"
            variant="quiet"
            onPress={onCancel}
          >
            {txt.cancel}
          </ControlButton>
        ) : null}
        <ControlButton
          data-testid="speech-key-save"
          size="row"
          variant="primary"
          type="submit"
          isDisabled={busy || !validSonioxKey(key.trim())}
        >
          {txt.save}
        </ControlButton>
      </div>
    </form>
  );
}

/** What is needed only now and then, folded under the key row. */
function SpeechKeyMore({ children }: { children: ReactNode }) {
  return (
    <div className="s-editor">
      <details className="s-more" data-testid="speech-key-more">
        <summary>{txt.more}</summary>
        <ul>
          <li>{txt.permissions}</li>
          {children}
        </ul>
      </details>
    </div>
  );
}

/** Asetukset › Sanelu: the person's own Soniox key, which their daemon
 * keeps in their home and uses to start each dictation. */
export function SpeechSettings({ csrf }: { csrf?: string }) {
  const [state, setState] = useState<SpeechKeyState | "unavailable">();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refused, setRefused] = useState<ReactNode>(null);
  const [saved, setSaved] = useState("");
  const load = useCallback((signal?: AbortSignal) => {
    readSpeechKey(signal)
      .then((s) => {
        if (!signal?.aborted) setState(s);
      })
      .catch(() => {
        if (!signal?.aborted) setState("unavailable");
      });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const write = async (run: () => Promise<SpeechKeyState>, save = false) => {
    setBusy(true);
    setFailed(false);
    setRefused(null);
    setSaved("");
    try {
      const next = await run();
      setState(next);
      setEditing(false);
      if (save) setSaved(savedIn(next.region));
    } catch (error) {
      const why = refusal(error);
      if (why) setRefused(why);
      else {
        // The write may or may not have happened: read the home again.
        setFailed(true);
        load();
      }
    } finally {
      setBusy(false);
    }
  };
  if (state === undefined) return <p role="status">{txt.reading}</p>;
  if (state === "unavailable")
    return (
      <div className="s-card">
        <div
          className="s-row"
          role="alert"
          data-testid="speech-key-unavailable"
        >
          {txt.readFailed}
          <ControlButton size="row" onPress={() => load()}>
            {txt.reload}
          </ControlButton>
        </div>
      </div>
    );
  const site = state.source === "site";
  return (
    <div className="s-stack">
      <div className="s-card">
        <div
          className="s-row s-marked"
          data-testid="speech-key-state"
          data-settings-row="speech-key"
          tabIndex={-1}
        >
          <Icon name="mic" />
          <div className="s-lbl">
            <strong>{txt.key}</strong>
            <span
              className="s-desc"
              data-testid="speech-key-source"
              data-source={state.source ?? "none"}
            >
              {!state.present
                ? txt.none
                : site
                  ? txt.admins(
                      state.suffix ?? "",
                      regionNames[state.region ?? "eu"],
                    )
                  : txt.own(
                      state.suffix ?? "",
                      regionNames[state.region ?? "eu"],
                    )}
            </span>
          </div>
          <div className="s-val">
            {state.present && !editing ? (
              <>
                <ControlButton
                  data-testid="speech-key-replace"
                  size="row"
                  isDisabled={!csrf || busy}
                  onPress={() => setEditing(true)}
                >
                  {site ? txt.addOwn : txt.replace}
                </ControlButton>
                <ControlButton
                  data-testid="speech-key-remove"
                  size="row"
                  variant="quiet"
                  isDisabled={!csrf || busy}
                  onPress={() =>
                    csrf && void write(() => removeSpeechKey(csrf))
                  }
                >
                  {txt.remove}
                </ControlButton>
              </>
            ) : null}
          </div>
          {csrf && (!state.present || editing) ? (
            <SpeechKeyForm
              busy={busy}
              onSave={(key) => void write(() => saveSpeechKey(csrf, key), true)}
              onCancel={editing ? () => setEditing(false) : undefined}
              note={txt.saveNote}
            />
          ) : null}
          {saved ? (
            <p
              className="s-editor s-desc"
              role="status"
              data-testid="speech-key-saved"
            >
              {saved}
            </p>
          ) : null}
          {refused ? (
            <p
              className="s-editor s-desc s-bad"
              role="alert"
              data-testid="speech-key-refused"
            >
              {refused}
            </p>
          ) : null}
          {failed ? (
            <p
              className="s-editor s-desc s-bad"
              role="alert"
              data-testid="speech-key-failed"
            >
              {txt.uncertain}
            </p>
          ) : null}
          <SpeechKeyMore>
            <li>{txt.stored(<code>~/.config/soniox/key.json</code>)}</li>
          </SpeechKeyMore>
        </div>
      </div>
    </div>
  );
}

const givenWords = new Proxy({} as Record<string, string>, {
  get: (_target, word: string) => txt.given[word],
});

/** Palvelimen ylläpito › Saneluavain: the site's Soniox key, which every
 * person's own daemon copies into their home unless they have their own. */
export function SpeechKeyAdministration({ csrf }: { csrf?: string }) {
  const [state, setState] = useState<SiteSpeechKey | "unavailable">();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState<ReactNode>(null);
  const [saved, setSaved] = useState("");
  const load = useCallback((signal?: AbortSignal) => {
    readSiteSpeechKey(signal)
      .then((s) => {
        if (!signal?.aborted) setState(s);
      })
      .catch(() => {
        if (!signal?.aborted) setState("unavailable");
      });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const write = async (run: () => Promise<SiteSpeechKey>, save = false) => {
    setBusy(true);
    setProblem(null);
    setSaved("");
    try {
      const next = await run();
      setState(next);
      setEditing(false);
      if (save) setSaved(savedIn(next.site_key?.region));
    } catch (error) {
      const why = refusal(error);
      if (why) setProblem(why);
      else {
        setProblem(txt.uncertain);
        load();
      }
    } finally {
      setBusy(false);
    }
  };
  if (state === undefined) return <p role="status">{txt.siteReading}</p>;
  if (state === "unavailable")
    return (
      <div className="s-card">
        <div className="s-row" role="alert">
          {txt.siteReadFailed}
          <ControlButton size="row" onPress={() => load()}>
            {txt.reload}
          </ControlButton>
        </div>
      </div>
    );
  const key = state.site_key;
  const given = Object.entries(state.given ?? {}).filter(([, n]) => n);
  const missed = !!(state.given?.not_reached || state.given?.unknown);
  return (
    <div className="s-stack">
      <p className="s-intro">{txt.siteIntro}</p>
      <div className="s-card">
        <div
          className="s-row s-marked"
          data-testid="site-speech-key"
          data-settings-row="site-speech-key"
          tabIndex={-1}
        >
          <Icon name="mic" />
          <div className="s-lbl">
            <strong>{txt.siteKey}</strong>
            <span className="s-desc">
              {key
                ? txt.siteKeyState(
                    key.suffix,
                    regionNames[key.region],
                    formatDate(new Date(key.set_at), {
                      day: "numeric",
                      month: "numeric",
                      year: "numeric",
                    }),
                  )
                : txt.siteNone}
            </span>
          </div>
          <div className="s-val">
            {key && !editing ? (
              <>
                <ControlButton
                  data-testid="site-speech-key-replace"
                  size="row"
                  isDisabled={!csrf || busy}
                  onPress={() => setEditing(true)}
                >
                  {txt.replace}
                </ControlButton>
                <ControlButton
                  data-testid="site-speech-key-remove"
                  size="row"
                  variant="quiet"
                  isDisabled={!csrf || busy}
                  onPress={() =>
                    csrf && void write(() => deleteSiteSpeechKey(csrf))
                  }
                >
                  {txt.remove}
                </ControlButton>
              </>
            ) : null}
          </div>
          {csrf && (!key || editing) ? (
            <SpeechKeyForm
              busy={busy}
              onSave={(k) => void write(() => setSiteSpeechKey(csrf, k), true)}
              onCancel={editing ? () => setEditing(false) : undefined}
              note={txt.saveNote}
            />
          ) : null}
          {busy ? (
            <p role="status" className="s-editor s-desc">
              {txt.giving}
            </p>
          ) : null}
          {saved ? (
            <p
              role="status"
              className="s-editor s-desc"
              data-testid="site-speech-key-saved"
            >
              {saved}
            </p>
          ) : null}
          {given.length ? (
            <p
              role="status"
              className="s-editor s-desc"
              data-testid="site-speech-given"
            >
              {given
                .map(([word, n]) => `${n} ${givenWords[word] ?? word}`)
                .join(", ")}
              .{missed ? txt.missed : ""}
            </p>
          ) : null}
          {problem ? (
            <p
              role="alert"
              className="s-editor s-desc s-bad"
              data-testid="site-speech-key-problem"
            >
              {problem}
            </p>
          ) : null}
          <SpeechKeyMore>
            <li>{txt.siteCopy}</li>
            <li>{txt.siteJoined}</li>
            <li>{txt.siteLimit}</li>
          </SpeechKeyMore>
        </div>
      </div>
    </div>
  );
}
