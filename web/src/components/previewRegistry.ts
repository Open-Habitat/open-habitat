import { lazy } from "react";
import { checkStartPage } from "../app/startPageCheck";
import type { PreviewInput, PreviewLocator } from "./previewInput";

/** Ordered built-ins only. First match is the sole candidate, even if it declines. */
export const previewRenderers = [
  {
    id: "start-page" as const,
    label: "startPage" as const,
    match: (locator: PreviewLocator) =>
      locator.root === "workspace" && locator.path === ".agents/start-page.md",
    read: (
      input: PreviewInput,
      context: { workspace: string; csrf: string },
      signal: AbortSignal,
    ) => checkStartPage(context.workspace, input.text, context.csrf, signal),
    View: lazy(() => import("./StartPagePreview")),
  },
];
export function choosePreviewRenderer(locator: PreviewLocator) {
  return previewRenderers.find((entry) => entry.match(locator));
}
