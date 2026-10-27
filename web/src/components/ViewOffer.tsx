import "./ViewPanel.css";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";

/** One frozen export an agent offered (contracts/v1/view.schema.json). */
export type ViewSummary = {
  view_id: string;
  title: string;
  entry: string;
  files: number;
  bytes: number;
  created_at: string;
  conversation_id?: string;
};

/** What the person's last press on this card did. A tab is only requested:
 * the browser may block it, and nothing reports back. */
export type ViewOfferState =
  | "idle"
  | "opening"
  | "open"
  | "tab_requested"
  | "failed";

export function formatViewSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} t`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kt`;
  return `${(bytes / 1024 / 1024).toLocaleString("fi-FI", { maximumFractionDigits: 1 })} Mt`;
}

/** Suora (agent-html-artifacts, round 2): every offer has both places, the
 * panel beside the conversation and an own browser tab, chosen per press.
 * Agent text (the title) is data, never markup or a link. */
export function ViewOfferCard({
  view,
  state = "idle",
  onOpen,
  onOpenTab,
}: {
  view: ViewSummary;
  state?: ViewOfferState;
  /** Open in the panel; the pressed button receives focus back on close. */
  onOpen: (opener: HTMLElement | null) => void;
  onOpenTab: () => void;
}) {
  return (
    <aside
      className="ah-view-offer"
      role="note"
      aria-label={`Agentin tarjoama näkymä: ${view.title}`}
      data-testid="view-offer"
      data-view-id={view.view_id}
      data-state={state}
    >
      <span className="ah-view-offer-mark" aria-hidden="true">
        {"</>"}
      </span>
      <div className="ah-view-offer-body">
        <span className="ah-view-offer-label">
          Agentti tarjoaa näytettäväksi:
        </span>
        <strong className="ah-view-offer-title">{view.title}</strong>
        <span className="ah-view-offer-meta">
          Jäädytetty HTML ·{" "}
          {view.files === 1 ? "1 tiedosto" : `${view.files} tiedostoa`} ·{" "}
          {formatViewSize(view.bytes)} · Vain sinulle
        </span>
        <span className="ah-view-offer-actions">
          <ControlButton
            size="row"
            variant="primary"
            data-testid="view-open"
            isDisabled={state === "opening"}
            onPress={(event) =>
              onOpen(event.target instanceof HTMLElement ? event.target : null)
            }
          >
            Avaa
          </ControlButton>
          <ControlButton
            size="row"
            data-testid="view-open-tab"
            onPress={onOpenTab}
          >
            Avaa omalle välilehdelle <Icon name="external" />
          </ControlButton>
        </span>
        {state === "tab_requested" || state === "failed" ? (
          <span className="ah-view-offer-status" role="status">
            {state === "tab_requested"
              ? "Avaus pyydetty. Jos välilehteä ei näy, selain saattoi estää sen."
              : "Näkymää ei voitu avata. Se on ehkä poistettu, tai yhteys katkesi."}
          </span>
        ) : null}
      </div>
    </aside>
  );
}
