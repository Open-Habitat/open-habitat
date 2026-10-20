import { size } from "./repoCatalog";

// Percentages refer to Git stages, not to a byte total or the whole clone.
export function cloneProgressText(
  stage?: "reserving" | "connecting" | "receiving" | "checkout" | "verifying",
  percent?: number,
  received?: number,
  total?: number,
): string {
  const label =
    stage === "receiving"
      ? "Haetaan"
      : stage === "checkout" || stage === "verifying"
        ? "Viimeistellään"
        : "Yhdistetään";
  const progress =
    stage === "receiving" && percent !== undefined ? ` ${percent} %` : "…";
  const bytes =
    received === undefined
      ? ""
      : ` · ${size(received)}${total === undefined ? "" : ` / ${size(total)}`}`;
  return `${label}${progress}${bytes}`;
}
