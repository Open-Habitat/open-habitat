import type { ReactNode } from "react";
import { ChoiceMenu } from "./ChoiceMenu";
import { Segmented } from "./ControlElements";
import { formatNumber, NumberStepper } from "./NumberStepper";
import { RecapCard } from "./RecapCard";
import { ScaleSlider } from "./ScaleSlider";
import "./Settings.css";
import { liveText } from "../i18n";
import { recapSettingsText } from "../text/recapSettings";

const txt = liveText(recapSettingsText);

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
export type RecapLevel = "short" | "standard" | "thorough" | "custom" | "off";
type Numbers = Omit<RecapSettingsValue, "level" | "delay_seconds" | "model">;
type NumberKey = keyof Numbers;

/** The levels are the browser's names for sets of numbers; the host stores
 * the numbers. Tavallinen is the recap as it was before it had settings. */
export const recapLevels: Record<
  Exclude<RecapLevel, "custom" | "off">,
  Numbers
> = {
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
const levelNames = new Proxy({} as Record<RecapLevel, string>, {
  get: (_target, level: RecapLevel) => txt.levels[level],
});
const levelNotes = new Proxy({} as Record<RecapLevel, string>, {
  get: (_target, level: RecapLevel) => txt.levelNotes[level],
});

/** The level whose numbers these are. A stored level whose numbers no longer
 * match it (an older release's level, a hand edit) is Oma. */
export function recapLevel(value: RecapSettingsValue): RecapLevel {
  if (value.level === "custom" || value.level === "off") return value.level;
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
    get label() {
      return txt.rows.messages.label;
    },
    get note() {
      return txt.rows.messages.note;
    },
    min: 4,
    max: 128,
    step: 4,
    get unit() {
      return txt.rows.messages.unit;
    },
  },
  {
    key: "history_tokens",
    row: "recap-history",
    get label() {
      return txt.rows.history_tokens.label;
    },
    get note() {
      return txt.rows.history_tokens.note;
    },
    min: 2000,
    max: 32000,
    step: 1000,
    get unit() {
      return txt.rows.history_tokens.unit;
    },
  },
  {
    key: "message_tokens",
    row: "recap-message",
    get label() {
      return txt.rows.message_tokens.label;
    },
    get note() {
      return txt.rows.message_tokens.note;
    },
    min: 250,
    max: 4000,
    step: 250,
    get unit() {
      return txt.rows.message_tokens.unit;
    },
  },
  {
    key: "first_after_turns",
    row: "recap-turns",
    get label() {
      return txt.rows.first_after_turns.label;
    },
    get note() {
      return txt.rows.first_after_turns.note;
    },
    min: 1,
    max: 10,
    step: 1,
    get unit() {
      return txt.rows.first_after_turns.unit;
    },
  },
];
const writeRows: NumberRow[] = [
  {
    key: "words",
    row: "recap-words",
    get label() {
      return txt.rows.words.label;
    },
    get note() {
      return txt.rows.words.note;
    },
    min: 10,
    max: 80,
    step: 5,
    get unit() {
      return txt.rows.words.unit;
    },
  },
  {
    key: "next_words",
    row: "recap-next",
    get label() {
      return txt.rows.next_words.label;
    },
    get note() {
      return txt.rows.next_words.note;
    },
    min: 4,
    max: 25,
    step: 1,
    get unit() {
      return txt.rows.next_words.unit;
    },
  },
  {
    key: "response_tokens",
    row: "recap-response",
    get label() {
      return txt.rows.response_tokens.label;
    },
    get note() {
      return txt.rows.response_tokens.note;
    },
    min: 128,
    max: 2048,
    step: 64,
    get unit() {
      return txt.rows.response_tokens.unit;
    },
  },
];

/** A response limit below this can cut the recap's JSON short: about four
 * tokens a Finnish word, and the JSON around them. */
export const responseFloor = (value: RecapSettingsValue) =>
  (value.words + value.next_words) * 4 + 48;

// Synthetic preview text, cut to the chosen length.
const sample = () => txt.sample;
const sampleNext = () => txt.sampleNext;
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
                {txt.responseTooLow(responseFloor(value))}
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
      <p className="s-intro">{txt.intro}</p>
      {value ? (
        <div className="s-card ah-recap-preview">
          <span className="ah-recap-label">{txt.preview}</span>
          <RecapCard
            recap={{
              recap: cut(sample(), value.words),
              next: cut(sampleNext(), value.next_words),
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
        <div className="s-row" data-settings-row="recap-automatic">
          <div className="s-lbl">
            <strong>{txt.automatic}</strong>
            {level === "off" ? (
              <span className="s-desc" data-testid="recap-off-warning">
                {txt.levelNotes.off}
              </span>
            ) : null}
          </div>
          {value ? (
            <Segmented
              size="row"
              data-testid="recap-automatic"
              label={txt.automatic}
              options={[
                { id: "on", label: txt.on },
                { id: "off", label: txt.levels.off },
              ]}
              value={level === "off" ? "off" : "on"}
              isDisabled={loading}
              onChange={(id) => {
                if (id === (level === "off" ? "off" : "on")) return;
                change({ level: id === "off" ? "off" : "custom" });
              }}
            />
          ) : null}
        </div>
        <div className="s-row" data-settings-row="recap-delay" tabIndex={-1}>
          <div className="s-lbl">
            <strong>{txt.delay}</strong>
            <span className="s-desc">{txt.delayDesc}</span>
          </div>
          {value ? (
            <ScaleSlider
              testId="recap-delay"
              label={txt.delay}
              value={value.delay_seconds}
              stops={recapDelayStops}
              ticks={[60, 180, 600, 3600]}
              format={formatDelay}
              tickFormat={(s) => String(s / 60)}
              disabled={loading || level === "off"}
              onChange={(delay_seconds) => change({ delay_seconds })}
            />
          ) : null}
        </div>
        {modelField}
      </div>
      <h3 className="s-h3">{txt.scope}</h3>
      <div className="s-card ah-recap-levels">
        <div className="s-row" data-settings-row="recap-level" tabIndex={-1}>
          <div className="s-lbl">
            <strong>{txt.level}</strong>
            <span className="s-desc">
              {level ? levelNotes[level === "off" ? "custom" : level] : null}
            </span>
          </div>
          {value && level ? (
            <ChoiceMenu
              data-testid="recap-level"
              label={txt.level}
              options={(
                ["short", "standard", "thorough", "custom"] as const
              ).map((id) => ({
                id,
                label: levelNames[id],
                description: levelNotes[id],
              }))}
              value={level === "off" ? "custom" : level}
              isDisabled={loading || level === "off"}
              onChange={(id) =>
                change(
                  id === "custom"
                    ? { level: id }
                    : { level: id, ...recapLevels[id] },
                )
              }
            />
          ) : null}
        </div>
        {value ? (
          <div className="ah-recap-scope" data-testid="recap-level-table">
            <div>
              <span className="ah-recap-label">{txt.reads}</span>
              <p>{txt.readsMessages(<strong>{value.messages}</strong>)}</p>
              <p>
                {txt.readsTokens(
                  <strong>{formatNumber(value.history_tokens)}</strong>,
                  formatNumber(value.message_tokens),
                )}
              </p>
              <p>
                {txt.readsAfter(
                  <strong>{txt.turn(value.first_after_turns)}</strong>,
                )}
              </p>
            </div>
            <div>
              <span className="ah-recap-label">{txt.writes}</span>
              <p>{txt.writesWords(<strong>{value.words}</strong>)}</p>
              <p>{txt.writesNext(<strong>{value.next_words}</strong>)}</p>
              <p>
                {txt.writesTokens(
                  <strong>{formatNumber(value.response_tokens)}</strong>,
                )}
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
          <span className="s-bad">{txt.failed}</span>
        ) : saving ? (
          txt.saving
        ) : loading ? (
          txt.loading
        ) : null}
      </p>
    </div>
  );
}
