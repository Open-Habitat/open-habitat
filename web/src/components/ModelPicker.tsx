import "./ModelPicker.css";
import { useId } from "react";
import { Segmented } from "./ControlElements";
export type ModelChoice = {
  provider?: "openai-codex" | "openai" | "claude-bridge";
  id: string;
  name: string;
  older?: boolean;
  outcome?: "answered" | "refused";
  observed_at?: string;
  thinking_levels?: string[];
};
export function refused(model?: ModelChoice) {
  return (
    model?.outcome === "refused" &&
    !!model.observed_at &&
    Date.now() - Date.parse(model.observed_at) < 7 * 86400000
  );
}
export function ModelPicker({
  models,
  provider = "openai-codex",
  selected,
  thinking,
  busy,
  onSelect,
  onThinking,
}: {
  models: ModelChoice[];
  provider?: "openai-codex" | "openai" | "claude-bridge";
  selected?: string;
  thinking?: string;
  busy?: boolean;
  onSelect: (id: string) => void;
  onThinking?: (level: string) => void;
}) {
  const group = useId();
  const older = models.filter((m) => m.older);
  const row = (m: ModelChoice) => (
    <label
      key={m.id}
      className={`md-row ${m.outcome === "answered" ? "k-ok" : m.outcome === "refused" ? "k-no" : ""}`}
      title={
        refused(m)
          ? "Palveluntarjoaja torjui mallin tällä tunnuksella. Valitse toinen malli."
          : undefined
      }
    >
      <input
        type="radio"
        data-testid={`model-${m.id}`}
        name={group}
        checked={selected === m.id}
        disabled={busy || refused(m)}
        onChange={() => onSelect(m.id)}
      />
      <span className="md-nm">
        <span className="md-t">{m.name}</span>
        <span className="md-id">{m.id}</span>
      </span>
      <span className="md-mk">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          {m.outcome === "answered" ? (
            <path d="m5 12.5 4.5 4.5L19 7" />
          ) : m.outcome === "refused" ? (
            <>
              <circle cx="12" cy="12" r="8.5" />
              <path d="M6 6l12 12" />
            </>
          ) : (
            <circle cx="12" cy="12" r="8.5" strokeDasharray="3 3" />
          )}
        </svg>
        {m.outcome
          ? `${m.outcome === "answered" ? "Vastasi" : "Torjuttu"} ${m.observed_at ? new Date(m.observed_at).toLocaleString("fi-FI", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}`
          : "Ei kokeiltu"}
      </span>
    </label>
  );
  return (
    <div className="md-pick">
      <div className="md-gh">
        {provider === "claude-bridge"
          ? "Claude-tilaus"
          : provider === "openai"
            ? "OpenAI API-avain"
            : "ChatGPT-tilaus"}{" "}
        <span className="md-id">{provider}</span>
      </div>
      <p className="md-src">
        Merkit tulevat viimeaikaisista keskusteluistasi. Kokeilematon selviää
        ensimmäisessä viestissä. Agentin luettelo voi olla vanhentunut.
      </p>
      {refused(models.find((m) => m.id === selected)) ? (
        <p role="alert">
          Nykyinen malli ei toimi tililläsi. Valitse toinen ennen uuden
          keskustelun aloittamista.
        </p>
      ) : null}
      {models.some((m) => m.outcome === "refused" && !refused(m)) ? (
        <p className="md-note">
          Yli viikon vanhan torjunnan jälkeen mallin voi valita uudelleen.
          Tilauksesi on voinut muuttua.
        </p>
      ) : null}
      <div className="md-rows">{models.filter((m) => !m.older).map(row)}</div>
      {older.length ? (
        <details
          className="md-more"
          open={older.some((m) => m.id === selected) || undefined}
        >
          <summary data-testid="older-models-toggle">
            Vanhemmat mallit ({older.length})
          </summary>
          <div className="md-rows">{older.map(row)}</div>
        </details>
      ) : null}
      {onThinking ? (
        <div className="md-think">
          <span>Ajattelutaso</span>
          <Segmented
            label="Ajattelutaso"
            className="md-seg"
            options={[
              "off",
              "minimal",
              "low",
              "medium",
              "high",
              "xhigh",
              "max",
            ].map((level) => ({
              id: level,
              label: level,
              title: `Mallin tukema taso: ${level}`,
              isDisabled:
                busy ||
                refused(models.find((m) => m.id === selected)) ||
                !models
                  .find((m) => m.id === selected)
                  ?.thinking_levels?.includes(level),
            }))}
            value={thinking}
            onChange={onThinking}
          />
        </div>
      ) : null}
    </div>
  );
}
