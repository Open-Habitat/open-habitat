import { Component, type ReactNode } from "react";
import { ConnectionBanner } from "../components/Status";
import { reloadForNewBundle } from "./bundleRelease";

// Vite reports failures of both dynamic imports and their CSS dependencies.
// Match the actual thrown value, not browser-specific error-message wording,
// so unrelated render errors still reach the ordinary error boundary.
const failedImports = new Set<unknown>();
window.addEventListener("vite:preloadError", (event) => {
  failedImports.add((event as Event & { payload: unknown }).payload);
  // Do not preventDefault: Vite must reject the import so React.lazy reaches
  // this boundary rather than receiving an undefined module.
});

export class ChunkLoadBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(error: unknown) {
    if (!failedImports.has(error)) throw error;
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <ConnectionBanner
          state="version-changed"
          onReload={reloadForNewBundle}
        />
      );
    }
    return this.props.children;
  }
}
