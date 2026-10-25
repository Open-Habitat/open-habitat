// Agent editor offers: an agent asks to show a workspace file at a line, and
// the person's press opens it through the editor's own file-link path, so
// the browser and the daemon check the path again as for any link. Nothing
// opens without a press.
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router";
import {
  type EditorOffer,
  EditorOfferCard,
  type EditorOfferState,
} from "../components/EditorOffer";
import { FileLinkContext, type FileLinks } from "../components/fileRefs";

/** The page's workspace editor as an offer outside it can reach it: which
 * workspace it belongs to and its links, null where no editor is offered. */
export type EditorLinks = { workspace?: string; links: FileLinks | null };

const EditorLinksRegistry = createContext<
  ((editor: EditorLinks | undefined) => void) | null
>(null);

/** The workspace editor tells the account offers above it what it can open. */
export function useRegisterEditorLinks(
  workspace: string | undefined,
  links: FileLinks | null,
) {
  const register = useContext(EditorLinksRegistry);
  useEffect(() => {
    if (!register) return;
    register({ workspace, links });
    return () => register(undefined);
  }, [register, workspace, links]);
}

export function EditorLinksProvider({
  onChange,
  children,
}: {
  onChange: (editor: EditorLinks | undefined) => void;
  children: ReactNode;
}) {
  return (
    <EditorLinksRegistry.Provider value={onChange}>
      {children}
    </EditorLinksRegistry.Provider>
  );
}

// The editor marks the link text it opened last; an offer's own mark never
// matches a link in the conversation.
const mark = (offer: EditorOffer) => `offer:${offer.offer_id}`;

function openOffer(links: FileLinks, offer: EditorOffer) {
  links.open(
    { path: offer.path, ...(offer.line ? { line: offer.line } : {}) },
    mark(offer),
  );
}

function offerState(
  offer: EditorOffer,
  editor: EditorLinks | undefined,
): EditorOfferState {
  if (editor?.workspace !== offer.workspace_id) return "elsewhere";
  if (!editor.links) return "unavailable";
  return editor.links.opened === mark(offer) ? "opened" : "ready";
}

/** A conversation notice's editor offer, inside the conversation's own
 * workspace editor. */
export function EditorOfferEntry({ offer }: { offer: EditorOffer }) {
  const links = useContext(FileLinkContext);
  const state =
    links && links.workspace === offer.workspace_id
      ? links.opened === mark(offer)
        ? "opened"
        : "ready"
      : "unavailable";
  return (
    <EditorOfferCard
      offer={offer}
      state={state}
      onOpen={() => {
        if (links) openOffer(links, offer);
      }}
    />
  );
}

/** Account offers worth showing: not tied to a conversation and recent. */
export function recentEditorOffers(
  offers: EditorOffer[],
  now = Date.now(),
): EditorOffer[] {
  return offers
    .filter(
      (offer) =>
        !offer.conversation_id &&
        now - Date.parse(offer.created_at) < 24 * 60 * 60 * 1000,
    )
    .slice(0, 5);
}

/** Where the person knows an offer's workspace from: its name, and the page
 * that lists its conversations (a worktree's is its main checkout's). */
export type OfferWorkspace = { name: string; route: string };

/** The account's editor offers in the tray. An offer for another workspace
 * first takes the person there; its editor opens with a conversation. */
export function AccountEditorOffers({
  offers,
  editor,
  workspaceOf,
  onDismiss,
}: {
  offers: EditorOffer[];
  editor: EditorLinks | undefined;
  workspaceOf: (id: string) => OfferWorkspace | undefined;
  onDismiss: (id: string) => void;
}) {
  const navigate = useNavigate();
  return offers.map((offer) => (
    <EditorOfferCard
      key={offer.offer_id}
      offer={offer}
      state={offerState(offer, editor)}
      workspaceName={workspaceOf(offer.workspace_id)?.name}
      onOpen={() => {
        if (editor?.links) openOffer(editor.links, offer);
      }}
      onGoToWorkspace={() =>
        navigate(
          workspaceOf(offer.workspace_id)?.route ??
            `/workspaces/${encodeURIComponent(offer.workspace_id)}`,
        )
      }
      onDismiss={() => onDismiss(offer.offer_id)}
    />
  ));
}

/** Account editor offers as they arrive; they live only in this page. */
export function useAccountEditorOffers(
  identity: string | undefined,
  subscribe: ((listener: (offer: EditorOffer) => void) => () => void) | null,
) {
  const [offers, setOffers] = useState<EditorOffer[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: identity is the trigger, not an input.
  useEffect(() => setOffers([]), [identity]);
  useEffect(
    () =>
      subscribe?.((offer) => {
        if (offer.conversation_id) return;
        setOffers((before) =>
          recentEditorOffers([
            offer,
            ...before.filter((o) => o.offer_id !== offer.offer_id),
          ]),
        );
      }),
    [subscribe],
  );
  const dismiss = useCallback(
    (id: string) =>
      setOffers((before) => before.filter((o) => o.offer_id !== id)),
    [],
  );
  return { offers, dismiss };
}
