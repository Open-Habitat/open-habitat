import type { ViewSummary } from "../components/ViewOffer";
import type { FileOfferSummary } from "./fileOffers";
import type { Agent, Snapshot } from "./snapshot";
import { isPublic, type ViewAddress } from "./viewLinks";

export type Share = {
  address?: ViewAddress;
  item?: ViewSummary | FileOfferSummary;
  conversation?: Agent;
};
export type ShareGroup = {
  id: string;
  conversation?: Agent;
  changed: string;
  rows: Share[];
};
export const outputItemID = (s: Share) =>
  s.item
    ? "view_id" in s.item
      ? s.item.view_id
      : s.item.offer_id
    : (s.address?.view_id ?? s.address?.offer_id ?? "");
export const outputID = (s: Share) =>
  outputItemID(s) || s.address?.address_id || "";
export const outputTitle = (s: Share) =>
  s.item?.title ?? s.address?.title ?? "";
export const outputCreated = (s: Share) =>
  s.item?.created_at ?? s.address?.created_at ?? "";
export function shareCategory(s: Share): "public" | "private" | "past" {
  return !s.item ||
    s.address?.state === "expired" ||
    (s.address?.state === "public" && !isPublic(s.address))
    ? "past"
    : s.address && isPublic(s.address)
      ? "public"
      : "private";
}

/** Native outputs are the inventory; an address is an optional property.
 * Retain addresses whose target was removed so the owner can still delete them. */
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
  const rows: Share[] = addresses.map((address) => {
    const id = address.view_id ?? address.offer_id ?? "";
    const item = byItem.get(id);
    byItem.delete(id);
    return { address, item };
  });
  rows.push(...[...byItem.values()].map((item) => ({ item })));
  const agents = new Map(snapshot.agents.map((a) => [a.agent_id, a]));
  const groups = new Map<string, ShareGroup>();
  for (const row of rows) {
    const conversation = row.item?.conversation_id
      ? agents.get(row.item.conversation_id)
      : undefined;
    row.conversation = conversation;
    const id = row.item
      ? (row.item.conversation_id ?? outputID(row))
      : "removed";
    let group = groups.get(id);
    const created = outputCreated(row);
    if (!group) {
      group = {
        id,
        conversation,
        changed: conversation?.changed_at ?? created,
        rows: [],
      };
      groups.set(id, group);
    }
    if (!conversation?.changed_at && created > group.changed)
      group.changed = created;
    group.rows.push(row);
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
          outputCreated(b).localeCompare(outputCreated(a)) ||
          outputID(a).localeCompare(outputID(b)),
      ),
    }));
}
