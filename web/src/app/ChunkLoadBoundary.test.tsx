import { render, screen } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { checkBundle } from "./bundleRelease";
import { ChunkLoadBoundary } from "./ChunkLoadBoundary";

vi.mock("./bundleRelease", async (original) => ({
  ...(await original<typeof import("./bundleRelease")>()),
  checkBundle: vi.fn(async () => "current" as const),
}));

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

test("only an error reported by Vite becomes a reload banner", async () => {
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
    await screen.findByTestId("connection-part-failed");
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

// A chunk that did not load is a release only when the served index names
// another bundle; otherwise the notice must not claim an update.
test.each([
  ["newer", "connection-version-changed"],
  ["current", "connection-part-failed"],
  [undefined, "connection-part-failed"],
] as const)(
  "a failed chunk with served index %s shows %s and says why in the console",
  async (release, shown) => {
    vi.mocked(checkBundle).mockResolvedValueOnce(release);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const error = new Error(
        "Failed to fetch dynamically imported module: https://host.example/assets/Editor-abc123.js",
      );
      window.dispatchEvent(
        Object.assign(new Event("vite:preloadError"), { payload: error }),
      );
      render(
        <ChunkLoadBoundary>
          <Broken error={error} />
        </ChunkLoadBoundary>,
      );
      expect(await screen.findByTestId(shown)).toBeTruthy();
      const line = consoleWarn.mock.calls.find((c) => c[0] === "[bundle]");
      expect(JSON.parse(String(line?.[1]))).toMatchObject({
        path: "chunk-load",
        asset: "/assets/Editor-abc123.js",
        release: release ?? "unknown",
      });
    } finally {
      consoleError.mockRestore();
      consoleWarn.mockRestore();
    }
  },
);
