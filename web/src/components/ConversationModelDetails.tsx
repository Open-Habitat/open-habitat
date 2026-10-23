import type { ModelChoice } from "./ModelPicker";
import {
  modelCapabilityRank,
  modelDisplayName,
  thinkingDisplayName,
} from "./modelPresentation";
import "./ModelPicker.css";

/** Presentation of native settings; alternatives are not controls. */
export function ConversationModelDetails({
  model,
  thinking,
  models = [],
}: {
  model?: string;
  thinking?: string;
  models?: ModelChoice[];
}) {
  const id = model?.replace(/^[^/]+\//, "");
  const provider = model?.includes("/") ? model.split("/")[0] : undefined;
  const current = models.find(
    (m) =>
      m.id === id && (!provider || (m.provider ?? "openai-codex") === provider),
  );
  const candidates = current
    ? models.filter(
        (m) =>
          (m.provider ?? "openai-codex") ===
            (current.provider ?? "openai-codex") &&
          (!m.older || m.id === id),
      )
    : [];
  const options = [...candidates].sort(
    (a, b) => modelCapabilityRank(a) - modelCapabilityRank(b),
  );
  const levels = [
    ...new Set([
      ...(current?.thinking_levels ?? []),
      ...(thinking ? [thinking] : []),
    ]),
  ];
  return (
    <section
      data-testid="conversation-model-info"
      aria-label="Keskustelun malli ja ajattelutaso"
    >
      <h2>Malli</h2>
      <ul
        data-testid="model-options"
        className="md-info-ribbon md-info-models"
        aria-label="Malli ja vaihtoehdot"
      >
        {!current ? (
          <li data-model={id} aria-current="true">
            {modelDisplayName(model, models)}
          </li>
        ) : null}
        {options.map((m) => (
          <li
            data-model={m.id}
            key={m.id}
            aria-current={m.id === id ? "true" : undefined}
          >
            {modelDisplayName(
              `${m.provider ?? "openai-codex"}/${m.id}`,
              models,
            )}
            {m.id === id ? (
              <span className="ah-visually-hidden"> (käytössä)</span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="md-note">{model ?? "Mallia ei tiedetä."}</p>
      <h2>Ajattelutaso</h2>
      <ul
        data-testid="thinking-options"
        className="md-info-ribbon"
        aria-label="Ajattelutasot"
      >
        {levels.length ? (
          levels.map((level) => (
            <li
              data-thinking={level}
              key={level}
              aria-current={level === thinking ? "true" : undefined}
            >
              {thinkingDisplayName(level)}
              {level === thinking ? (
                <span className="ah-visually-hidden"> (käytössä)</span>
              ) : null}
            </li>
          ))
        ) : (
          <li>Ei tiedossa</li>
        )}
      </ul>
      <p className="md-note">
        Tämän keskustelun malli ja ajattelutaso. Vaihtoehdot ovat vertailua
        varten, eivät valintoja.
      </p>
    </section>
  );
}
