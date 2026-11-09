import type { ModelChoice } from "./ModelPicker";
import {
  modelCapabilityRank,
  modelDescription,
  modelDisplayName,
  thinkingDisplayName,
} from "./modelPresentation";
import "./ModelPicker.css";
import { liveText, localeOf, useLanguage } from "../i18n";
import { conversationModelDetailsText } from "../text/conversationModelDetails";
import { modelsText } from "../text/models";

const txt = liveText(conversationModelDetailsText);
const modelTxt = liveText(modelsText);

/** Presentation of native settings as plain facts (proto-model-details round
 * 1, direction B): nothing here looks pressable, because nothing here
 * changes the conversation. */
export function ConversationModelDetails({
  model,
  thinking,
  models = [],
}: {
  model?: string;
  thinking?: string;
  models?: ModelChoice[];
}) {
  const language = useLanguage();
  const id = model?.replace(/^[^/]+\//, "");
  const provider = model?.includes("/") ? model.split("/")[0] : undefined;
  const current = models.find(
    (m) =>
      m.id === id && (!provider || (m.provider ?? "openai-codex") === provider),
  );
  const route = current ? (current.provider ?? "openai-codex") : provider;
  const others = current
    ? models
        .filter(
          (m) =>
            (m.provider ?? "openai-codex") ===
              (current.provider ?? "openai-codex") &&
            !m.older &&
            m.id !== id,
        )
        .sort((a, b) => modelCapabilityRank(a) - modelCapabilityRank(b))
    : [];
  const name = (m: ModelChoice) =>
    modelDisplayName(`${m.provider ?? "openai-codex"}/${m.id}`, models);
  const levels = current?.thinking_levels ?? [];
  const description = modelDescription(id);
  const routeName =
    route && Object.hasOwn(modelTxt.routes, route)
      ? modelTxt.routes[route as keyof typeof modelTxt.routes]
      : undefined;
  return (
    <section
      data-testid="conversation-model-info"
      className="md-info"
      aria-label={txt.label}
    >
      <dl className="md-facts">
        <div>
          <dt>{txt.model}</dt>
          <dd data-testid="model-current" data-model={id}>
            <strong>{modelDisplayName(model, models)}</strong>
            {id ? <code>{id}</code> : null}
            {description ? (
              <span className="md-desc" data-testid="model-description">
                {description}
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>{txt.thinking}</dt>
          <dd data-testid="thinking-current" data-thinking={thinking}>
            <strong>
              {thinking ? thinkingDisplayName(thinking) : txt.unknown}
            </strong>
            <span className="md-desc" data-testid="thinking-description">
              {modelTxt.thinkingAbout}
            </span>
          </dd>
        </div>
        {routeName ? (
          <div>
            <dt>{txt.signIn}</dt>
            <dd>{routeName}</dd>
          </div>
        ) : null}
      </dl>
      {others.length ? (
        <div className="md-others">
          <p className="md-others-h">{txt.others}</p>
          <ul data-testid="model-options">
            {others.map((m) => (
              <li data-model={m.id} key={m.id}>
                <span className="md-t">{name(m)}</span>
                {modelDescription(m.id) ? (
                  <span className="md-desc" data-testid="model-description">
                    {modelDescription(m.id)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {current && levels.length ? (
        <p
          className="md-note"
          data-testid="thinking-options"
          data-levels={levels.join(" ")}
        >
          {txt.levels(
            name(current),
            new Intl.ListFormat(localeOf(language), {
              type: "conjunction",
            }).format(levels.map(thinkingDisplayName)),
          )}
        </p>
      ) : null}
      <p className="md-note">{txt.chosenBefore}</p>
    </section>
  );
}
