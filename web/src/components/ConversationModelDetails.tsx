import type { ModelChoice } from "./ModelPicker";
import {
  modelCapabilityRank,
  modelDisplayName,
  thinkingDisplayName,
} from "./modelPresentation";
import "./ModelPicker.css";
import { liveText } from "../i18n";
import { conversationModelDetailsText } from "../text/conversationModelDetails";

const txt = liveText(conversationModelDetailsText);

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
    <section data-testid="conversation-model-info" aria-label={txt.label}>
      <h2>{txt.model}</h2>
      <ul
        data-testid="model-options"
        className="md-info-ribbon md-info-models"
        aria-label={txt.options}
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
              <span className="ah-visually-hidden">{txt.current}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="md-note">{model ?? txt.unknownModel}</p>
      <h2>{txt.thinking}</h2>
      <ul
        data-testid="thinking-options"
        className="md-info-ribbon"
        aria-label={txt.thinkingLevels}
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
                <span className="ah-visually-hidden">{txt.current}</span>
              ) : null}
            </li>
          ))
        ) : (
          <li>{txt.unknown}</li>
        )}
      </ul>
    </section>
  );
}
