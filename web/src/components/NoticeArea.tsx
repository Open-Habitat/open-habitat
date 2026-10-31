import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** What a notice is about. A newer notice of the same kind replaces the
 * older; different kinds stack under one +N. */
export type NoticeKind =
  | "archive"
  | "trash"
  | "mode"
  | "workspace-archive"
  | "workspace-icon";

type Entry = {
  id: string;
  kind: NoticeKind;
  /** It offers an undo, which cannot wait behind a notice that only tells. */
  undo: boolean;
  element: HTMLElement;
  close: () => void;
};

type Slot = { element: HTMLElement; priority: number };

type Area = {
  /** Nearest the top bar first: notices with an undo, then the rest, each
   * newest first. */
  order: string[];
  /** The folded notices are shown. */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** The pointer or focus is somewhere in the area: every clock stops. */
  paused: boolean;
  register: (entry: Entry) => () => void;
  addSlot: (slot: Slot) => () => void;
  setPaused: (paused: { over?: boolean; focus?: boolean }) => void;
  active?: HTMLElement;
  ordered: Entry[];
};

const NoticeContext = createContext<Area | null>(null);

export function useNoticeArea() {
  return useContext(NoticeContext);
}

/** One notice area for the app: archiving, the Trash, a mode change and a
 * workspace's archiving all show here, as quiet rows inside the page's top
 * bar (proto-archive-notice-placement, round 2, Otsakerivi). AppShell holds
 * it. The notices
 * stay where their owners render them; each registers here and its row is
 * moved into the active slot, so the owner keeps its live state while the
 * route, and with it the top bar, changes underneath. */
export function NoticeAreaProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  const [focus, setFocus] = useState(false);
  // The ref is the truth the callbacks read; the state renders it.
  const current = useRef<Entry[]>([]);
  const register = useCallback((entry: Entry) => {
    const replaced = current.current.filter(
      (e) => e.kind === entry.kind && e.id !== entry.id,
    );
    current.current = [
      ...current.current.filter((e) => e.id !== entry.id),
      entry,
    ];
    setEntries(current.current);
    // The owner of a replaced notice clears its own state.
    for (const old of replaced) old.close();
    return () => {
      current.current = current.current.filter((e) => e !== entry);
      setEntries(current.current);
    };
  }, []);
  const addSlot = useCallback((slot: Slot) => {
    setSlots((current) => [...current, slot]);
    return () => setSlots((current) => current.filter((s) => s !== slot));
  }, []);
  const setPaused = useCallback(
    (paused: { over?: boolean; focus?: boolean }) => {
      if (paused.over !== undefined) setOver(paused.over);
      if (paused.focus !== undefined) setFocus(paused.focus);
    },
    [],
  );
  useEffect(() => {
    if (entries.length < 2) setOpen(false);
    // An emptied area hides, so the pointer cannot leave it: start over.
    if (entries.length) return;
    setOver(false);
    setFocus(false);
  }, [entries.length]);
  // The page's own top bar wins over the shell's; among equals the latest.
  const active = slots.reduce<Slot | undefined>(
    (best, slot) => (!best || slot.priority >= best.priority ? slot : best),
    undefined,
  )?.element;
  // A mode change that comes with a workspace's archiving must not fold the
  // undo away; its own clock waits while it is folded.
  const ordered = useMemo(
    () => [
      ...entries.filter((e) => e.undo).reverse(),
      ...entries.filter((e) => !e.undo).reverse(),
    ],
    [entries],
  );
  const area = useMemo<Area>(
    () => ({
      order: ordered.map((e) => e.id),
      open,
      setOpen,
      paused: over || focus,
      register,
      addSlot,
      setPaused,
      active,
      ordered,
    }),
    [ordered, open, over, focus, register, addSlot, setPaused, active],
  );
  return (
    <NoticeContext.Provider value={area}>{children}</NoticeContext.Provider>
  );
}

/** Where the notice rows go in a top bar. A page's own top bar registers a
 * higher priority than the shell's row above the content, which serves the
 * pages whose top bar is the page head itself. */
export function NoticeSlot({
  priority = 0,
  className,
}: {
  priority?: number;
  className?: string;
}) {
  const area = useContext(NoticeContext);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const addSlot = area?.addSlot;
  useLayoutEffect(() => {
    if (!element || !addSlot) return;
    return addSlot({ element, priority });
  }, [element, priority, addSlot]);
  const isActive = !!element && area?.active === element;
  const ordered = area?.ordered;
  // Move the rows here, newest first, touching only those out of place so
  // a row under the pointer or holding focus is not taken out and back.
  useLayoutEffect(() => {
    if (!element || !isActive || !ordered) return;
    const wanted = ordered.map((e) => e.element);
    wanted.forEach((row, i) => {
      if (element.children[i] !== row)
        element.insertBefore(row, element.children[i] ?? null);
    });
  }, [element, isActive, ordered]);
  const setPaused = area?.setPaused;
  useEffect(() => {
    if (!element || !isActive || !setPaused) return;
    const enter = () => setPaused({ over: true });
    const leave = () => setPaused({ over: false });
    const focusIn = () => setPaused({ focus: true });
    const focusOut = (event: FocusEvent) => {
      if (
        !(event.relatedTarget instanceof Node) ||
        !element.contains(event.relatedTarget)
      )
        setPaused({ focus: false });
    };
    element.addEventListener("pointerenter", enter);
    element.addEventListener("pointerleave", leave);
    element.addEventListener("focusin", focusIn);
    element.addEventListener("focusout", focusOut);
    return () => {
      element.removeEventListener("pointerenter", enter);
      element.removeEventListener("pointerleave", leave);
      element.removeEventListener("focusin", focusIn);
      element.removeEventListener("focusout", focusOut);
      setPaused({ over: false, focus: false });
    };
  }, [element, isActive, setPaused]);
  return (
    <div
      ref={setElement}
      data-testid="notice-area"
      className={`ah-notice-area${className ? ` ${className}` : ""}`}
    />
  );
}

/** Joins the area as one notice. Returns the element its row renders into
 * (absent outside an area, where the row renders in place), its place from
 * the newest, how many there are, and whether its clock must wait. */
export function useNotice(
  kind: NoticeKind,
  undo: boolean,
  onClose: () => void,
) {
  const area = useContext(NoticeContext);
  const [element] = useState(() =>
    area ? document.createElement("div") : undefined,
  );
  const id = useId();
  const close = useRef(onClose);
  close.current = onClose;
  // Its place is decided when it arrives; a later change does not move it.
  const offersUndo = useRef(undo);
  const register = area?.register;
  useLayoutEffect(() => {
    if (!element || !register) return;
    element.className = "ah-notice-item";
    const unregister = register({
      id,
      kind,
      undo: offersUndo.current,
      element,
      close: () => close.current(),
    });
    return () => {
      unregister();
      element.remove();
    };
  }, [element, register, id, kind]);
  const index = area ? Math.max(0, area.order.indexOf(id)) : 0;
  const count = area?.order.length ?? 1;
  return {
    element,
    index,
    count,
    open: area?.open ?? false,
    setOpen: area?.setOpen,
    /** Folded behind the newest: hidden, and its undo time kept. */
    folded: index > 0 && !area?.open,
    paused: area?.paused ?? false,
  };
}

/** Where focus goes when the notice holding it closes: back to the work,
 * the composer if the page has one, otherwise the page. */
export function returnFocusToWork() {
  const target =
    document.querySelector<HTMLElement>(
      "#main [data-testid='message-input']",
    ) ?? document.getElementById("main");
  target?.focus({ preventScroll: true });
}
