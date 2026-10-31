import { useId } from "react";
import { liveText } from "../i18n";
import { archiveControlsText } from "../text/archiveControls";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { InlineNotice } from "./Status";

const txt = liveText(archiveControlsText);

export type ArchiveControlsProps = {
  blockedReason?: string;
  processState?: string;
  empty?: boolean;
  state: "active" | "archived" | "unknown";
  eligible: boolean;
  busy: boolean;
  onArchive: () => void;
  onRestore: () => void;
  onClose?: () => void;
};

/** The one archive action this conversation offers and why it may be blocked,
 * shared by the top-bar icon and the phone's header menu. */
export function archiveAction({
  state,
  eligible,
  busy,
  onArchive,
  onRestore,
  onClose,
  blockedReason,
  empty = false,
}: ArchiveControlsProps): {
  id: "close" | "archive" | "restore";
  label: string;
  reason: string;
  run: () => void;
} {
  const reason =
    blockedReason ??
    (busy
      ? txt.busy
      : state === "unknown"
        ? txt.unknown
        : !eligible
          ? txt.waitTurn
          : "");
  if (empty && state !== "archived")
    return {
      id: "close",
      label: txt.close,
      reason: blockedReason ?? (!onClose ? txt.closeOnlyEmpty : reason),
      run: () => onClose?.(),
    };
  return state === "archived"
    ? { id: "restore", label: txt.restore, reason, run: onRestore }
    : { id: "archive", label: txt.archive, reason, run: onArchive };
}

export function ArchiveControls(props: ArchiveControlsProps) {
  const { state, processState, blockedReason } = props;
  const reasonId = useId();
  const action = archiveAction(props);
  const reason = action.reason;
  if (action.id === "close") {
    return (
      <div className="ah-archive-control" title={reason || action.label}>
        <ControlButton
          data-testid="dialog-close"
          size="row"
          className="ah-topbar-icon"
          variant="quiet"
          aria-label={action.label}
          title={reason || action.label}
          aria-description={reason || undefined}
          isDisabled={Boolean(reason)}
          onPress={action.run}
        >
          <Icon name="cross" />
        </ControlButton>
      </div>
    );
  }
  return (
    <div className="ah-archive-control" title={reason || action.label}>
      <ControlButton
        data-archive-state={state}
        data-process-state={processState}
        data-testid="archive-conversation"
        size="row"
        className="ah-topbar-icon"
        variant="quiet"
        aria-describedby={reason ? reasonId : undefined}
        aria-label={action.label}
        title={reason || action.label}
        aria-description={reason || undefined}
        isDisabled={Boolean(reason)}
        onPress={action.run}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="5" rx="1" />
          <path d="M5 9v11h14V9M10 13h4" />
        </svg>
      </ControlButton>
      {reason ? (
        <span id={reasonId} className="ah-visually-hidden">
          {reason}
        </span>
      ) : null}
      {state === "unknown" && !blockedReason ? (
        <InlineNotice
          data-testid="archive-state-error"
          title={txt.checkFailed}
          tone="warning"
        />
      ) : null}
    </div>
  );
}
