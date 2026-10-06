import { useState } from "react";
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
  return (
    <fieldset aria-label="Keskustelun arkistointi">
      {state === "unknown" ? (
        <InlineNotice
          title="Arkiston tilaa ei voitu tarkistaa"
          description="Historia on edelleen luettavissa. Päivitä tiedot ennen muutosta."
          tone="warning"
        />
      ) : state === "archived" ? (
        <Button
          label="Palauta näkyviin"
          variant="quiet"
          onPress={onRestore}
          availability={
            busy
              ? { state: "unknown", reason: "Pyyntö kesken" }
              : { state: "enabled" }
          }
        />
      ) : confirm ? (
        <>
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
                : {
                    state: "unknown",
                    reason: "Keskustelun tila on muuttunut. Tarkista tila.",
                  }
            }
          />
          <Button
            label="Peruuta"
            variant="quiet"
            onPress={() => setConfirm(false)}
          />
        </>
      ) : (
        <Button
          label="Arkistoi"
          variant="quiet"
          onPress={() => setConfirm(true)}
          availability={
            eligible && !busy
              ? { state: "enabled" }
              : {
                  state: "unknown",
                  reason:
                    "Vain vahvistettu joutilas tai päättynyt keskustelu voidaan arkistoida",
                }
          }
        />
      )}
    </fieldset>
  );
}
