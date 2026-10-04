import { ExternalLink } from "./ControlElements";
import { Button } from "./Primitives";
import { InlineNotice, StatusMark } from "./Status";
import type { Availability, ProblemView, Stage } from "./types";

export function CapabilityNotice({
  actionLabel,
  state,
  reason,
  observedAt,
  onReobserve,
}: {
  actionLabel: string;
  state: "unsupported" | "unknown" | "temporarilyUnavailable";
  reason: string;
  observedAt?: string;
  onReobserve?: () => void;
}) {
  const label =
    state === "unsupported"
      ? "Ei tuettu"
      : state === "unknown"
        ? "Ei vielä tiedossa"
        : "Tilapäisesti poissa käytöstä";
  return (
    <InlineNotice
      title={`${actionLabel}: ${label}`}
      description={`${reason}${observedAt ? ` Havaittu ${observedAt}.` : ""}`}
      tone="warning"
      actions={
        onReobserve
          ? [{ label: "Havaitse uudelleen", onPress: onReobserve }]
          : []
      }
    />
  );
}
const operationStateLabel = {
  pending: "Odottaa",
  running: "Käynnissä",
  succeeded: "Onnistui",
  failed: "Epäonnistui",
  partial: "Osittainen",
  unknown: "Tila ei tiedossa",
} as const;
const stageStateLabel = {
  pending: "Odottaa",
  running: "Käynnissä",
  succeeded: "Onnistui",
  failed: "Epäonnistui",
  unknown: "Ei tiedossa",
  skipped: "Ohitettu",
} as const;

export function OperationProgress({
  operationId,
  kindLabel,
  state,
  stages,
  effects = [],
  problem,
  observationAge,
  retryAvailability,
  closeLabel = "Sulje näkymä — operaatio jatkuu",
  onRetryFromFreshObservation,
  onClose,
}: {
  operationId: string;
  kindLabel: string;
  state: "pending" | "running" | "succeeded" | "failed" | "partial" | "unknown";
  stages: Stage[];
  effects?: {
    kindLabel: string;
    stateLabel: string;
    description: string;
    ownerLabel?: string;
  }[];
  problem?: ProblemView;
  observationAge?: string;
  retryAvailability?: Availability;
  closeLabel?: string;
  onRetryFromFreshObservation?: () => void;
  onClose: () => void;
}) {
  return (
    <section className="ah-operation">
      <header>
        <div>
          <p className="ah-eyebrow">{kindLabel}</p>
          <h2>Operaation eteneminen</h2>
        </div>
        <StatusMark
          label={operationStateLabel[state]}
          tone={
            state === "failed"
              ? "danger"
              : state === "partial" || state === "unknown"
                ? "warning"
                : state === "succeeded"
                  ? "success"
                  : "info"
          }
          animated={state === "running" ? "running" : false}
        />
      </header>
      <code>{operationId}</code>
      {observationAge ? <p>Havainto: {observationAge}</p> : null}
      <ol className="ah-stages">
        {stages.map((stage) => (
          <li key={stage.id}>
            <StatusMark
              label={`${stage.label}: ${stageStateLabel[stage.state]}`}
              tone={
                stage.state === "failed"
                  ? "danger"
                  : stage.state === "succeeded"
                    ? "success"
                    : stage.state === "unknown"
                      ? "warning"
                      : "neutral"
              }
              animated={stage.state === "running" ? "running" : false}
            />
            {stage.detail ? <p>{stage.detail}</p> : null}
          </li>
        ))}
      </ol>
      {effects.length ? (
        <section>
          <h3>Vaikutukset</h3>
          <ul>
            {effects.map((effect) => (
              <li key={`${effect.kindLabel}-${effect.description}`}>
                <strong>
                  {effect.kindLabel}: {effect.stateLabel}
                </strong>
                <p>{effect.description}</p>
                {effect.ownerLabel ? <small>{effect.ownerLabel}</small> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {problem ? (
        <InlineNotice
          title={problem.title}
          description={problem.description}
          tone="danger"
        />
      ) : null}
      <div className="ah-actions">
        {onRetryFromFreshObservation ? (
          <Button
            label="Yritä tuoreesta havainnosta"
            variant="secondary"
            availability={retryAvailability}
            onPress={onRetryFromFreshObservation}
          />
        ) : null}
        <Button label={closeLabel} variant="secondary" onPress={onClose} />
      </div>
    </section>
  );
}
export function FormErrorSummary({
  heading = "Korjaa seuraavat tiedot",
  errors,
}: {
  heading?: string;
  errors: { fieldId: string; message: string }[];
}) {
  return (
    <section
      aria-labelledby="form-errors"
      className="ah-error-summary"
      tabIndex={-1}
    >
      <h2 id="form-errors">{heading}</h2>
      <ul>
        {errors.map((error) => (
          <li key={error.fieldId}>
            <ExternalLink href={`#${error.fieldId}`}>
              {error.message}
            </ExternalLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
