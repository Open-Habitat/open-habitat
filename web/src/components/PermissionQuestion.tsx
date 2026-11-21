import { useEffect, useState } from "react";
import { useText } from "../i18n";
import { permissionQuestionText } from "../text/permissionQuestion";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";

/** The typed parts of a permission question (event.schema.json
 * $defs/question, question_kind "permission"). */
export type Permission = {
  action: string;
  consequence: string;
  account?: { provider: string; address: string };
  call: { area: string; tool: string; arguments: string };
};
export type PermissionDecision = "allow" | "deny";

const armDelayMs = 400;

function Technical({ call }: { call: Permission["call"] }) {
  const t = useText(permissionQuestionText);
  return (
    <details className="ah-permission-tech" data-testid="permission-technical">
      <summary>{t.technical}</summary>
      <code className="ah-permission-call">
        {call.area} · {call.tool}
      </code>
      {call.arguments ? (
        <code className="ah-permission-call ah-permission-args">
          {call.arguments}
        </code>
      ) : null}
    </details>
  );
}

/** 2 Kenttä (Jari 21.11.2026): the question takes the composer's place until
 * the person answers, so it can neither scroll away nor be written past. On a
 * phone it is a bottom sheet with full-width buttons. Allow is the expected
 * answer (the person just asked for the action), so it is the primary one.
 * Stop stays: the turn is running. */
export function PermissionQuestion({
  requestId,
  permission,
  available,
  onAnswer,
  onStop,
  stopDisabled,
}: {
  /** A new question waits a moment before it can be answered, so the second
   * press of a double-click meant for the previous one cannot answer it. */
  requestId: string;
  permission: Permission;
  /** Without control the question shows, and the buttons say why not. */
  available: boolean;
  onAnswer: (decision: PermissionDecision) => void;
  onStop?: () => void;
  stopDisabled?: boolean;
}) {
  const t = useText(permissionQuestionText);
  const [armed, setArmed] = useState<string>();
  useEffect(() => {
    const timer = setTimeout(() => setArmed(requestId), armDelayMs);
    return () => clearTimeout(timer);
  }, [requestId]);
  const ready = available && armed === requestId;
  return (
    <div className="ah-permission-dock" data-testid="permission-dock">
      <section
        className="ah-permission"
        data-testid="permission-question"
        aria-label={t.asks}
      >
        <header className="ah-permission-head">
          <span className="ah-permission-icon">
            <Icon name="shieldAsk" width={20} height={20} />
          </span>
          <span className="ah-permission-who">{t.asks}</span>
          {permission.account ? (
            <span
              className="ah-permission-account"
              data-testid="permission-account"
            >
              <Icon name="mail" className="ah-permission-account-icon" />
              {t.onAccount(
                permission.account.provider,
                permission.account.address,
              )}
            </span>
          ) : null}
        </header>
        <h2 className="ah-permission-title" data-testid="permission-title">
          {permission.action}
        </h2>
        <p className="ah-permission-stake">{permission.consequence}</p>
        <div className="ah-permission-foot">
          <Technical call={permission.call} />
          <div className="ah-permission-answer">
            {onStop ? (
              <ControlButton
                size="page"
                variant="quiet"
                presentation="icon"
                aria-label={t.stop}
                data-testid="permission-stop"
                isDisabled={stopDisabled}
                onPress={onStop}
              >
                <Icon name="stop" />
              </ControlButton>
            ) : null}
            <ControlButton
              size="page"
              variant="secondary"
              data-testid="permission-deny"
              isDisabled={!ready}
              title={available ? undefined : t.unavailable}
              onPress={() => onAnswer("deny")}
            >
              {t.deny}
            </ControlButton>
            <ControlButton
              size="page"
              variant="primary"
              data-testid="permission-allow"
              isDisabled={!ready}
              title={available ? undefined : t.unavailable}
              onPress={() => onAnswer("allow")}
            >
              {t.allow}
            </ControlButton>
          </div>
        </div>
      </section>
    </div>
  );
}

/** The stream marks where the agent stopped: waiting, then the decision. */
export function PermissionLine({
  action,
  decision,
}: {
  action: string;
  decision?: PermissionDecision;
}) {
  const t = useText(permissionQuestionText);
  return (
    <div
      className="ah-permission-line"
      data-testid="permission-line"
      data-open={decision ? undefined : true}
      data-decision={decision}
    >
      <Icon
        name="shieldAsk"
        width={16}
        height={16}
        className="ah-permission-line-icon"
      />
      {decision ? (
        <span className="ah-permission-line-text">
          <span className="ah-permission-decided">
            <Icon
              name={decision === "allow" ? "check" : "cross"}
              className="ah-permission-decided-icon"
            />
            {decision === "allow" ? t.allowed : t.denied}
          </span>{" "}
          · {action}
        </span>
      ) : (
        <span className="ah-permission-line-text">
          <strong>{t.waiting}</strong> · {action}
        </span>
      )}
    </div>
  );
}
