import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import BrowserViewer from "./BrowserViewer";
import type { BrowserStatus } from "./serverBrowser";

const mocks = vi.hoisted(() => ({
  clients: [] as Array<{
    viewOnly: boolean;
    sendKey: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    emit: (name: string) => void;
  }>,
}));
vi.mock("@novnc/novnc", () => ({
  default: class {
    viewOnly = true;
    sendKey = vi.fn();
    focus = vi.fn();
    clipboardPasteFrom = vi.fn();
    disconnect = vi.fn();
    listeners = new Map<string, () => void>();
    constructor() {
      mocks.clients.push(this);
    }
    addEventListener(name: string, cb: () => void) {
      this.listeners.set(name, cb);
    }
    emit(name: string) {
      this.listeners.get(name)?.();
    }
  },
}));
vi.mock("../components/ServerBrowser", () => ({
  BrowserFrame: ({
    children,
    clipOpen,
    clipboard,
    toast,
  }: {
    children: ReactNode;
    clipOpen: boolean;
    clipboard: ReactNode;
    toast?: string;
  }) => (
    <>
      {children}
      {clipOpen && clipboard}
      {toast && <p role="status">{toast}</p>}
    </>
  ),
  BrowserClipboard: ({ canCopy }: { canCopy: boolean }) => (
    <input
      id="sb-paste-text"
      data-testid="fallback-field"
      aria-disabled={!canCopy}
    />
  ),
}));
class Socket {
  static latest: Socket;
  onopen?: () => void;
  send = vi.fn();
  close = vi.fn();
  constructor() {
    Socket.latest = this;
  }
}
const status: BrowserStatus = {
  schema_version: 1,
  state: "running",
  survives_restart: true,
  control: "agent",
  agent_connected: false,
  windows: [],
};
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  mocks.clients.length = 0;
});

it("opens the no-event fallback without taking control from the agent", () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const onTake = vi.fn(async () => true);
  render(
    <BrowserViewer
      csrf="first"
      status={status}
      busy={false}
      onTake={onTake}
      onGiveBack={async () => true}
    />,
  );
  act(() => {
    Socket.latest.onopen?.();
    mocks.clients[0].emit("connect");
  });
  fireEvent.keyDown(screen.getByTestId("browser-viewer"), {
    key: "v",
    code: "KeyV",
    ctrlKey: true,
  });
  act(() => {
    vi.advanceTimersByTime(401);
  });
  expect(
    screen.getByTestId("fallback-field").getAttribute("aria-disabled"),
  ).toBe("true");
  expect(screen.getByRole("status").textContent).not.toBe("");
  expect(onTake).not.toHaveBeenCalled();
  expect(mocks.clients[0].sendKey).not.toHaveBeenCalled();
});

it.each(["disconnect", "replacement", "unmount"])(
  "does not replay a delayed takeover after %s",
  async (loss) => {
    vi.stubGlobal("WebSocket", Socket);
    let grant!: (ok: boolean) => void;
    const onTake = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          grant = resolve;
        }),
    );
    const props = {
      csrf: "first",
      status,
      busy: false,
      onTake,
      onGiveBack: async () => true,
    };
    const view = render(<BrowserViewer {...props} />);
    act(() => {
      Socket.latest.onopen?.();
      mocks.clients[0].emit("connect");
    });
    fireEvent.keyDown(screen.getByTestId("browser-viewer"), {
      key: "a",
      code: "KeyA",
    });
    expect(onTake).toHaveBeenCalledOnce();
    const old = mocks.clients[0];
    if (loss === "unmount") view.unmount();
    else if (loss === "disconnect") act(() => old.emit("disconnect"));
    else {
      view.rerender(<BrowserViewer {...props} csrf="replacement" />);
      act(() => {
        Socket.latest.onopen?.();
        mocks.clients[1].emit("connect");
      });
    }
    await act(async () => {
      grant(true);
    });
    for (const client of mocks.clients) {
      expect(client.sendKey).not.toHaveBeenCalled();
      expect(client.viewOnly).toBe(true);
    }
  },
);
