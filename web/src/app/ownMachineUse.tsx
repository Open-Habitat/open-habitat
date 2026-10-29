import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ownMachinesPath, readOwnMachines, sshTarget } from "./ownMachines";

/** What one conversation knows of the person's own machines: which ssh hosts
 * its commands named that are machines, and which of those have a connection
 * open now. */
type MachineUse = {
  /** A row met `ssh <host>`; the list is read when one first does. */
  seen: (host: string) => void;
  machines: ReadonlySet<string>;
  open: readonly string[];
};

const MachineUseContext = createContext<MachineUse>({
  seen: () => {},
  machines: new Set(),
  open: [],
});

// The connection stays open for ten minutes after the last command
// (ControlPersist); this is how long "Yhteys auki" may lag behind it.
const openPoll = 30_000;

/** Reads Omat koneet for one conversation, and only once a command in it ran
 * ssh: a conversation that never does costs nothing. A new ssh row reads it
 * again, so a connection it opened shows at once; while one this
 * conversation used is open, it is read again until the connection closes.
 * A server without the page (or a failed read) shows nothing. */
export function OwnMachineUseProvider({ children }: { children: ReactNode }) {
  const [hosts, setHosts] = useState<ReadonlySet<string>>(new Set());
  const [machines, setMachines] = useState<ReadonlySet<string>>(new Set());
  const [openNow, setOpenNow] = useState<readonly string[]>([]);
  const [reads, setReads] = useState(0);
  const pending = useRef(0);
  const read = useCallback(() => {
    // Rows that mount together ask once.
    if (pending.current) return;
    pending.current = window.setTimeout(() => {
      pending.current = 0;
      setReads((n) => n + 1);
    }, 300);
  }, []);
  useEffect(() => () => window.clearTimeout(pending.current), []);
  const seen = useCallback(
    (host: string) => {
      setHosts((previous) =>
        previous.has(host) ? previous : new Set([...previous, host]),
      );
      read();
    },
    [read],
  );
  useEffect(() => {
    if (reads === 0) return;
    const controller = new AbortController();
    void fetch(ownMachinesPath, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(readOwnMachines)
      .then((data) => {
        if (controller.signal.aborted) return;
        setMachines(new Set(data.machines.map((m) => m.name)));
        setOpenNow(
          data.machines.filter((m) => m.connection_open).map((m) => m.name),
        );
      })
      .catch(() => {});
    return () => controller.abort();
  }, [reads]);
  const open = useMemo(
    () => openNow.filter((name) => hosts.has(name)),
    [openNow, hosts],
  );
  useEffect(() => {
    if (!open.length) return;
    const timer = window.setInterval(read, openPoll);
    return () => window.clearInterval(timer);
  }, [open.length, read]);
  const value = useMemo(
    () => ({ seen, machines, open }),
    [seen, machines, open],
  );
  return (
    <MachineUseContext.Provider value={value}>
      {children}
    </MachineUseContext.Provider>
  );
}

/** The person's own machine a tool row's command ran on, if it is one.
 * `state` changing (the command finishing) reads the list again. */
export function useOwnMachine(host: string | undefined, state?: string) {
  const { seen, machines } = useContext(MachineUseContext);
  useEffect(() => {
    void state;
    if (host) seen(host);
  }, [host, state, seen]);
  return host && machines.has(host) ? host : undefined;
}

/** The ssh hosts the live turn's commands name, shown or folded: the
 * header's mark must not wait for a row to be unfolded while the agent works.
 * (Saved history carries no command text; a saved row counts once shown.)
 * A new ssh command reads the list again, and so does one finishing: the
 * connection it leaves open may not have existed when it started. */
export function useOwnMachineHosts(
  commands: readonly { command: string; done: boolean }[],
) {
  const { seen } = useContext(MachineUseContext);
  const ssh = commands.flatMap(({ command, done }) => {
    const host = sshTarget(command);
    return host ? [{ host, done }] : [];
  });
  const hosts = [...new Set(ssh.map((c) => c.host))].join(",");
  const key = `${ssh.length}:${ssh.filter((c) => c.done).length}:${hosts}`;
  useEffect(() => {
    void key;
    for (const host of hosts ? hosts.split(",") : []) seen(host);
  }, [key, hosts, seen]);
}

/** The machines this conversation used that have a connection open now. */
export function useOpenMachines() {
  return useContext(MachineUseContext).open;
}
