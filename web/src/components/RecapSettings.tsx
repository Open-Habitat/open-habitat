import type { ReactNode } from "react";
import { Segmented } from "./ControlElements";
import { formatNumber, NumberStepper } from "./NumberStepper";
import { RecapCard } from "./RecapCard";
import { ScaleSlider } from "./ScaleSlider";
import "./Settings.css";

/** The person's recap settings as the contract carries them
 * (contracts/v1/recap-settings.schema.json). */
export type RecapSettingsValue = {
  level: RecapLevel;
  delay_seconds: number;
  model: string | null;
  words: number;
  next_words: number;
  messages: number;
  history_tokens: number;
  message_tokens: number;
  response_tokens: number;
  first_after_turns: number;
};
export type RecapLevel = "short" | "standard" | "thorough" | "custom";
type Numbers = Omit<RecapSettingsValue, "level" | "delay_seconds" | "model">;
type NumberKey = keyof Numbers;

/** The levels are the browser's names for sets of numbers; the host stores
 * the numbers. Tavallinen is the recap as it was before it had settings. */
export const recapLevels: Record<Exclude<RecapLevel, "custom">, Numbers> = {
  short: {
    words: 25,
    next_words: 10,
    messages: 16,
    history_tokens: 4000,
    message_tokens: 500,
    response_tokens: 256,
    first_after_turns: 2,
  },
  standard: {
    words: 40,
    next_words: 12,
    messages: 64,
    history_tokens: 16000,
    message_tokens: 1000,
    response_tokens: 512,
    first_after_turns: 1,
  },
  thorough: {
    words: 70,
    next_words: 16,
    messages: 128,
    history_tokens: 32000,
    message_tokens: 2000,
    response_tokens: 768,
    first_after_turns: 1,
  },
};
const levelNames: Record<RecapLevel, string> = {
  short: "Lyhyt",
  standard: "Tavallinen",
  thorough: "Perusteellinen",
  custom: "Oma",
};
const levelNotes: Record<RecapLevel, string> = {
  short: "Muutama virke tuoreimmista viesteistä.",
  standard: "Nykyinen katsaus.",
  thorough: "Pidempi katsaus, joka lukee enemmän historiaa.",
  custom: "Omat luvut. Muuttamalla lukua lähdet valmiista tasosta.",
};

/** The level whose numbers these are. A stored level whose numbers no longer
 * match it (an older release's level, a hand edit) is Oma. */
export function recapLevel(value: RecapSettingsValue): RecapLevel {
  if (value.level === "custom") return "custom";
  const level = recapLevels[value.level];
  return (Object.keys(level) as NumberKey[]).every(
    (key) => level[key] === value[key],
  )
    ? value.level
    : "custom";
}

/** The delay's stops, from the browser's presence cadence to an hour
 * (recap_settings_linux.go). Each step is about a fifth longer than the last,
 * so a minute and a half is as easy to choose as seven minutes. A delay past
 * Pi's ten idle minutes is made on a Pi started for the recap (Jari
 * 30.10.2026: Pi's rest is no reason to cap it). */
export const recapDelayStops = [
  60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 420, 480, 540, 600, 720,
  900, 1200, 1500, 1800, 2400, 3600,
] as const;
export function formatDelay(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (!minutes) return `${rest} s`;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

type NumberRow = {
  key: NumberKey;
  row: string;
  label: string;
  note: string;
  min: number;
  max: number;
  step: number;
  unit: string;
};
// Bounds as the daemon checks them; the steps put every level on the grid.
const readRows: NumberRow[] = [
  {
    key: "messages",
    row: "recap-messages",
    label: "Luettavat viestit",
    note: "Viimeisimmät viestisi ja agentin vastaukset. Työkalujen tulosteita ei lueta.",
    min: 4,
    max: 128,
    step: 4,
    unit: "viestiä",
  },
  {
    key: "history_tokens",
    row: "recap-history",
    label: "Luettava historia enintään",
    note: "Vanhimmat viestit jäävät pois, kun raja tulee vastaan.",
    min: 2000,
    max: 32000,
    step: 1000,
    unit: "tokenia",
  },
  {
    key: "message_tokens",
    row: "recap-message",
    label: "Yhdestä viestistä enintään",
    note: "Pitkästä viestistä luetaan alku.",
    min: 250,
    max: 4000,
    step: 250,
    unit: "tokenia",
  },
  {
    key: "first_after_turns",
    row: "recap-turns",
    label: "Ensimmäinen katsaus aikaisintaan",
    note: "Kun keskustelussa on näin monta kysymystä ja vastausta. Itse pyydetty katsaus tehdään heti.",
    min: 1,
    max: 10,
    step: 1,
    unit: "vuoroa",
  },
];
const writeRows: NumberRow[] = [
  {
    key: "words",
    row: "recap-words",
    label: "Katsauksen pituus",
    note: "Yksi tai muutama virke siitä, mitä tehtiin.",
    min: 10,
    max: 80,
    step: 5,
    unit: "sanaa",
  },
  {
    key: "next_words",
    row: "recap-next",
    label: "Seuraavaksi-rivi",
    note: "Yksi seuraava askel tai este.",
    min: 4,
    max: 25,
    step: 1,
    unit: "sanaa",
  },
  {
    key: "response_tokens",
    row: "recap-response",
    label: "Vastauksen yläraja",
    note: "Mallin vastaus katkaistaan tähän.",
    min: 128,
    max: 2048,
    step: 64,
    unit: "tokenia",
  },
];

/** A response limit below this can cut the recap's JSON short: about four
 * tokens a Finnish word, and the JSON around them. */
export const responseFloor = (value: RecapSettingsValue) =>
  (value.words + value.next_words) * 4 + 48;

// Synthetic preview text, cut to the chosen length.
const sample =
  "Varjon pituuden laskenta tukee nyt kesä- ja talviaikaa: auringon korkeus lasketaan paikallisesta ajasta UTC:n kautta, joten aikavyöhykkeen vaihto ei enää siirrä varjoa tunnilla. Kaikki 18 testiä menevät läpi, ja README:hen lisättiin esimerkki Helsingin talvipäivänseisauksesta. Laskennan tarkkuus tarkistettiin vielä kolmella leveysasteella, ja tulokset vastasivat taulukkoarvoja alle prosentin erolla. Seuraava vaihe on julkaisu, kun muutosloki on päivitetty ja versio nostettu.";
const sampleNext =
  "Julkaise versio 1.4, päivitä muutosloki ja ilmoita käyttäjille muutoksesta kesäajan käsittelyyn sekä uusista esimerkeistä.";
const cut = (text: string, words: number) => {
  const all = text.split(" ");
  return all.length > words ? `${all.slice(0, words).join(" ")}…` : text;
};

/** Tilannekatsaus settings (Tasot, Jari 29.10.2026): when the card comes,
 * with which model, and how much it reads and writes as one level or Oma.
 * Recaps are always automatic; the conversation header asks for one now. */
export function RecapSettings({
  value,
  loading,
  saving,
  failed,
  modelField,
  onChange,
}: {
  value?: RecapSettingsValue;
  loading?: boolean;
  saving?: boolean;
  /** The last change was not saved; the shown value is the stored one. */
  failed?: boolean;
  /** The Malli row: the shared model field and chooser. */
  modelField: ReactNode;
  onChange: (next: RecapSettingsValue) => void;
}) {
  const level = value ? recapLevel(value) : undefined;
  const change = (patch: Partial<RecapSettingsValue>) => {
    if (value) onChange({ ...value, ...patch });
  };
  const stepper = (r: NumberRow) =>
    value ? (
      <div
        className="s-row"
        key={r.key}
        data-settings-row={r.row}
        tabIndex={-1}
      >
        <div className="s-lbl">
          <strong>{r.label}</strong>
          <span className="s-desc">
            {r.key === "response_tokens" &&
            value.response_tokens < responseFloor(value) ? (
              <span className="s-bad" data-testid="recap-response-warning">
                Raja voi katkaista katsauksen kesken. Nosta se vähintään{" "}
                {responseFloor(value)} tokeniin.
              </span>
            ) : (
              r.note
            )}
          </span>
        </div>
        <NumberStepper
          testId={r.row}
          label={r.label}
          value={value[r.key]}
          min={r.min}
          max={r.max}
          step={r.step}
          unit={r.unit}
          disabled={loading}
          onChange={(n) => change({ [r.key]: n, level: "custom" })}
        />
      </div>
    ) : null;
  return (
    <div className="s-stack" data-testid="recap-settings">
      <p className="s-intro">
        Lyhyt katsaus keskustelun tilanteesta, kun palaat siihen. Se tallentuu
        keskustelun historiaan, mutta ei mene agentin muistiin.
      </p>
      {value ? (
        <div className="s-card ah-recap-preview">
          <span className="ah-recap-label">Esikatselu</span>
          <RecapCard
            recap={{
              recap: cut(sample, value.words),
              next: cut(sampleNext, value.next_words),
              through: "preview",
              generated_at: 0,
            }}
            pending={false}
            error={false}
            unavailable={false}
          />
        </div>
      ) : null}
      <div className="s-card ah-recap-timing">
        <div className="s-row" data-settings-row="recap-delay" tabIndex={-1}>
          <div className="s-lbl">
            <strong>Hiljaisuus ennen katsausta</strong>
            <span className="s-desc">
              Kortti tulee keskustelun yläpuolelle itsestään, kun keskustelu on
              ollut näin kauan hiljaa.
            </span>
          </div>
          {value ? (
            <ScaleSlider
              testId="recap-delay"
              label="Hiljaisuus ennen katsausta"
              value={value.delay_seconds}
              stops={recapDelayStops}
              ticks={[60, 180, 600, 3600]}
              format={formatDelay}
              tickFormat={(s) => String(s / 60)}
              disabled={loading}
              onChange={(delay_seconds) => change({ delay_seconds })}
            />
          ) : null}
        </div>
        {modelField}
      </div>
      <h3 className="s-h3">Laajuus</h3>
      <div className="s-card ah-recap-levels">
        <div className="s-row" data-settings-row="recap-level" tabIndex={-1}>
          <div className="s-lbl">
            <strong>Katsauksen laajuus</strong>
            <span className="s-desc">{level ? levelNotes[level] : null}</span>
          </div>
          {value && level ? (
            <Segmented
              data-testid="recap-level"
              className="ah-recap-level-choice"
              label="Katsauksen laajuus"
              options={(
                ["short", "standard", "thorough", "custom"] as const
              ).map((id) => ({ id, label: levelNames[id] }))}
              value={level}
              isDisabled={loading}
              onChange={(id) =>
                change(
                  id === "custom"
                    ? { level: "custom" }
                    : { level: id, ...recapLevels[id] },
                )
              }
            />
          ) : null}
        </div>
        {value ? (
          <div className="ah-recap-scope" data-testid="recap-level-table">
            <div>
              <span className="ah-recap-label">Lukee</span>
              <p>
                <strong>{value.messages}</strong> viimeisintä viestiä
              </p>
              <p>
                noin <strong>{formatNumber(value.history_tokens)}</strong>{" "}
                tokenia, viestistä enintään {formatNumber(value.message_tokens)}
              </p>
              <p>
                aikaisintaan <strong>{value.first_after_turns}.</strong> vuoron
                jälkeen
              </p>
            </div>
            <div>
              <span className="ah-recap-label">Kirjoittaa</span>
              <p>
                katsaus enintään <strong>{value.words}</strong> sanaa
              </p>
              <p>
                seuraavaksi enintään <strong>{value.next_words}</strong> sanaa
              </p>
              <p>
                vastaus enintään{" "}
                <strong>{formatNumber(value.response_tokens)}</strong> tokenia
              </p>
            </div>
          </div>
        ) : null}
        {level === "custom" ? [...readRows, ...writeRows].map(stepper) : null}
      </div>
      <p
        role="status"
        className="s-desc"
        data-testid="recap-settings-state"
        data-state={
          failed ? "failed" : saving ? "saving" : loading ? "loading" : "saved"
        }
      >
        {failed ? (
          <span className="s-bad">
            Muutosta ei tallennettu. Yritä uudelleen.
          </span>
        ) : saving ? (
          "Tallennetaan…"
        ) : loading ? (
          "Ladataan asetuksia…"
        ) : null}
      </p>
    </div>
  );
}
