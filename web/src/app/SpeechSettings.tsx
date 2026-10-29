import { type ReactNode, useCallback, useEffect, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { Icon } from "../components/Icon";
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

const regionNames: Record<SpeechRegion, string> = { eu: "EU", us: "USA" };

/** The region a save found, said once after it. */
const savedIn = (region: SpeechRegion | null | undefined) =>
  region
    ? `Avain tallennettu. Soniox hyväksyi sen ${regionNames[region]}-alueella.`
    : "";

/** Why a key was not saved, by the code its save answered. Nothing was
 * stored, so the form stays as it was. */
const refusals: Record<string, string> = {
  speech_key_rejected:
    "Soniox ei hyväksynyt avainta EU- eikä USA-alueella, joten sitä ei tallennettu. Tarkista avain ja sen oikeudet Soniox-konsolissa.",
  speech_unavailable:
    "Sonioxiin ei saatu yhteyttä, joten avainta ei voitu tarkistaa eikä sitä tallennettu. Yritä hetken päästä uudelleen.",
  speech_limit_reached:
    "Sonioxin raja tuli hetkeksi vastaan, joten avainta ei voitu tarkistaa eikä sitä tallennettu. Yritä hetken päästä uudelleen.",
};

const refusal = (error: unknown) =>
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
        Soniox API-avain
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
        {wrong ? (
          <span role="alert">Tämä ei näytä Soniox-avaimelta.</span>
        ) : (
          note
        )}
      </p>
      <div className="s-actions">
        {onCancel ? (
          <ControlButton
            data-testid="speech-key-cancel"
            size="row"
            variant="quiet"
            onPress={onCancel}
          >
            Peruuta
          </ControlButton>
        ) : null}
        <ControlButton
          data-testid="speech-key-save"
          size="row"
          variant="primary"
          type="submit"
          isDisabled={busy || !validSonioxKey(key.trim())}
        >
          Tallenna
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
        <summary>Oikeudet ja säilytys</summary>
        <ul>
          <li>
            Soniox-konsolissa avaimelle riittävät oikeudet Temporary API keys ja
            Speech-to-text, real-time.
          </li>
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
  const [refused, setRefused] = useState("");
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
    setRefused("");
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
  if (state === undefined) return <p role="status">Luetaan Soniox-avainta…</p>;
  if (state === "unavailable")
    return (
      <div className="s-card">
        <div
          className="s-row"
          role="alert"
          data-testid="speech-key-unavailable"
        >
          Soniox-avainta ei voitu lukea.
          <ControlButton size="row" onPress={() => load()}>
            Lataa uudelleen
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
            <strong>Soniox-avain</strong>
            <span
              className="s-desc"
              data-testid="speech-key-source"
              data-source={state.source ?? "none"}
            >
              {!state.present
                ? "Ei avainta. Sanelu tarvitsee sen."
                : site
                  ? `Ylläpitäjän avain …${state.suffix} (${regionNames[state.region ?? "eu"]}).`
                  : `Oma avain …${state.suffix} (${regionNames[state.region ?? "eu"]}).`}
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
                  {site ? "Lisää oma avain" : "Vaihda avain"}
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
                  Poista
                </ControlButton>
              </>
            ) : null}
          </div>
          {csrf && (!state.present || editing) ? (
            <SpeechKeyForm
              busy={busy}
              onSave={(key) => void write(() => saveSpeechKey(csrf, key), true)}
              onCancel={editing ? () => setEditing(false) : undefined}
              note="Tallennus tarkistaa avaimen Sonioxilta ja tunnistaa sen alueen. Tallennettua avainta ei näytetä uudelleen."
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
              Muutoksen tulos ei varmistunut. Tila luettiin uudelleen.
            </p>
          ) : null}
          <SpeechKeyMore>
            <li>
              Avain tallentuu tiedostoon <code>~/.config/soniox/key.json</code>,
              ja agenttisi voivat käyttää sitä.
            </li>
          </SpeechKeyMore>
        </div>
      </div>
    </div>
  );
}

const givenWords: Record<string, string> = {
  seeded: "sai avaimen",
  replaced: "sai uuden avaimen aiemman tilalle",
  already_current: "oli jo saanut sen",
  kept: "käyttää omaa avaintaan",
  not_reached: "ei tavoitettu",
  unknown: "tulos ei varmistunut",
};

/** Palvelimen ylläpito › Saneluavain: the site's Soniox key, which every
 * person's own daemon copies into their home unless they have their own. */
export function SpeechKeyAdministration({ csrf }: { csrf?: string }) {
  const [state, setState] = useState<SiteSpeechKey | "unavailable">();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState("");
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
    setProblem("");
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
        setProblem("Muutoksen tulos ei varmistunut. Tila luettiin uudelleen.");
        load();
      }
    } finally {
      setBusy(false);
    }
  };
  if (state === undefined) return <p role="status">Luetaan saneluavainta…</p>;
  if (state === "unavailable")
    return (
      <div className="s-card">
        <div className="s-row" role="alert">
          Saneluavainta ei voitu lukea.
          <ControlButton size="row" onPress={() => load()}>
            Lataa uudelleen
          </ControlButton>
        </div>
      </div>
    );
  const key = state.site_key;
  const given = Object.entries(state.given ?? {}).filter(([, n]) => n);
  const missed = !!(state.given?.not_reached || state.given?.unknown);
  return (
    <div className="s-stack">
      <p className="s-intro">
        Kaikki, joilla ei ole omaa avainta, sanelevat tällä. Käyttö laskutetaan
        sinulta.
      </p>
      <div className="s-card">
        <div
          className="s-row s-marked"
          data-testid="site-speech-key"
          data-settings-row="site-speech-key"
          tabIndex={-1}
        >
          <Icon name="mic" />
          <div className="s-lbl">
            <strong>Yhteinen Soniox-avain</strong>
            <span className="s-desc">
              {key
                ? `…${key.suffix} (${regionNames[key.region]}), otettu käyttöön ${new Date(key.set_at).toLocaleDateString("fi-FI")}.`
                : "Ei yhteistä avainta."}
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
                  Vaihda avain
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
                  Poista
                </ControlButton>
              </>
            ) : null}
          </div>
          {csrf && (!key || editing) ? (
            <SpeechKeyForm
              busy={busy}
              onSave={(k) => void write(() => setSiteSpeechKey(csrf, k), true)}
              onCancel={editing ? () => setEditing(false) : undefined}
              note="Tallennus tarkistaa avaimen Sonioxilta ja tunnistaa sen alueen. Tallennettua avainta ei näytetä uudelleen."
            />
          ) : null}
          {busy ? (
            <p role="status" className="s-editor s-desc">
              Tarkistetaan avainta ja annetaan sitä jo liittyneille…
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
              .
              {missed
                ? " Tavoittamattomat saavat avaimen, kun tallennat sen uudelleen."
                : ""}
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
            <li>
              Jokainen saa avaimesta kopion kotihakemistoonsa, ja hänen
              agenttinsa voivat käyttää sitä. Kopiota ei voi perua kuin
              vaihtamalla avain Soniox-konsolissa.
            </li>
            <li>
              Jo liittyneet saavat avaimen heti, uudet ensimmäisellä
              kirjautumisellaan.
            </li>
            <li>Kaikki jakavat avaimen samanaikaisten sanelujen rajan.</li>
          </SpeechKeyMore>
        </div>
      </div>
    </div>
  );
}
