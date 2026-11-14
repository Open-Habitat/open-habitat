import { Component, type ReactNode } from "react";
import { ConnectionBanner } from "../components/Status";
import {
  bundleDiagnostic,
  checkBundle,
  reloadForNewBundle,
} from "./bundleRelease";

// Vite reports failures of both dynamic imports and their CSS dependencies.
// Match the actual thrown value, not browser-specific error-message wording,
// so unrelated render errors still reach the ordinary error boundary.
const failedImports = new Map<unknown, string | undefined>();
window.addEventListener("vite:preloadError", (event) => {
  const payload = (event as Event & { payload: unknown }).payload;
  failedImports.set(payload, assetPath(payload));
  // Do not preventDefault: Vite must reject the import so React.lazy reaches
  // this boundary rather than receiving an undefined module.
});

/** The asset a preload error names (its path only), for the diagnostic. */
function assetPath(payload: unknown): string | undefined {
  const message = payload instanceof Error ? payload.message : String(payload);
  return /\/assets\/[\w.-]+/.exec(message)?.[0];
}

/**
 * A lazily loaded part failed to load. A release that removed this tab's
 * chunks is one cause, a request the network or a busy server dropped is
 * another, and only the served index tells them apart: the notice says the
 * server was updated only when the index names another bundle, and otherwise
 * that a part of the page did not load.
 */
export class ChunkLoadBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; release?: "newer" | "current" | "unknown" }
> {
  state: { failed: boolean; release?: "newer" | "current" | "unknown" } = {
    failed: false,
  };

  static getDerivedStateFromError(error: unknown) {
    if (!failedImports.has(error)) throw error;
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    const asset = failedImports.get(error);
    void checkBundle().then((status) => {
      const release = status ?? "unknown";
      bundleDiagnostic({ path: "chunk-load", asset, release });
      this.setState({ release });
    });
  }

  render() {
    if (this.state.failed) {
      return (
        <div data-chunk-load-failed={this.state.release ?? "checking"}>
          <ConnectionBanner
            state={
              this.state.release === "newer" ? "version-changed" : "part-failed"
            }
            onReload={reloadForNewBundle}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
