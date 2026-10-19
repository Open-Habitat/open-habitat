import { describe, expect, it } from "vitest";
import { pasteLines, tabNames, withModifiers } from "./BrowserShell";
import { TerminalSocket, terminalURL } from "./terminals";

class FakeSocket {
  static OPEN = 1;
  readyState = 0;
  binaryType = "blob";
  sent: (string | Uint8Array)[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: unknown }) => void;
  onclose?: (event: { code: number; reason: string }) => void;
  send(data: string | Uint8Array) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
}

describe("terminal socket", () => {
  it("proves the session before anything else, then sizes the terminal from the surface", () => {
    let fake!: FakeSocket;
    let size = { cols: 80, rows: 24 };
    const events: string[] = [];
    const socket = new TerminalSocket(
      "wss://host.test/x",
      "csrf-proof",
      () => size,
      {
        ready: (r) => events.push(`ready:${r.shell}`),
        data: () => events.push("data"),
        exit: (s) => events.push(`exit:${s}`),
        closed: (c) => events.push(`closed:${c}`),
      },
      () => {
        fake = new FakeSocket();
        return fake as unknown as WebSocket;
      },
    );
    (globalThis as { WebSocket?: unknown }).WebSocket ??= FakeSocket;
    socket.send("ls\r");
    expect(fake.sent).toEqual([]);
    // The surface fitted itself while the socket was connecting.
    size = { cols: 132, rows: 41 };
    fake.open();
    expect(fake.sent.slice(0, 2)).toEqual([
      JSON.stringify({ type: "auth", csrf: "csrf-proof" }),
      JSON.stringify({ type: "resize", cols: 132, rows: 41 }),
    ]);
    // Only messages the contract allows are acted on.
    fake.onmessage?.({
      data: JSON.stringify({
        type: "ready",
        shell: "3",
        read_only: false,
        survives_restart: true,
      }),
    });
    fake.onmessage?.({
      data: JSON.stringify({
        type: "ready",
        shell: "../x",
        read_only: false,
        survives_restart: true,
      }),
    });
    fake.onmessage?.({
      data: JSON.stringify({ type: "exit", state: "ended" }),
    });
    fake.onclose?.({ code: 1000, reason: "ended" });
    expect(events).toEqual(["ready:3", "exit:ended"]);
  });

  it("names a shell or a Taskfleet window, never a path", () => {
    expect(
      terminalURL(
        "ws_example123",
        { kind: "shell", shell: "new" },
        "https://h.test",
      ),
    ).toBe(
      "wss://h.test/api/v1/workspaces/terminal?workspace_id=ws_example123&shell=new",
    );
    expect(
      terminalURL(
        "ws_example123",
        { kind: "taskfleet", token: "77f5c84c-12" },
        "https://h.test",
      ),
    ).toBe(
      "wss://h.test/api/v1/workspaces/terminal?workspace_id=ws_example123&taskfleet=77f5c84c-12",
    );
  });
});

describe("shell input", () => {
  it("applies sticky Ctrl and Alt to the next key only", () => {
    expect(withModifiers("c", { ctrl: true, alt: false })).toBe("\x03");
    expect(withModifiers("[", { ctrl: true, alt: false })).toBe("\x1b");
    expect(withModifiers("b", { ctrl: false, alt: true })).toBe("\x1bb");
    // A multi-character paste is not a key: Ctrl does not mangle it.
    expect(withModifiers("ls", { ctrl: true, alt: false })).toBe("ls");
  });

  it("counts paste lines without the trailing newline a copy carries", () => {
    expect(pasteLines("a\r\nb\n\n")).toEqual(["a", "b"]);
    expect(pasteLines("one line\n")).toEqual(["one line"]);
  });

  it("tells tabs with the same window name apart", () => {
    expect(tabNames(["bash", "node", "bash", ""])).toEqual([
      "bash",
      "node",
      "bash-2",
      "bash-3",
    ]);
  });
});
