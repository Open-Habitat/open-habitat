import { useEffect, useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { useText } from "../i18n";
import { workspaceIconPickerText } from "../text/workspaceIconPicker";
import { ControlButton } from "./ControlElements";
import { Composer } from "./composer/Composer";
import type { ComposerSpeech } from "./composer/Dictation";
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

/** Five suggested icons with their reasons, a wish field that can be
 * dictated as the composer's is, quick wishes and earlier rounds; one click
 * accepts. The page writes and commits the choice, the row goes away and
 * the page's notice says what was done. */
export function WorkspaceIconSuggestions({
  model,
  onAccept,
  onAsk,
  onRound,
  onDismiss,
  onOpenSettings,
  csrf,
  speech,
}: {
  model: WorkspaceIconSuggestionsModel;
  onAccept: (value: string) => void;
  onAsk: (wish: string) => Promise<boolean>;
  onRound: (delta: number) => void;
  onDismiss: () => void;
  /** To the model sign-in settings, when no model has credentials. */
  onOpenSettings: () => void;
  csrf?: string;
  /** The composer's dictation; without it there is no mic. */
  speech?: ComposerSpeech;
}) {
  const t = useText(workspaceIconPickerText);
  const [wish, setWish] = useState("");
  const [dictating, setDictating] = useState(false);
  const loading = model.status === "loading";
  const busy = loading || dictating;
  const send = async (text = wish) => {
    if (!text.trim() || loading) return;
    if (await onAsk(text))
      setWish((current) => (current === text ? "" : current));
  };
  const noModel =
    model.status === "failed" && model.reason === "model_unavailable";
  const problem =
    model.status === "failed"
      ? t.failure[model.reason ?? "request_failed"]
      : null;
  return (
    <section
      className="ah-wsis"
      data-testid="workspace-icon-suggestions"
      data-state={model.status}
      aria-label={t.rowLabel}
    >
      <div className="ah-wsis-top">
        <span className="ah-wsis-label">
          <Icon name="spark" />
          {t.suggestion}
        </span>
        {loading ? (
          <span className="ah-wsis-cap" role="status">
            <span className="ah-title-dots" data-busy="true" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>{" "}
            {model.wishing ? t.thinking : t.reading}{" "}
            <Elapsed since={model.startedAt} />
          </span>
        ) : problem ? (
          <span className="ah-wsis-cap ah-wsis-problem" role="status">
            <b>{problem[0]}</b> {problem[1]}{" "}
            {model.round.count ? t.earlierKept : t.withoutModel}{" "}
            {noModel ? (
              <AriaButton
                className="ah-wsis-link"
                data-testid="workspace-icon-suggestions-settings"
                onPress={onOpenSettings}
              >
                {t.openSettings}
              </AriaButton>
            ) : (
              <AriaButton
                className="ah-wsis-link"
                data-testid="workspace-icon-suggestions-retry"
                onPress={() => onAsk("")}
              >
                {t.retry}
              </AriaButton>
            )}
          </span>
        ) : (
          <span className="ah-wsis-cap">{model.reply ?? t.suggestions}</span>
        )}
        <ControlButton
          data-testid="workspace-icon-suggestions-dismiss"
          size="row"
          variant="quiet"
          onPress={onDismiss}
        >
          {t.notNow}
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
                isDisabled={busy}
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
          <div className="ah-wsis-wish">
            <Composer
              value={wish}
              onChange={setWish}
              csrf={csrf}
              speech={speech}
              onDictating={setDictating}
              activity="idle"
              selectedWorkingMode="steer"
              sendState={loading ? "pending" : "idle"}
              availability={
                loading ? { state: "disabled", reason: t.thinking } : undefined
              }
              editorAvailability={{ state: "enabled" }}
              idlePlaceholder={t.wishPlaceholder}
              onSendNow={send}
              onSteer={send}
              onFollowUp={send}
              onModeChange={() => {}}
            />
          </div>
          <p className="ah-wsis-foot">{t.wishHint}</p>
          <div className="ah-wsis-quick">
            {t.quick.map(([value, label]) => (
              <AriaButton
                key={value}
                className="ah-wsis-pill"
                data-testid="workspace-icon-quick"
                isDisabled={busy}
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
                  aria-label={t.previous}
                  data-testid="workspace-icon-round-back"
                  isDisabled={model.round.at <= 0}
                  onPress={() => onRound(-1)}
                >
                  <Icon name="back" />
                </AriaButton>
                {model.round.at + 1}/{model.round.count}
                <AriaButton
                  aria-label={t.next}
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
    </section>
  );
}
