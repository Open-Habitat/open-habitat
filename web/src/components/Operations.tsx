import { useText } from "../i18n";
import { operationsText } from "../text/operations";
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
  const txt = useText(operationsText);
  const label = txt.capability[state];
  return (
    <InlineNotice
      title={`${actionLabel}: ${label}`}
      description={`${reason}${observedAt ? txt.observed(observedAt) : ""}`}
      tone="warning"
      actions={
        onReobserve ? [{ label: txt.reobserve, onPress: onReobserve }] : []
      }
    />
  );
}
export function OperationProgress({
  operationId,
  kindLabel,
  state,
  stages,
  effects = [],
  problem,
  observationAge,
  retryAvailability,
  closeLabel,
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
  const txt = useText(operationsText);
  return (
    <section
      data-testid="operation-progress"
      data-state={state}
      className="ah-operation"
    >
      <header>
        <div>
          <p className="ah-eyebrow">{kindLabel}</p>
          <h2>{txt.title}</h2>
        </div>
        <StatusMark
          label={txt.operation[state]}
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
      {observationAge ? <p>{txt.observation(observationAge)}</p> : null}
      <ol className="ah-stages">
        {stages.map((stage) => (
          <li key={stage.id}>
            <StatusMark
              label={`${stage.label}: ${txt.stage[stage.state]}`}
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
          <h3>{txt.effects}</h3>
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
            size="row"
            label={txt.retry}
            variant="secondary"
            availability={retryAvailability}
            onPress={onRetryFromFreshObservation}
          />
        ) : null}
        <Button
          size="row"
          label={closeLabel ?? txt.close}
          variant="secondary"
          onPress={onClose}
        />
      </div>
    </section>
  );
}
export function FormErrorSummary({
  heading,
  errors,
}: {
  heading?: string;
  errors: { fieldId: string; message: string }[];
}) {
  const txt = useText(operationsText);
  return (
    <section
      aria-labelledby="form-errors"
      className="ah-error-summary"
      tabIndex={-1}
    >
      <h2 id="form-errors">{heading ?? txt.fix}</h2>
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
