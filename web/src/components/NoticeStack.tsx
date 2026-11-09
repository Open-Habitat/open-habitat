import {
  createContext,
  Fragment,
  type ReactNode,
  useContext,
  useId,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { useText } from "../i18n";
import { noticeStackText } from "../text/noticeStack";
import { ControlButton } from "./ControlElements";
import {
  type WarningBannerProps,
  WarningBannerView,
  type WarningTone,
} from "./WarningBanner";
import "./NoticeStack.css";

export type NoticeLifetime = "condition" | "event" | "acknowledgement";
type Entry = {
  id: string;
  subject: string;
  kind: WarningTone;
  lifetime: NoticeLifetime;
  banner: WarningBannerProps;
};
const priority: Record<WarningTone, number> = {
  danger: 0,
  neutral: 1,
  progress: 2,
  success: 3,
};

function createNotices() {
  let entries: Entry[] = [];
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => entries,
    put(entry: Entry) {
      const index = entries.findIndex((e) => e.id === entry.id);
      entries =
        index < 0
          ? [...entries, entry]
          : entries.map((e, i) => (i === index ? entry : e));
      emit();
    },
    remove(id: string) {
      entries = entries.filter((e) => e.id !== id);
      emit();
    },
  };
}
const Notices = createContext<ReturnType<typeof createNotices> | null>(null);

/** Local presentation only. Producers retain ownership of conditions and event
 * dismissal; unmounting a producer removes its notice. No timers hide errors.
 * Only the outlet subscribes, so publishing content cannot rerender producers. */
export function NoticeStackProvider({ children }: { children: ReactNode }) {
  const [notices] = useState(createNotices);
  return <Notices.Provider value={notices}>{children}</Notices.Provider>;
}

export function NoticePlacement({
  subject,
  kind,
  lifetime = "condition",
  banner,
}: {
  subject?: string;
  kind: WarningTone;
  lifetime?: NoticeLifetime;
  banner: WarningBannerProps;
}) {
  const notices = useContext(Notices);
  const id = useId();
  useLayoutEffect(() => {
    notices?.put({ id, subject: subject ?? id, kind, lifetime, banner });
  }, [notices, id, subject, kind, lifetime, banner]);
  useLayoutEffect(() => () => notices?.remove(id), [notices, id]);
  return notices ? null : <WarningBannerView {...banner} />;
}

export function NoticeStack() {
  const notices = useContext(Notices);
  if (!notices) throw new Error("NoticeStack needs its provider");
  const entries = useSyncExternalStore(notices.subscribe, notices.snapshot);
  const [expanded, setExpanded] = useState(false);
  const t = useText(noticeStackText);
  // A cause and its consequences share a subject, one card and the strongest
  // kind. Producers supply only the additional information, not another cause.
  const groups = new Map<string, Entry[]>();
  for (const entry of entries)
    groups.set(entry.subject, [...(groups.get(entry.subject) ?? []), entry]);
  const ordered = [...groups.entries()].sort(
    (a, b) =>
      Math.min(...a[1].map((e) => priority[e.kind])) -
      Math.min(...b[1].map((e) => priority[e.kind])),
  );
  return (
    <div className="ah-notice-stack" data-testid="notice-stack">
      <Notices.Provider value={null}>
        {ordered.map(([subject, group], index) => {
          const sorted = [...group].sort(
            (a, b) => priority[a.kind] - priority[b.kind],
          );
          const first = sorted[0];
          return (
            <div
              key={subject}
              hidden={!expanded && index >= 2}
              data-notice-subject={subject}
              data-notice-lifetime={first.lifetime}
            >
              <WarningBannerView
                {...first.banner}
                short={group.length === 1 ? first.banner.short : undefined}
                actions={
                  sorted.some((e) => e.banner.actions)
                    ? sorted
                        .filter((e) => e.banner.actions)
                        .map((e) => (
                          <Fragment key={e.id}>{e.banner.actions}</Fragment>
                        ))
                    : undefined
                }
              >
                {sorted.map((e, i) => (
                  <div key={e.id}>
                    {i > 0 ? e.banner.title : null}
                    {e.banner.children}
                  </div>
                ))}
              </WarningBannerView>
            </div>
          );
        })}
      </Notices.Provider>
      {ordered.length > 2 ? (
        <ControlButton
          data-testid="notice-stack-toggle"
          size="row"
          variant="quiet"
          aria-expanded={expanded}
          onPress={() => setExpanded(!expanded)}
        >
          {expanded ? t.less : t.more(ordered.length - 2)}
        </ControlButton>
      ) : null}
    </div>
  );
}
