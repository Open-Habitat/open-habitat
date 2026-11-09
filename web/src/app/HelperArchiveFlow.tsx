import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  HelperArchiveConfirm,
  HelperArchiveRows,
  HelperBranchDialog,
} from "../components/HelperArchive";
import { Icon } from "../components/Icon";
import { useText } from "../i18n";
import { helperArchiveText } from "../text/helperArchive";
import { liveHelper, readSpinoffs, type Spinoff } from "./spinoffs";

export const HelperRestoreContext = createContext<ReadonlySet<string>>(
  new Set(),
);

function HelperBranchRead({
  agent,
  run,
  close,
}: {
  agent: string;
  run: Spinoff;
  close: () => void;
}) {
  const [result, setResult] = useState<{ run?: Spinoff }>();
  useEffect(() => {
    const controller = new AbortController();
    void readSpinoffs(
      agent,
      run.run_id,
      AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    )
      .then((reply) => {
        if (!controller.signal.aborted)
          setResult({ run: reply.runs.find((r) => r.run_id === run.run_id) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({});
      });
    return () => controller.abort();
  }, [agent, run.run_id]);
  return (
    <HelperBranchDialog
      branch={result?.run}
      loading={!result}
      onClose={close}
    />
  );
}

/** A view of Taskfleet, never an archive inventory or a second native history. */
export function ArchivedHelpers({
  agent,
  restored = false,
}: {
  agent: string;
  restored?: boolean;
}) {
  const t = useText(helperArchiveText);
  const [result, setResult] = useState<{
    agent: string;
    runs: Spinoff[];
    incomplete: boolean;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    void readSpinoffs(
      agent,
      null,
      AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    )
      .then((reply) => {
        if (!controller.signal.aborted)
          setResult({
            agent,
            runs: reply.runs.filter(liveHelper),
            incomplete: reply.availability !== "available",
          });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ agent, runs: [], incomplete: true });
      });
    return () => controller.abort();
  }, [agent]);
  if (result?.agent !== agent) return <p role="status">{t.loading}</p>;
  if (!result.runs.length && !result.incomplete) return null;
  return (
    <aside
      className={restored ? "ah-helper-restore" : undefined}
      data-testid={restored ? "helper-restore-note" : "archived-helpers"}
    >
      {restored ? (
        <p>
          <Icon name="restore" /> {t.restored}
        </p>
      ) : null}
      {result.incomplete ? <p role="status">{t.unavailable}</p> : null}
      <HelperArchiveRows
        runs={result.runs}
        restored={restored}
        branchView={(run, close) => (
          <HelperBranchRead agent={agent} run={run} close={close} />
        )}
      />
    </aside>
  );
}

export function HelperRestoreNote({ agent }: { agent: string }) {
  const restored = useContext(HelperRestoreContext);
  return restored.has(agent) ? (
    <ArchivedHelpers agent={agent} restored />
  ) : null;
}

/** Focuses the conversation's archive button once it can take focus, and
 * returns a function that gives up. The remounted button can still be
 * disabled while the turn settles, and focusing a disabled button does
 * nothing, so this keeps watching for a while. It acts only while focus is
 * on the page, and a person who clicks or types meanwhile owns focus. */
function returnFocus(trigger: HTMLElement, patience = 10000) {
  const agent = trigger.dataset.archiveAgent;
  let observer: MutationObserver | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const frame = requestAnimationFrame(() => {
    if (attempt()) return;
    observer = new MutationObserver(() => attempt());
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
    timer = setTimeout(stop, patience);
  });
  const stop = () => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
    clearTimeout(timer);
    document.removeEventListener("pointerdown", stop, true);
    document.removeEventListener("keydown", stop, true);
  };
  const attempt = () => {
    const now = document.activeElement;
    if (now && now !== document.body) {
      stop();
      return true;
    }
    const target = trigger.isConnected
      ? trigger
      : agent
        ? document.querySelector<HTMLElement>(
            `[data-archive-agent="${CSS.escape(agent)}"]`,
          )
        : null;
    if (!target || target.matches(":disabled")) return false;
    target.focus();
    if (document.activeElement !== target) return false;
    stop();
    return true;
  };
  document.addEventListener("pointerdown", stop, true);
  document.addEventListener("keydown", stop, true);
  return stop;
}

/** Only one archive question may own focus. A session change cancels both
 * the read and a pending answer; a timeout instead asks with uncertainty. */
export function useHelperArchiveConfirmation(binding: string | undefined) {
  const t = useText(helperArchiveText);
  const active = useRef<
    | {
        controller: AbortController;
        answer?: (yes: boolean) => void;
        trigger?: HTMLElement;
      }
    | undefined
  >(undefined);
  const returning = useRef<() => void>(undefined);
  const [reading, setReading] = useState<string>();
  const [question, setQuestion] = useState<{
    agent: string;
    title: string;
    binding?: string;
    runs: Spinoff[];
    incomplete: boolean;
  }>();
  const answer = (yes: boolean) => {
    const trigger = active.current?.trigger;
    active.current?.answer?.(yes);
    setQuestion(undefined);
    // A conversation can change rail section while the question is open (a
    // turn ending), which remounts its row: the dialog's own focus return
    // then finds the pressed button detached and leaves focus on the page.
    // A cancel goes back to the same conversation's button.
    if (!yes && trigger) {
      returning.current?.();
      returning.current = returnFocus(trigger);
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: A changed session must cancel the old person's pending choice.
  useEffect(
    () => () => {
      returning.current?.();
      active.current?.controller.abort();
      active.current?.answer?.(false);
      active.current = undefined;
    },
    [binding],
  );
  return {
    confirm: async (
      agent: string,
      title = "",
      onAccepted?: (runs: Spinoff[]) => void,
    ): Promise<boolean> => {
      if (active.current) return false;
      const focused = document.activeElement;
      const operation = {
        controller: new AbortController(),
        answer: undefined as ((yes: boolean) => void) | undefined,
        trigger:
          focused instanceof HTMLElement && focused !== document.body
            ? focused
            : undefined,
      };
      active.current = operation;
      setReading(binding);
      try {
        const reply = await readSpinoffs(
          agent,
          null,
          AbortSignal.any([
            operation.controller.signal,
            AbortSignal.timeout(10000),
          ]),
        ).catch(() => undefined);
        if (operation.controller.signal.aborted) return false;
        setReading(undefined);
        const runs = reply?.runs.filter(liveHelper) ?? [];
        const incomplete = reply?.availability !== "available";
        if (!incomplete && !runs.length) return true;
        setQuestion({ agent, title, binding, runs, incomplete });
        const accepted = await new Promise<boolean>((resolve) => {
          operation.answer = resolve;
        });
        if (accepted) onAccepted?.(runs);
        return accepted;
      } finally {
        if (active.current === operation) {
          active.current = undefined;
          setReading(undefined);
        }
      }
    },
    dialog: (
      <>
        {reading && reading === binding ? (
          <p role="status" data-testid="helper-archive-reading">
            {t.loading}
          </p>
        ) : null}
        {question && question.binding === binding ? (
          <HelperArchiveConfirm
            title={question.title}
            runs={question.runs}
            incomplete={question.incomplete}
            onAnswer={answer}
            branchView={(run, close) => (
              <HelperBranchRead
                agent={question.agent}
                run={run}
                close={close}
              />
            )}
          />
        ) : null}
      </>
    ),
  };
}
