import { liveText } from "../i18n";
import { cloneProgressCopy } from "../text/cloneProgress";
import { size } from "./repoCatalog";

const txt = liveText(cloneProgressCopy);

// Percentages refer to Git stages, not to a byte total or the whole clone.
export function cloneProgressText(
  stage?: "reserving" | "connecting" | "receiving" | "checkout" | "verifying",
  percent?: number,
  received?: number,
  total?: number,
): string {
  const label =
    stage === "receiving"
      ? txt.receiving
      : stage === "checkout" || stage === "verifying"
        ? txt.finishing
        : txt.connecting;
  const progress =
    stage === "receiving" && percent !== undefined ? txt.percent(percent) : "…";
  const bytes =
    received === undefined
      ? ""
      : ` · ${size(received)}${total === undefined ? "" : ` / ${size(total)}`}`;
  return `${label}${progress}${bytes}`;
}
