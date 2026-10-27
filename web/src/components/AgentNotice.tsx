import { useState } from "react";
import { ControlButton } from "./ControlElements";
import type { FileOfferSummary } from "../app/fileOffers";
import type { ViewSummary } from "./ViewOffer";

export type AgentNotice = {
  notice_id: string;
  origin: "agent";
  timestamp: string;
  text: string;
  persistence: "persisted" | "not_persisted" | "unknown";
  /** Set when the notice offers an HTML view (ADR 0032). */
  view?: ViewSummary;
  /** Set when the notice offers files to download. */
  file_offer?: FileOfferSummary;
};

// Agent text is data, not markup, a link, or a system instruction.
export function AgentNoticeCard({ notice }: { notice: AgentNotice }) {
  // Dismiss this presentation, not the person's native history entry.
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (dismissed === notice.notice_id) return null;
  return (
    <aside
      className="ah-pi-extension"
      role="note"
      data-testid="agent-notice"
      data-persistence={notice.persistence}
    >
      <header className="ah-agent-notice-header">
        <span className="ah-agent-notice-label">
          Agentin ilmoitus ·{" "}
          <time dateTime={notice.timestamp}>
            {new Date(notice.timestamp).toLocaleString("fi-FI")}
          </time>
        </span>
        <ControlButton
          size="row"
          variant="quiet"
          aria-label="Sulje ilmoitus"
          data-testid="agent-notice-dismiss"
          onPress={() => setDismissed(notice.notice_id)}
        >
          ×
        </ControlButton>
      </header>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {notice.text}
      </p>
      {notice.persistence !== "persisted" ? (
        <p>
          {notice.persistence === "not_persisted"
            ? "Ilmoitusta ei tallennettu historiaan."
            : "Tallennusta historiaan ei voitu varmistaa."}{" "}
          Tämä ilmoitus on väliaikainen.
        </p>
      ) : null}
    </aside>
  );
}
