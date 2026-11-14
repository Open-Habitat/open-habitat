import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { OfferMark } from "./OfferCard";

it("keeps compact view and file marks the same size when defaults load later", () => {
  const style = document.createElement("style");
  style.textContent = ["OfferCard.css", "FileOffer.css", "ViewPanel.css"]
    .map((file) => readFileSync(`src/components/${file}`, "utf8"))
    .join("\n");
  document.head.append(style);
  try {
    const page = render(
      <div>
        <OfferMark kind="view" size="s" />
        <OfferMark kind="folder" size="s" />
        <OfferMark kind="csv" size="s" />
        <OfferMark kind="image" size="s" />
      </div>,
    );
    for (const mark of page.container.querySelectorAll(".ah-offer-mark-s")) {
      expect(getComputedStyle(mark).width).toBe("24px");
      expect(getComputedStyle(mark).height).toBe("24px");
    }
  } finally {
    style.remove();
  }
});
