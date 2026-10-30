import { useEffect, useState } from "react";
import { Button as AriaButton, Input } from "react-aria-components";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { WorkspaceIcon, type WorkspaceIconModel } from "./WorkspaceIcon";
import "./WorkspaceIconSuggestions.css";

/** One suggested icon as the row shows it. `local` ones come from the chain
 * and the name, not from a model. */
export type IconSuggestionItem = {
  value: string;
  why: string;
  icon: WorkspaceIconModel;
  label?: string;
  local?: boolean;
};

/** The suggestion row under the workspace page's heading (Sirut,
 * proto-workspace-icon-setting round 2), as the page resolved it. */
export type WorkspaceIconSuggestionsModel = {
  status: "loading" | "done" | "failed";
  reason?:
    | "model_unavailable"
    | "model_timeout"
    | "model_invalid_response"
    | "request_failed";
  /** Absent while the first answer is on its way: placeholders show. */
  items?: IconSuggestionItem[];
  /** The model's answer to the round on show. */
  reply?: string;
  /** Loading for a wish rather than the first look. */
  wishing: boolean;
  startedAt: number;
  round: { at: number; count: number };
  /** What the model is shown, in words. */
  seen: string;
  model?: string;
};

const quick = [
  ["leikkisämpi", "Leikkisämpi"],
  ["asiallisempi", "Asiallisempi"],
  ["kirjaimet", "Kirjaimet"],
  ["toisia", "Toisia"],
] as const;

const failure = {
  model_unavailable: [
    "Ehdotuksiin ei löytynyt mallia, johon on kirjautuminen.",
    "Kirjaudu mallipalveluun asetuksista.",
  ],
  model_timeout: [
    "Malli ei vastannut 15 sekunnissa.",
    "Voit yrittää uudelleen.",
  ],
  model_invalid_response: [
    "Mallin vastauksesta ei saatu kuvaketta.",
    "Voit yrittää uudelleen.",
  ],
  request_failed: ["Ehdotuksia ei saatu.", "Voit yrittää uudelleen."],
} as const;

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.floor((now - since) / 1000);
  return seconds >= 3 ? (
    <span className="ah-wsis-elapsed">{seconds} s</span>
  ) : null;
}

/** Five suggested icons with their reasons, a wish field, quick wishes and
 * earlier rounds; one click accepts. The page writes and commits the choice
 * and the row goes away; nothing is announced. */
export function WorkspaceIconSuggestions({
  model,
  onAccept,
  onAsk,
  onRound,
  onDismiss,
  onOpenSettings,
}: {
  model: WorkspaceIconSuggestionsModel;
  onAccept: (value: string) => void;
  onAsk: (wish: string) => void;
  onRound: (delta: number) => void;
  onDismiss: () => void;
  /** To the model sign-in settings, when no model has credentials. */
  onOpenSettings: () => void;
}) {
  const [wish, setWish] = useState("");
  const loading = model.status === "loading";
  const noModel =
    model.status === "failed" && model.reason === "model_unavailable";
  const problem =
    model.status === "failed"
      ? failure[model.reason ?? "request_failed"]
      : null;
  return (
    <section
      className="ah-wsis"
      data-testid="workspace-icon-suggestions"
      data-state={model.status}
      aria-label="Kuvake-ehdotus"
    >
      <div className="ah-wsis-top">
        <span className="ah-wsis-label">
          <Icon name="spark" />
          Ehdotus
        </span>
        {loading ? (
          <span className="ah-wsis-cap" role="status">
            <span className="ah-title-dots" data-busy="true" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>{" "}
            {model.wishing ? "Malli miettii…" : "Malli lukee työtilan tietoja…"}{" "}
            <Elapsed since={model.startedAt} />
          </span>
        ) : problem ? (
          <span className="ah-wsis-cap ah-wsis-problem" role="status">
            <b>{problem[0]}</b> {problem[1]}{" "}
            {model.round.count
              ? "Edelliset ehdotukset ovat yhä tässä."
              : "Alla vaihtoehdot ilman mallia."}{" "}
            {noModel ? (
              <AriaButton
                className="ah-wsis-link"
                data-testid="workspace-icon-suggestions-settings"
                onPress={onOpenSettings}
              >
                Avaa asetukset
              </AriaButton>
            ) : (
              <AriaButton
                className="ah-wsis-link"
                data-testid="workspace-icon-suggestions-retry"
                onPress={() => onAsk("")}
              >
                Yritä uudelleen
              </AriaButton>
            )}
          </span>
        ) : (
          <span className="ah-wsis-cap">{model.reply ?? "Ehdotuksia:"}</span>
        )}
        <ControlButton
          data-testid="workspace-icon-suggestions-dismiss"
          size="row"
          variant="quiet"
          onPress={onDismiss}
        >
          Ei nyt
        </ControlButton>
      </div>
      {model.items ? (
        <ul className="ah-wsis-items" data-stale={loading || undefined}>
          {model.items.map((item) => (
            <li key={item.value}>
              <AriaButton
                className="ah-wsis-item"
                data-testid="workspace-icon-suggestion"
                data-local={item.local || undefined}
                aria-label={`${item.label ?? item.value}: ${item.why}`}
                isDisabled={loading}
                onPress={() => onAccept(item.value)}
              >
                <WorkspaceIcon icon={item.icon} size="m" />
                <span className="ah-wsis-why">
                  {item.label ? <b>{item.label}</b> : null}
                  <small>{item.why}</small>
                </span>
              </AriaButton>
            </li>
          ))}
        </ul>
      ) : (
        <div className="ah-wsis-items" aria-busy="true">
          {[0, 1, 2, 3, 4].map((n) => (
            <span key={n} className="ah-wsis-item ah-wsis-skeleton" />
          ))}
        </div>
      )}
      {noModel ? null : (
        <>
          <form
            className="ah-wsis-wish"
            onSubmit={(e) => {
              e.preventDefault();
              if (loading || !wish.trim()) return;
              onAsk(wish);
              setWish("");
            }}
          >
            <Input
              data-testid="workspace-icon-wish"
              aria-label="Toive mallille"
              placeholder="Toive, esim. kettu, sininen, kirjaimet"
              maxLength={200}
              autoComplete="off"
              value={wish}
              onChange={(e) => setWish(e.target.value)}
            />
            <ControlButton
              data-testid="workspace-icon-wish-send"
              size="row"
              type="submit"
              isDisabled={loading}
            >
              Ehdota
            </ControlButton>
          </form>
          <div className="ah-wsis-quick">
            {quick.map(([value, label]) => (
              <AriaButton
                key={value}
                className="ah-wsis-pill"
                data-testid="workspace-icon-quick"
                isDisabled={loading}
                onPress={() => onAsk(value)}
              >
                {label}
              </AriaButton>
            ))}
            {model.round.count > 1 ? (
              <span
                className="ah-wsis-rounds"
                data-testid="workspace-icon-rounds"
              >
                <AriaButton
                  aria-label="Edelliset ehdotukset"
                  data-testid="workspace-icon-round-back"
                  isDisabled={model.round.at <= 0}
                  onPress={() => onRound(-1)}
                >
                  <Icon name="back" />
                </AriaButton>
                {model.round.at + 1}/{model.round.count}
                <AriaButton
                  aria-label="Seuraavat ehdotukset"
                  data-testid="workspace-icon-round-forward"
                  isDisabled={model.round.at >= model.round.count - 1}
                  onPress={() => onRound(1)}
                >
                  <Icon name="forward" />
                </AriaButton>
              </span>
            ) : null}
          </div>
        </>
      )}
      <p className="ah-wsis-foot">
        Malli näkee: {model.seen}.
        {model.model ? (
          <>
            {" "}
            <code>{model.model}</code>
          </>
        ) : null}
      </p>
    </section>
  );
}
