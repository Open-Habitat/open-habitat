import { type ReactNode, useId, useState } from "react";
import type { AIOffer } from "../app/onboardingConfig";
import { liveText, useText } from "../i18n";
import { aiOfferListText } from "../text/aiOfferList";
import "./AIOfferList.css";

// The onboarding AI step's options, "Ehdotus ja lista" (proto-admin-server-
// onboarding r3–r4): every option is a row of one list, and the chosen row
// opens in place with its sign-in inside. With a site default the list holds
// that one option, marked as the site's suggestion, and "› Käytä muuta
// AI-palvelua" reveals the others. The person's step and the administrator's
// preview both render this list; only the row bodies differ.

export type AIOption = Exclude<AIOffer, "all" | "site_key">;
export type AIOptionInfo = {
  id: AIOption;
  name: string;
  how: string;
  mark: string;
  key: boolean;
};

const txt = liveText(aiOfferListText);

// The names and descriptions are getters, read in the language of the
// moment, so the options keep one identity across a language change.
export const aiOptionCatalog: AIOptionInfo[] = [
  {
    id: "chatgpt",
    get name() {
      return txt.chatgpt;
    },
    get how() {
      return txt.chatgptHow;
    },
    mark: "Ch",
    key: false,
  },
  {
    id: "claude",
    get name() {
      return txt.claude;
    },
    get how() {
      return txt.claudeHow;
    },
    mark: "Cl",
    key: false,
  },
  ...(
    [
      ["openai_key", "OpenAI", "OA"],
      ["anthropic_key", "Anthropic", "An"],
      ["deepseek_key", "DeepSeek", "DS"],
    ] as const
  ).map(([id, provider, mark]) => ({
    id,
    get name() {
      return txt.apiKey(provider);
    },
    get how() {
      return txt.bills(provider);
    },
    mark,
    key: true,
  })),
];

/** The option a site offer suggests, or none when the person chooses among
 * all. A site key is not an option of this step: whenever the step shows
 * despite it (the person's Pi has no usable credential), every option is
 * offered. So is a suggestion the list does not carry. */
export function suggestionOf(
  offer: AIOffer,
  options: AIOptionInfo[] = aiOptionCatalog,
): AIOptionInfo | undefined {
  return options.find((o) => o.id === offer);
}

/** The step's lead under its heading. */
export const aiStepLead = (suggested?: AIOptionInfo) =>
  suggested ? txt.suggests(suggested.name) : txt.chooseOne;

export function AIOfferList({
  offer,
  choice,
  onChoose,
  body,
  keep,
  subscriptionsOnly = false,
}: {
  offer: AIOffer;
  choice: AIOption;
  onChoose: (id: AIOption) => void;
  /** What the open row holds. */
  body: (o: AIOptionInfo) => ReactNode;
  /** Whether a row's body stays mounted, hidden, while the row is closed. */
  keep?: (o: AIOptionInfo) => boolean;
  subscriptionsOnly?: boolean;
}) {
  const t = useText(aiOfferListText);
  const id = useId();
  const options = aiOptionCatalog.filter((o) => !subscriptionsOnly || !o.key);
  const suggested = suggestionOf(offer, options);
  const [others, setOthers] = useState(false);
  const row = (o: AIOptionInfo) => {
    const open = choice === o.id;
    const kept = keep?.(o) ?? false;
    const bodyId = `${id}-${o.id}`;
    return (
      <li
        key={o.id}
        className="ah-ai-option"
        data-testid={`ai-option-${o.id}`}
        data-open={open}
        data-key={o.key}
      >
        <button
          type="button"
          className="ah-ai-option-head"
          data-testid={`ai-option-${o.id}-choose`}
          aria-expanded={open}
          aria-controls={open || kept ? bodyId : undefined}
          onClick={() => onChoose(o.id)}
        >
          <span className="ah-ai-mark" aria-hidden="true">
            {o.mark}
          </span>
          <span className="ah-ai-option-text">
            <strong>{o.name}</strong>
            <small>{o.how}</small>
          </span>
          {o === suggested ? (
            <span className="ah-ai-badge" data-testid="ai-suggestion">
              {t.suggestion}
            </span>
          ) : (
            <span className="ah-ai-radio" aria-hidden="true" />
          )}
        </button>
        {open || kept ? (
          <div id={bodyId} className="ah-ai-option-body" hidden={!open}>
            {body(o)}
          </div>
        ) : null}
      </li>
    );
  };
  const groups = (among: AIOptionInfo[]) => {
    const subscriptions = among.filter((o) => !o.key);
    const keys = among.filter((o) => o.key);
    return (
      <>
        {subscriptions.length ? (
          <>
            <p className="ah-ai-group" id={`${id}-subscription`}>
              {t.subscription}
            </p>
            <ul
              className="ah-ai-options"
              aria-labelledby={`${id}-subscription`}
            >
              {subscriptions.map(row)}
            </ul>
          </>
        ) : null}
        {keys.length ? (
          <>
            <p className="ah-ai-group" id={`${id}-key`}>
              {t.keys}
            </p>
            <ul className="ah-ai-options" aria-labelledby={`${id}-key`}>
              {keys.map(row)}
            </ul>
          </>
        ) : null}
      </>
    );
  };
  if (!suggested)
    return (
      <div className="ah-ai-groups" data-testid="ai-options">
        {groups(options)}
      </div>
    );
  // The others stay mounted while hidden, so a sign-in started in one of them
  // keeps its attempt when the list is folded away.
  return (
    <div className="ah-ai-groups" data-testid="ai-options">
      <ul className="ah-ai-options">{row(suggested)}</ul>
      <button
        type="button"
        className="ah-ai-more"
        data-testid="ai-others-toggle"
        aria-expanded={others}
        aria-controls={`${id}-others`}
        onClick={() => {
          // Folding the others away returns to the suggestion rather than
          // leaving the chosen row out of sight.
          if (others && choice !== suggested.id) onChoose(suggested.id);
          setOthers(!others);
        }}
      >
        <span aria-hidden="true">›</span> {t.others}
      </button>
      <div
        id={`${id}-others`}
        className="ah-ai-groups"
        data-testid="ai-others"
        hidden={!others}
      >
        {groups(options.filter((o) => o !== suggested))}
      </div>
    </div>
  );
}
