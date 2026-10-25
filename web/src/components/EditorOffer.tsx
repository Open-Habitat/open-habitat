import "./ViewPanel.css";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";

/** An agent's offer to show a workspace file in the person's editor
 * (contracts/v1/editor.schema.json#/$defs/offer). */
export type EditorOffer = {
  offer_id: string;
  workspace_id: string;
  path: string;
  line?: number;
  created_at: string;
  conversation_id?: string;
};

/** What a press on the card can do on this page: open the file here, go to
 * the offer's workspace first, or nothing, where no editor is offered. */
export type EditorOfferState = "ready" | "opened" | "elsewhere" | "unavailable";

/** The card an agent's editor offer becomes. One press opens the editor at
 * the file and line through the same path a file link takes; the path is
 * agent text, shown as data, never markup or a link. */
export function EditorOfferCard({
  offer,
  state,
  workspaceName,
  onOpen,
  onGoToWorkspace,
  onDismiss,
}: {
  offer: EditorOffer;
  state: EditorOfferState;
  /** The offer's workspace as the person knows it, when known. */
  workspaceName?: string;
  onOpen: () => void;
  onGoToWorkspace?: () => void;
  /** Hide this card from this view. */
  onDismiss?: () => void;
}) {
  return (
    <aside
      className="ah-view-offer"
      role="note"
      aria-label={`Agentti tarjoaa tiedostoa editoriin: ${offer.path}`}
      data-testid="editor-offer"
      data-offer-id={offer.offer_id}
      data-state={state}
    >
      <span className="ah-view-offer-mark" aria-hidden="true">
        <Icon name="editor" />
      </span>
      <div className="ah-view-offer-body">
        <span className="ah-view-offer-label">
          Agentti tarjoaa avattavaksi editorissa:
        </span>
        <strong className="ah-view-offer-title">{offer.path}</strong>
        <span className="ah-view-offer-meta">
          {offer.line ? `Rivi ${offer.line}` : "Tiedoston alusta"}
          {workspaceName ? ` · ${workspaceName}` : null}
        </span>
        {state === "ready" || state === "opened" ? (
          <span className="ah-view-offer-actions">
            <ControlButton
              size="row"
              variant="primary"
              data-testid="editor-offer-open"
              onPress={onOpen}
            >
              Avaa editorissa
            </ControlButton>
          </span>
        ) : state === "elsewhere" && onGoToWorkspace ? (
          <span className="ah-view-offer-actions">
            <ControlButton
              size="row"
              data-testid="editor-offer-workspace"
              onPress={onGoToWorkspace}
            >
              Siirry työtilaan
            </ControlButton>
          </span>
        ) : null}
        {state === "elsewhere" ? (
          <span className="ah-view-offer-status" role="status">
            Tiedosto on toisessa työtilassa. Avaa siellä keskustelu, niin
            editori voi avata tiedoston.
          </span>
        ) : state === "unavailable" ? (
          <span className="ah-view-offer-status" role="status">
            Editori ei ole käytettävissä tässä näkymässä.
          </span>
        ) : null}
      </div>
      {onDismiss ? (
        <ControlButton
          size="row"
          variant="quiet"
          aria-label="Piilota tarjous"
          data-testid="editor-offer-dismiss"
          onPress={onDismiss}
        >
          <Icon name="cross" />
        </ControlButton>
      ) : null}
    </aside>
  );
}
