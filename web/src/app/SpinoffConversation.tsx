import { type ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { SpinoffContext, SpinoffReadOnly } from "../components/Spinoffs";
import { readSpinoffs, type Spinoffs } from "./spinoffs";
// An incomplete read is not proof that a run vanished: Taskfleet keeps
// settled runs. Keep the runs it did not mention until a complete read.
export function keepKnownRuns(previous: Spinoffs | undefined, next: Spinoffs) {
  if (next.availability === "available" || !previous) return next;
  const seen = new Set(next.runs.map((r) => r.run_id));
  return {
    ...next,
    runs: [
      ...next.runs,
      ...previous.runs.filter((r) => !seen.has(r.run_id)),
    ].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}
export function SpinoffProvider({
  parent,
  onLogin,
  children,
}: {
  parent?: string;
  onLogin?: () => void;
  children: ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const run = new URLSearchParams(location.search).get("spinoff");
  const [data, setData] = useState<Spinoffs>();
  const [stale, setStale] = useState(false);
  useEffect(() => {
    setData(undefined);
    setStale(false);
    if (!parent) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const next = await readSpinoffs(parent, run, controller.signal);
        if (!controller.signal.aborted) {
          setData((previous) => keepKnownRuns(previous, next));
          setStale(false);
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setStale(true);
          if (e instanceof Error && e.message === "identity_lost") {
            setData(undefined);
            onLogin?.();
          }
        }
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(load, 3000);
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [parent, run, onLogin]);
  const route = (id?: string) => {
    const q = new URLSearchParams(location.search);
    if (id) q.set("spinoff", id);
    else q.delete("spinoff");
    navigate(`${location.pathname}?${q}`);
  };
  const selected = data?.runs.find((r) => r.run_id === run);
  return (
    <SpinoffContext.Provider
      value={{ data, stale, open: (r) => route(r.run_id) }}
    >
      {run ? (
        <SpinoffReadOnly
          run={selected}
          transcripts={data?.transcripts ?? []}
          stale={stale || data?.availability !== "available"}
          onParent={() => route()}
        />
      ) : (
        children
      )}
    </SpinoffContext.Provider>
  );
}
