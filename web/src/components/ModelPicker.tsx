import "./ModelPicker.css";
import { useId } from "react";
export type ModelChoice = {
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
  selected,
  thinking,
  busy,
  onSelect,
  onThinking,
}: {
  models: ModelChoice[];
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
          ? "OpenAI torjui mallin tällä ChatGPT-tilillä. Valitse toinen malli."
          : undefined
      }
    >
      <input
        type="radio"
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
        <span aria-hidden="true">
          {m.outcome === "answered" ? "✓" : m.outcome === "refused" ? "⊘" : "◌"}
        </span>
        {m.outcome
          ? `${m.outcome === "answered" ? "Vastasi" : "Torjuttu"} ${m.observed_at ? new Date(m.observed_at).toLocaleString("fi-FI", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}`
          : "Ei kokeiltu"}
      </span>
    </label>
  );
  return (
    <div className="md-pick">
      <div className="md-gh">
        ChatGPT-tilaus <span className="md-id">openai-codex</span>
      </div>
      <p className="md-src">
        Merkit tulevat viimeaikaisista keskusteluistasi. Kokeilematon selviää
        ensimmäisessä viestissä. Pi:n luettelo voi olla vanhentunut.
      </p>
      {refused(models.find((m) => m.id === selected)) ? (
        <p role="alert">
          Nykyinen malli ei toimi tililläsi. Valitse toinen ennen uuden
          keskustelun aloittamista.
        </p>
      ) : null}
      <div className="md-rows">{models.filter((m) => !m.older).map(row)}</div>
      {older.length ? (
        <details
          className="md-more"
          open={older.some((m) => m.id === selected) || undefined}
        >
          <summary>Vanhemmat mallit ({older.length})</summary>
          <div className="md-rows">{older.map(row)}</div>
        </details>
      ) : null}
      {onThinking ? (
        <div className="md-think">
          <span>Ajattelutaso</span>
          <div className="md-seg">
            {["off", "minimal", "low", "medium", "high", "xhigh"].map(
              (level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={thinking === level}
                  disabled={
                    busy ||
                    !models
                      .find((m) => m.id === selected)
                      ?.thinking_levels?.includes(level)
                  }
                  title={`Mallin tukema taso: ${level}`}
                  onClick={() => onThinking(level)}
                >
                  {level}
                </button>
              ),
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
