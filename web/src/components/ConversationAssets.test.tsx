import { fireEvent, render, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { FileOfferSummary, OfferState } from "../app/fileOffers";
import {
  type AssetControls,
  assetEntries,
  assetId,
  ConversationAssets,
} from "./ConversationAssets";

const convo = "pi:11111111-1111-4111-8111-111111111111";
const view = (n: number, entry: string, at: string) => ({
  view_id: `v${String(n).repeat(26)}`.slice(0, 27),
  title: `Raportti ${n}`,
  entry,
  files: 1,
  bytes: 2048,
  created_at: at,
  conversation_id: convo,
});
const offer: FileOfferSummary = {
  offer_id: "fabcdefghijklmnopqrstuvwxyz",
  title: "Myyntidata",
  files: 1,
  bytes: 1024,
  created_at: "2026-11-08T10:30:00Z",
  conversation_id: convo,
};
const ready: OfferState = {
  state: "ready",
  manifest: {
    offer,
    items: [{ path: "myynti.csv", bytes: 1024, kind: "csv", lines: 3 }],
  },
};
const views = [
  view(2, "reports/q3.html", "2026-11-08T10:00:00Z"),
  view(3, "reports/q3.html", "2026-11-08T11:00:00Z"),
  view(4, "reports/muu.html", "2026-11-08T09:00:00Z"),
];

it("folds a report's versions under its newest and lists newest first", () => {
  const entries = assetEntries(views, [{ offer, state: ready }]);
  expect(entries.map((e) => e.key)).toEqual([
    views[1].view_id,
    offer.offer_id,
    views[2].view_id,
  ]);
  const first = entries[0];
  expect(first.kind === "view" && first.versions.map((v) => v.view_id)).toEqual(
    [views[1].view_id, views[0].view_id],
  );
});

it("opens a row beside, closes it with the same row and leaves a modified click to the browser", () => {
  const toggle = vi.fn();
  const controls: AssetControls = {
    openedId: offer.offer_id,
    toggle,
    href: (item) => `/tab/${assetId(item)}`,
    until: () => undefined,
    actions: () => <span data-testid="row-actions" />,
  };
  const page = render(
    <ConversationAssets
      entries={assetEntries(views, [{ offer, state: ready }])}
      controls={controls}
    />,
  );
  const chip = page.getByTestId("assets-chip");
  expect(chip.dataset.views).toBe("2");
  expect(chip.dataset.files).toBe("1");
  fireEvent.click(chip);
  const list = page.getByTestId("assets-list");
  const rows = within(list).getAllByTestId("asset-open");
  expect(rows).toHaveLength(3);
  // The open item's row is marked; its link is the item's own tab.
  expect(rows[1].getAttribute("aria-current")).toBe("true");
  expect(rows[1].getAttribute("href")).toBe(`/tab/${offer.offer_id}`);
  fireEvent.click(rows[1]);
  expect(toggle).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "file", offer }),
    rows[1],
  );
  // A modified click opens the link's tab in the browser, not the panel.
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
  });
  rows[0].dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(toggle).toHaveBeenCalledTimes(1);
  // Earlier versions unfold under the newest.
  fireEvent.click(within(list).getByTestId("asset-versions"));
  expect(within(list).getAllByTestId("asset-open-older")).toHaveLength(1);
  // Agent titles are text.
  expect(list.querySelectorAll("b,script")).toHaveLength(0);
});

it("shows nothing while the conversation has neither views nor files", () => {
  const page = render(
    <ConversationAssets
      entries={[]}
      controls={{
        toggle: () => {},
        href: () => "",
        until: () => undefined,
        actions: () => null,
      }}
    />,
  );
  expect(page.queryByTestId("assets-chip")).toBeNull();
});
