import type { ViewSummary } from "../components/ViewOffer";
import type { FileOfferSummary } from "./fileOffers";
import type { Agent, Snapshot } from "./snapshot";
import { isPublic, type ViewAddress } from "./viewLinks";

export type Share = {
  address: ViewAddress;
  item?: ViewSummary | FileOfferSummary;
  conversation?: Agent;
};
export type ShareGroup = {
  id: string;
  conversation?: Agent;
  changed: string;
  rows: Share[];
};
export function shareCategory(s: Share): "public" | "private" | "past" {
  return !s.item ||
    s.address.state === "expired" ||
    (s.address.state === "public" && !isPublic(s.address))
    ? "past"
    : isPublic(s.address)
      ? "public"
      : "private";
}
export function groupShares(
  addresses: ViewAddress[],
  items: (ViewSummary | FileOfferSummary)[],
  snapshot: Pick<Snapshot, "agents">,
): ShareGroup[] {
  const byItem = new Map(
    items.map((item) => [
      "view_id" in item ? item.view_id : item.offer_id,
      item,
    ]),
  );
  const agents = new Map(snapshot.agents.map((a) => [a.agent_id, a]));
  const groups = new Map<string, ShareGroup>();
  for (const address of addresses) {
    const item = byItem.get(address.view_id ?? address.offer_id ?? "");
    const conversation = item?.conversation_id
      ? agents.get(item.conversation_id)
      : undefined;
    const id = item ? (item.conversation_id ?? address.address_id) : "removed";
    let group = groups.get(id);
    if (!group) {
      group = {
        id,
        conversation,
        changed: conversation?.changed_at ?? address.created_at,
        rows: [],
      };
      groups.set(id, group);
    }
    if (!conversation?.changed_at && address.created_at > group.changed)
      group.changed = address.created_at;
    group.rows.push({ address, item, conversation });
  }
  return [...groups.values()]
    .sort(
      (a, b) =>
        Number(a.id === "removed") - Number(b.id === "removed") ||
        b.changed.localeCompare(a.changed) ||
        a.id.localeCompare(b.id),
    )
    .map((g) => ({
      ...g,
      rows: g.rows.sort(
        (a, b) =>
          b.address.created_at.localeCompare(a.address.created_at) ||
          a.address.address_id.localeCompare(b.address.address_id),
      ),
    }));
}
