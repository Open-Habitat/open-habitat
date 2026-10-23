import "./ModelPicker.css";
import { useId } from "react";
import { Segmented } from "./ControlElements";
import { modelCapabilityRank, modelDisplayName } from "./modelPresentation";
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
      className="md-row"
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
      <span className="md-t">
        {modelDisplayName(`${m.provider ?? "openai-codex"}/${m.id}`, models)}
      </span>
      {refused(m) ? <span className="md-note">Ei käytettävissä</span> : null}
    </label>
  );
  return (
    <div className="md-pick">
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
      <div className="md-rows">
        {[...models]
          .filter((m) => !m.older)
          .sort((a, b) => modelCapabilityRank(a) - modelCapabilityRank(b))
          .map(row)}
      </div>
      {older.length ? (
        <details
          className="md-more"
          open={older.some((m) => m.id === selected) || undefined}
        >
          <summary data-testid="older-models-toggle">
            Vanhemmat mallit ({older.length})
          </summary>
          <div className="md-rows">
            {[...older]
              .sort((a, b) => modelCapabilityRank(a) - modelCapabilityRank(b))
              .map(row)}
          </div>
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
