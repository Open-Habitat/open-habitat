import { useEffect, useSyncExternalStore } from "react";

// Replying to a view or file offer card (reply-view-file, Jari 27.11.2026;
// behind the reply-to-message switch). The opened conversation provides it;
// the offer cards in the conversation and the file list in the panel beside
// it, which lives outside the conversation's tree, both read it. An offer
// can be answered only where the conversation's own history holds its
// native notice: the daemon resolves the reply from that entry and refuses
// any other.

export type OfferReplyTarget = { offerId: string; path?: string };

export type OfferReplyControl = {
  /** The conversation that provides it. */
  agent: string;
  /** This conversation's history holds the offer's native notice. */
  can: (offerId: string) => boolean;
  /** Puts the offer (or one file of it) in the field's quote. */
  reply: (target: OfferReplyTarget) => void;
  /** What the field's quote answers now, when it is an offer. */
  active?: OfferReplyTarget;
};

let current: OfferReplyControl | undefined;
const listeners = new Set<() => void>();

function set(next: OfferReplyControl | undefined) {
  current = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The conversation's offer replies while it is open; undefined turns them
 * off (the switch, or a conversation the person does not control). */
export function useProvideOfferReply(control: OfferReplyControl | undefined) {
  useEffect(() => {
    set(control);
    return () => {
      if (current === control) set(undefined);
    };
  }, [control]);
}

export function useOfferReply(): OfferReplyControl | undefined {
  return useSyncExternalStore(subscribe, () => current);
}

/** Whether a reply control for this offer is pressed now. */
export function offerReplyActive(
  control: OfferReplyControl | undefined,
  offerId: string,
  path?: string,
) {
  return (
    control?.active?.offerId === offerId &&
    (control.active.path ?? "") === (path ?? "")
  );
}
