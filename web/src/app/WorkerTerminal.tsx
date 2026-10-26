import { useEffect, useRef, useState } from "react";
import { type TerminalHandle, TerminalSurface } from "../components/Terminal";
import {
  type TerminalReady,
  TerminalSocket,
  terminalRefusal,
  terminalURL,
} from "./terminals";

/**
 * A live worker's Taskfleet window, watched read-only inside its view. The
 * daemon redraws the pane; nothing typed here reaches the window, and a lost
 * connection is tried again while the view is open. A refusal (the window has
 * closed, or the terminal route does not find it under this workspace) says
 * so and stays.
 */
export function WorkerTerminal({
  workspaceId,
  token,
  csrf,
  onLogin,
}: {
  workspaceId: string;
  token: string;
  csrf: string;
  onLogin?: () => void;
}) {
  const terminal = useRef<TerminalHandle>(null);
  const held = useRef<Uint8Array[] | undefined>([]);
  const size = useRef({ cols: 80, rows: 24 });
  const [ready, setReady] = useState<TerminalReady>();
  const [surface, setSurface] = useState(0);
  const [problem, setProblem] = useState<string>();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let socket: TerminalSocket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let alive = true;
    const connect = () => {
      held.current = [];
      setSurface((n) => n + 1);
      socket = new TerminalSocket(
        terminalURL(workspaceId, { kind: "taskfleet", token }),
        csrf,
        () => size.current,
        {
          ready: (r) => {
            attempts = 0;
            setOffline(false);
            setProblem(undefined);
            setReady(r);
          },
          data: (bytes) => {
            if (held.current) held.current.push(bytes);
            else terminal.current?.write(bytes);
          },
          exit: () => {
            if (alive) setProblem("Workerin pääte sulkeutui.");
          },
          closed: (code, reason) => {
            if (!alive) return;
            if (code === 4401) {
              onLogin?.();
              return;
            }
            if (code >= 4000 && code < 5000) {
              setProblem(
                reason === "shell_ended"
                  ? "Workerin päätettä ei löytynyt tästä työtilasta."
                  : terminalRefusal(code, reason),
              );
              return;
            }
            setOffline(true);
            timer = setTimeout(connect, Math.min(10_000, 1000 * 2 ** attempts));
            attempts += 1;
          },
        },
      );
    };
    connect();
    return () => {
      alive = false;
      clearTimeout(timer);
      socket?.close();
    };
  }, [workspaceId, token, csrf, onLogin]);
  if (problem)
    return (
      <p
        className="ah-worker-terminal-problem"
        data-testid="worker-terminal-problem"
        role="status"
      >
        {problem}
      </p>
    );
  return (
    <TerminalSurface
      key={surface}
      ref={terminal}
      label="Workerin pääte (vain luku)"
      readOnly
      offline={offline}
      fixedSize={
        ready?.cols && ready.rows
          ? { cols: ready.cols, rows: ready.rows }
          : undefined
      }
      onData={() => {}}
      onResize={(cols, rows) => {
        size.current = { cols, rows };
      }}
      onSelection={() => {}}
      onPasteRequest={() => {}}
      onOpen={() => {
        for (const bytes of held.current ?? []) terminal.current?.write(bytes);
        held.current = undefined;
      }}
    />
  );
}
