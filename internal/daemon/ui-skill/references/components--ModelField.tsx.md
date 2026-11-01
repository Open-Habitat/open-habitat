# components/ModelField.tsx

Generated from web/src/components/ModelField.tsx; do not edit.

```tsx
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { controlClassName } from "./ControlElements";
import { Icon } from "./Icon";
import { LetterMark } from "./Integrations";
import { type ModelChoice, type PiProvider, refused } from "./ModelPicker";
import { modelDisplayName, thinkingDisplayName } from "./modelPresentation";
import "./ModelPicker.css";
import "./Settings.css";
import { liveText } from "../i18n";
import { modelsText } from "../text/models";

const txt = liveText(modelsText);

// The route a person recognizes: "Sonnet 5" can come from a subscription or a
// key, and a broken default is usually broken in its route.
const marks: Record<PiProvider, [string, 1 | 2 | 3]> = {
  "openai-codex": ["Ch", 1],
  "claude-bridge": ["Cl", 2],
  openai: ["OA", 1],
  anthropic: ["An", 2],
  deepseek: ["DS", 3],
};
/** A provider's route as [name, letter mark, tone], named in the current
 * language, or undefined for a provider this client does not know. Only own
 * keys count: an inherited name such as "constructor" (which React Refresh
 * reads from every export) must not resolve to an Object.prototype member. */
export function providerRoute(
  provider: string,
): [string, string, 1 | 2 | 3] | undefined {
  if (!Object.hasOwn(marks, provider)) return undefined;
  const known = provider as PiProvider;
  return [txt.routes[known], ...marks[known]];
}

/** A model setting as a settings row: its select-style value opens the
 * shared model chooser as a popover on desktop and a bottom sheet on phones
 * (Asetusrivi). Tekoäly › Oletusmalli and Tilannekatsaus › Malli are both
 * this field, so the two choose a model the same way. */
export function ModelField({
  rowId,
  testId,
  label,
  description,
  provider,
  model,
  thinking,
  auto = false,
  models,
  loading,
  emptyLabel = txt.notChosen,
  problem,
  children,
}: {
  /** The row's stable id: a link's fragment and the settings search. */
  rowId: string;
  testId: string;
  label: string;
  description: ReactNode;
  provider?: PiProvider | null;
  model?: string | null;
  thinking?: string;
  /** The value is the automatic choice, and model is what it now picks. */
  auto?: boolean;
  models?: ModelChoice[];
  loading?: boolean;
  /** The value when there is no model. */
  emptyLabel?: string;
  /** Shown under the row while the chosen model does not work. */
  problem?: ReactNode;
  /** The chooser; a function gets a close for a choice that ends it. */
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    // Start where the default is, as a select does.
    (
      panel.current?.querySelector<HTMLElement>("input[type=radio]:checked") ??
      panel.current
    )?.focus();
    // An outside pointer dismisses without stealing the focus it lands on.
    const dismiss = (event: PointerEvent) => {
      if (anchor.current && !event.composedPath().includes(anchor.current))
        setOpen(false);
    };
    // Escape anywhere in the chooser closes it and returns focus to the row.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    // A link inside (such as the Claude sign-in row) leads elsewhere on the
    // page, which the chooser would otherwise cover.
    const onLink = (event: MouseEvent) => {
      if ((event.target as Element).closest("a[href]")) setOpen(false);
    };
    const element = anchor.current;
    document.addEventListener("pointerdown", dismiss, true);
    element?.addEventListener("keydown", onEscape);
    element?.addEventListener("click", onLink);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      element?.removeEventListener("keydown", onEscape);
      element?.removeEventListener("click", onLink);
    };
  }, [open]);
  const route = provider && model ? providerRoute(provider) : undefined;
  const current = models?.find(
    (m) => m.id === model && (m.provider ?? "openai-codex") === provider,
  );
  const broken = refused(current);
  const name = model
    ? modelDisplayName(provider ? `${provider}/${model}` : model, models)
    : loading
      ? txt.loading
      : emptyLabel;
  return (
    <div
      className="s-row dm-row"
      data-settings-row={rowId}
      data-open={open || undefined}
      tabIndex={-1}
    >
      <div className="s-lbl">
        <strong>{label}</strong>
        <span className="s-desc">{description}</span>
      </div>
      <div className="s-val dm-anchor" ref={anchor}>
        <button
          ref={trigger}
          type="button"
          className={`dm-field ${controlClassName({ size: "row" })}`}
          data-testid={`${testId}-trigger`}
          data-model={model ?? undefined}
          data-provider={provider ?? undefined}
          data-thinking={thinking}
          data-auto={auto || undefined}
          data-broken={broken || undefined}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={txt.fieldLabel(
            label,
            auto,
            name,
            route?.[0],
            thinking ? thinkingDisplayName(thinking) : undefined,
          )}
          onClick={() => (open ? close(true) : setOpen(true))}
        >
          {auto ? <span className="dm-auto">{txt.automatic}</span> : null}
          {route && !auto ? (
            <LetterMark mark={route[1]} tone={route[2]} small />
          ) : null}
          <span className="dm-model">
            {broken ? <Icon name="warning" /> : null}
            {name}
          </span>
          {route ? <span className="dm-route">{route[0]}</span> : null}
          {model && thinking ? (
            <span className="dm-think">
              <Icon name="thinking" />
              {thinkingDisplayName(thinking)}
            </span>
          ) : null}
          <Icon name="updown" />
        </button>
        {/* The phone sheet's scrim; on desktop the popover needs none. */}
        {open ? (
          <div
            className="dm-scrim"
            aria-hidden="true"
            onClick={() => close(false)}
          />
        ) : null}
        {/* Kept mounted while closed: the selector's confirmation and its
            refusal survive closing and reopening. */}
        <div
          ref={panel}
          id={panelId}
          className="md-pop dm-pop"
          role="dialog"
          aria-label={label}
          data-testid={`${testId}-menu`}
          tabIndex={-1}
          hidden={!open}
        >
          <div className="dm-head">
            <strong>{label}</strong>
            <button
              type="button"
              className={controlClassName({
                variant: "quiet",
                size: "row",
                presentation: "icon",
              })}
              data-testid={`${testId}-close`}
              aria-label={txt.close}
              onClick={() => close(true)}
            >
              <Icon name="cross" />
            </button>
          </div>
          {typeof children === "function"
            ? children(() => close(true))
            : children}
        </div>
      </div>
      {broken && problem ? (
        <p className="s-desc s-bad dm-problem" role="note">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

```
