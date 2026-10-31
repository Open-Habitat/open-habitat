import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Dialog, DialogTrigger, Heading, Popover } from "react-aria-components";
import { ControlButton, controlClassName } from "./ControlElements";
import { Icon, type IconName } from "./Icon";
import "./StatusBell.css";

// The top bar's bell (proto-notification-bell, direction Tila): it is there
// only while an account- or server-wide condition holds, and it says what
// holds now. Nothing is stored, seen or dismissed; an item leaves when its
// condition clears on the host. Conversation events stay in the conversation.

export type StatusTone = "danger" | "warning" | "info";

export type StatusAction = {
  label: string;
  testId?: string;
  primary?: boolean;
  icon?: IconName;
  /** A page elsewhere (GitHub), opened in a new tab. */
  href?: string;
  onPress?: () => void;
  /** The action changes the condition in place (a recheck): the panel stays. */
  keepOpen?: boolean;
};

export type StatusItem = {
  /** Which condition this is; also its data-key. */
  key: string;
  tone: StatusTone;
  icon: IconName;
  /** The person's own account, or the server (administrators only). */
  group: "own" | "server";
  /** The words the bell shows for a serious item, without opening it. */
  short: string;
  title: string;
  meta?: string;
  body: string;
  actions: StatusAction[];
  /** Facts the item carries as data attributes, for tests and styling. */
  data?: Record<string, string>;
};

const rank: Record<StatusTone, number> = { danger: 0, warning: 1, info: 2 };

/** What holds now, provided once by the app and read wherever a bell sits. */
export const StatusItems = createContext<StatusItem[]>([]);

export function StatusBellProvider({
  items,
  children,
}: {
  items: StatusItem[];
  children: ReactNode;
}) {
  return <StatusItems.Provider value={items}>{children}</StatusItems.Provider>;
}

function ItemAction({
  action,
  danger,
  close,
}: {
  action: StatusAction;
  danger: boolean;
  close: () => void;
}) {
  const variant = action.primary
    ? danger
      ? "danger"
      : "primary"
    : "secondary";
  const content = (
    <>
      {action.icon ? <Icon name={action.icon} width={14} height={14} /> : null}
      {action.label}
    </>
  );
  if (action.href)
    return (
      <a
        data-testid={action.testId}
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        className={controlClassName({ variant, size: "row", text: true })}
        onClick={close}
      >
        {content}
      </a>
    );
  return (
    <ControlButton
      data-testid={action.testId}
      size="row"
      variant={variant}
      onPress={() => {
        if (!action.keepOpen) close();
        action.onPress?.();
      }}
    >
      {content}
    </ControlButton>
  );
}

function Item({ item, close }: { item: StatusItem; close: () => void }) {
  const data = Object.fromEntries(
    Object.entries(item.data ?? {}).map(([k, v]) => [`data-${k}`, v]),
  );
  return (
    <article
      {...data}
      className="ah-bell-item"
      data-testid="status-item"
      data-key={item.key}
      data-tone={item.tone}
    >
      <span className="ah-bell-item-icon">
        <Icon name={item.icon} />
      </span>
      <h3>{item.title}</h3>
      {item.meta ? (
        <span className="ah-bell-item-meta">{item.meta}</span>
      ) : null}
      <p>{item.body}</p>
      {item.actions.length ? (
        <div className="ah-bell-item-actions">
          {item.actions.map((action) => (
            <ItemAction
              key={action.label}
              action={action}
              danger={item.tone === "danger"}
              close={close}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

/** The bell and its panel. Absent while nothing holds; while open it stays
 * until closed, so a condition resolved from the panel is seen to go. */
export function StatusBell({ items: given }: { items?: StatusItem[] }) {
  const provided = useContext(StatusItems);
  const items = [...(given ?? provided)].sort(
    (a, b) => rank[a.tone] - rank[b.tone],
  );
  const [open, setOpen] = useState(false);
  // The bell swings once when a condition arrives that was not there before.
  const [rings, setRings] = useState(0);
  const known = useRef<Set<string>>(new Set());
  const keys = items.map((i) => i.key).join(" ");
  useEffect(() => {
    const now = new Set(keys ? keys.split(" ") : []);
    if ([...now].some((k) => !known.current.has(k))) setRings((r) => r + 1);
    known.current = now;
  }, [keys]);
  if (!items.length && !open) return null;
  const danger = items.find((i) => i.tone === "danger");
  const n = items.length;
  const label = `Ilmoitukset: ${n ? `${n} voimassa` : "ei voimassa olevia"}${danger ? `, ${danger.short}` : ""}`;
  const groups = [...new Set(items.map((i) => i.group))];
  const close = () => setOpen(false);
  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <ControlButton
        data-testid="status-bell"
        data-tone={danger ? "danger" : n ? "neutral" : "clear"}
        data-count={n}
        size="row"
        variant={danger ? "danger-subtle" : "quiet"}
        presentation={danger ? undefined : "icon"}
        className={`ah-bell${danger ? " ah-bell-serious" : ""}`}
        aria-label={label}
        title={label}
      >
        {/* A new key restarts the swing for each arrival. */}
        <Icon
          key={rings}
          name="bell"
          className={rings ? "ah-bell-icon ah-bell-ring" : "ah-bell-icon"}
        />
        {danger ? (
          <span className="ah-bell-words" aria-hidden="true">
            {danger.short}
          </span>
        ) : null}
        {n && (!danger || n > 1) ? (
          <span className="ah-bell-count" aria-hidden="true">
            {n}
          </span>
        ) : null}
      </ControlButton>
      <Popover
        placement="bottom end"
        className="ah-popover ah-bell-popover"
        offset={6}
      >
        <Dialog
          className="ah-bell-panel"
          data-testid="status-panel"
          aria-label="Ilmoitukset"
        >
          <header className="ah-bell-head">
            <Heading slot="title" level={2}>
              Ilmoitukset
            </Heading>
          </header>
          {n ? (
            groups.map((group) => (
              <section
                key={group}
                aria-label={group === "own" ? "Sinun" : "Palvelin"}
              >
                {groups.length > 1 ? (
                  <h3 className="ah-bell-group">
                    {group === "own" ? "Sinun" : "Palvelin"}
                  </h3>
                ) : null}
                {items
                  .filter((i) => i.group === group)
                  .map((item) => (
                    <Item key={item.key} item={item} close={close} />
                  ))}
              </section>
            ))
          ) : (
            <p className="ah-bell-empty" data-testid="status-empty">
              Kaikki kunnossa. Kello katoaa, kun suljet tämän.
            </p>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
