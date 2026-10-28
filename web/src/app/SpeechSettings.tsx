import { type ReactNode, useCallback, useEffect, useState } from "react";
import { ControlButton, Segmented } from "../components/ControlElements";
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
  sonioxKeyShape,
} from "./speech";

const regionNames: Record<SpeechRegion, string> = { eu: "EU", us: "USA" };

/** A Soniox key and its region, sent once and never shown again. */
function SpeechKeyForm({
  busy,
  onSave,
  onCancel,
  note,
}: {
  busy: boolean;
  onSave: (key: string, region: SpeechRegion) => void;
  onCancel?: () => void;
  note: string;
}) {
  const [key, setKey] = useState("");
  const [region, setRegion] = useState<SpeechRegion>("eu");
  const wrong = key.length > 0 && !sonioxKeyShape.test(key.trim());
  return (
    <form
      className="s-editor"
      data-testid="speech-key-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (sonioxKeyShape.test(key.trim())) onSave(key.trim(), region);
      }}
    >
      <div className="s-row">
        <div className="s-lbl">
          <strong>Alue</strong>
          <span className="s-desc">Sama kuin Soniox-projektissa.</span>
        </div>
        <div className="s-val">
          <Segmented
            data-testid="speech-region"
            label="Alue"
            options={[
              { id: "eu", label: regionNames.eu },
              { id: "us", label: regionNames.us },
            ]}
            value={region}
            onChange={setRegion}
          />
        </div>
      </div>
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
          isDisabled={busy || !sonioxKeyShape.test(key.trim())}
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
  const write = async (run: () => Promise<SpeechKeyState>) => {
    setBusy(true);
    setFailed(false);
    try {
      setState(await run());
      setEditing(false);
    } catch {
      // The write may or may not have happened: read the home again.
      setFailed(true);
      load();
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
        <div className="s-row s-marked" data-testid="speech-key-state">
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
              onSave={(key, region) =>
                void write(() => saveSpeechKey(csrf, key, region))
              }
              onCancel={editing ? () => setEditing(false) : undefined}
              note="Tallennettua avainta ei näytetä uudelleen."
            />
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
  const write = async (run: () => Promise<SiteSpeechKey>) => {
    setBusy(true);
    setProblem("");
    try {
      setState(await run());
      setEditing(false);
    } catch {
      setProblem("Muutoksen tulos ei varmistunut. Tila luettiin uudelleen.");
      load();
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
        <div className="s-row s-marked" data-testid="site-speech-key">
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
              onSave={(k, region) =>
                void write(() => setSiteSpeechKey(csrf, k, region))
              }
              onCancel={editing ? () => setEditing(false) : undefined}
              note="Tallennettua avainta ei näytetä uudelleen."
            />
          ) : null}
          {busy ? (
            <p role="status" className="s-editor s-desc">
              Annetaan avainta jo liittyneille…
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
            <p role="alert" className="s-editor s-desc s-bad">
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
