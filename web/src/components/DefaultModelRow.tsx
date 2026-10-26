import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { controlClassName } from "./ControlElements";
import { Icon } from "./Icon";
import { LetterMark } from "./Integrations";
import { type ModelChoice, type PiProvider, refused } from "./ModelPicker";
import { modelDisplayName, thinkingDisplayName } from "./modelPresentation";
import "./ModelPicker.css";
import "./Settings.css";

// The route a person recognizes: "Sonnet 5" can come from a subscription or a
// key, and a broken default is usually broken in its route.
const routes: Record<PiProvider, [string, string, 1 | 2 | 3]> = {
  "openai-codex": ["ChatGPT-tilaus", "Ch", 1],
  "claude-bridge": ["Claude-tilaus", "Cl", 2],
  openai: ["OpenAI API", "OA", 1],
  anthropic: ["Anthropic API", "An", 2],
  deepseek: ["DeepSeek API", "DS", 3],
};

/** Pi's default as a settings row; its select-style value opens the chooser
 * as a popover on desktop and a bottom sheet on phones (Asetusrivi). */
export function DefaultModelRow({
  provider,
  model,
  thinking,
  models,
  loading,
  children,
}: {
  provider?: PiProvider | null;
  model?: string | null;
  thinking?: string;
  models?: ModelChoice[];
  loading?: boolean;
  children: ReactNode;
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
  const route = provider ? routes[provider] : undefined;
  const current = models?.find(
    (m) => m.id === model && (m.provider ?? "openai-codex") === provider,
  );
  const broken = refused(current);
  const name = model
    ? modelDisplayName(provider ? `${provider}/${model}` : model, models)
    : loading
      ? "Ladataan…"
      : "Ei valittu";
  return (
    <div
      className="s-row dm-row"
      data-settings-row="default-model"
      data-open={open || undefined}
      tabIndex={-1}
    >
      <div className="s-lbl">
        <strong>Oletusmalli</strong>
        <span className="s-desc">Uusille keskusteluille</span>
      </div>
      <div className="s-val dm-anchor" ref={anchor}>
        <button
          ref={trigger}
          type="button"
          className={`dm-field ${controlClassName({ size: "row" })}`}
          data-testid="default-model-trigger"
          data-model={model ?? undefined}
          data-provider={provider ?? undefined}
          data-thinking={thinking}
          data-broken={broken || undefined}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`Oletusmalli: ${name}${route ? `, ${route[0]}` : ""}${thinking ? `, ajattelu ${thinkingDisplayName(thinking)}` : ""}`}
          onClick={() => (open ? close(true) : setOpen(true))}
        >
          {route ? <LetterMark mark={route[1]} tone={route[2]} small /> : null}
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
          aria-label="Oletusmalli"
          data-testid="default-model-menu"
          tabIndex={-1}
          hidden={!open}
        >
          <div className="dm-head">
            <strong>Oletusmalli</strong>
            <button
              type="button"
              className={controlClassName({
                variant: "quiet",
                size: "row",
                presentation: "icon",
              })}
              data-testid="default-model-close"
              aria-label="Sulje"
              onClick={() => close(true)}
            >
              <Icon name="cross" />
            </button>
          </div>
          {children}
        </div>
      </div>
      {broken && route ? (
        <p className="s-desc s-bad dm-problem" role="note">
          {name} ({route[0]}) ei vastannut viimeksi. Valitse toinen oletus tai
          korjaa{" "}
          {provider === "openai-codex" || provider === "claude-bridge"
            ? "kirjautuminen"
            : "avain"}{" "}
          alla.
        </p>
      ) : null}
    </div>
  );
}
