import { render, screen } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { ChunkLoadBoundary } from "./ChunkLoadBoundary";

class OuterBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div data-testid="ordinary-error" />
    ) : (
      this.props.children
    );
  }
}
function Broken({ error }: { error: Error }): ReactNode {
  throw error;
}

test("only an error reported by Vite becomes a reload banner", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const error = new Error("arbitrary browser wording");
    window.dispatchEvent(
      Object.assign(new Event("vite:preloadError"), { payload: error }),
    );
    const first = render(
      <ChunkLoadBoundary>
        <Broken error={error} />
      </ChunkLoadBoundary>,
    );
    expect(screen.getByTestId("connection-reload")).toBeTruthy();
    first.unmount();

    render(
      <OuterBoundary>
        <ChunkLoadBoundary>
          <Broken
            error={new Error("Failed to fetch dynamically imported module")}
          />
        </ChunkLoadBoundary>
      </OuterBoundary>,
    );
    expect(screen.getByTestId("ordinary-error")).toBeTruthy();
    expect(screen.queryByTestId("connection-reload")).toBeNull();
  } finally {
    consoleError.mockRestore();
  }
});
