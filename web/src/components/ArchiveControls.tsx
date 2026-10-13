import { useState } from "react";
import { ControlButton } from "./ControlElements";
import { Button } from "./Primitives";
import { InlineNotice } from "./Status";

export function ArchiveControls({
  state,
  eligible,
  busy,
  onArchive,
  onRestore,
}: {
  state: "active" | "archived" | "unknown";
  eligible: boolean;
  busy: boolean;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const reason = busy
    ? "Pyyntö kesken."
    : state === "unknown"
      ? "Arkiston tila ei ole tiedossa."
      : !eligible
        ? "Odota Pi:n vuoron päättymistä."
        : "";
  return (
    <div
      className="ah-archive-control"
      title={reason || (state === "archived" ? "Palauta näkyviin" : "Arkistoi")}
    >
      <ControlButton
        className="ah-topbar-icon"
        variant="quiet"
        aria-label={state === "archived" ? "Palauta näkyviin" : "Arkistoi"}
        title={
          reason || (state === "archived" ? "Palauta näkyviin" : "Arkistoi")
        }
        aria-description={reason || undefined}
        isDisabled={Boolean(reason)}
        onPress={() => (state === "archived" ? onRestore() : setConfirm(true))}
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
      {reason ? <span className="ah-visually-hidden">{reason}</span> : null}
      {confirm ? (
        <div
          role="alertdialog"
          aria-label="Vahvista arkistointi"
          className="ah-archive-confirm"
        >
          <p>
            Arkistointi piilottaa keskustelun listasta. Pi:n historia säilyy.
          </p>
          <Button
            label="Vahvista arkistointi"
            onPress={() => {
              setConfirm(false);
              onArchive();
            }}
            availability={
              eligible && !busy
                ? { state: "enabled" }
                : { state: "disabled", reason: "Odota vahvistettua tilaa." }
            }
          />
          <Button
            label="Peruuta"
            variant="quiet"
            onPress={() => setConfirm(false)}
          />
        </div>
      ) : null}
      {state === "unknown" ? (
        <InlineNotice
          title="Arkiston tilaa ei voitu tarkistaa"
          tone="warning"
        />
      ) : null}
    </div>
  );
}
