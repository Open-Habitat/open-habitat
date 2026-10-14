import { useId } from "react";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { InlineNotice } from "./Status";

export function ArchiveControls({
  state,
  eligible,
  busy,
  onArchive,
  onRestore,
  onClose,
  blockedReason,
  empty = false,
}: {
  blockedReason?: string;
  empty?: boolean;
  state: "active" | "archived" | "unknown";
  eligible: boolean;
  busy: boolean;
  onArchive: () => void;
  onRestore: () => void;
  onClose?: () => void;
}) {
  const reasonId = useId();
  const reason =
    blockedReason ??
    (busy
      ? "Pyyntö kesken."
      : state === "unknown"
        ? "Arkiston tila ei ole tiedossa."
        : !eligible
          ? "Odota Pi:n vuoron päättymistä."
          : "");
  if (empty && state !== "archived") {
    const closeReason =
      blockedReason ??
      (!onClose
        ? "Vain selaimessa aloitettu tyhjä keskustelu voidaan sulkea."
        : reason);
    return (
      <div className="ah-archive-control" title={closeReason || "Sulje"}>
        <ControlButton
          className="ah-topbar-icon"
          variant="quiet"
          aria-label="Sulje"
          title={closeReason || "Sulje"}
          aria-description={closeReason || undefined}
          isDisabled={Boolean(closeReason)}
          onPress={() => onClose?.()}
        >
          <Icon name="cross" />
        </ControlButton>
      </div>
    );
  }
  return (
    <div
      className="ah-archive-control"
      title={reason || (state === "archived" ? "Palauta näkyviin" : "Arkistoi")}
    >
      <ControlButton
        className="ah-topbar-icon"
        variant="quiet"
        aria-describedby={reason ? reasonId : undefined}
        aria-label={state === "archived" ? "Palauta näkyviin" : "Arkistoi"}
        title={
          reason || (state === "archived" ? "Palauta näkyviin" : "Arkistoi")
        }
        aria-description={reason || undefined}
        isDisabled={Boolean(reason)}
        onPress={() => (state === "archived" ? onRestore() : onArchive())}
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
          title="Arkiston tilaa ei voitu tarkistaa"
          tone="warning"
        />
      ) : null}
    </div>
  );
}
