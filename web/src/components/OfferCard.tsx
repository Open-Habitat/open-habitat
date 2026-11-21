import "./OfferCard.css";
import "./ChoiceMenu.css";
import {
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Menu, MenuTrigger, Popover } from "react-aria-components";
import type { FileKind } from "../app/fileOffers";
import { daysLabel, defaultExpiry, expiryChoices } from "../app/viewLinks";
import { liveText } from "../i18n";
import { offerCardText } from "../text/offerCard";
import { viewLinksText } from "../text/viewLinks";
import {
  ControlButton,
  ControlMenuItem,
  controlClassName,
} from "./ControlElements";
import { Icon, type IconName } from "./Icon";
import { TooltipLink } from "./QuickTooltip";
import { CopyButton } from "./ViewLink";
import { formatUntil, type ViewVisibility } from "./ViewOffer";

// One card for every kind an agent offers (proto-offer-cards-consistent,
// rounds 1-3: Kortti, Viereen, Kulma). The whole card is one press that opens
// its item in the right-hand panel; the same press on the open card closes
// it. The card's own icons (publish, own tab, download) sit in its top-right
// corner under the pointer and on keyboard focus, and on a touch screen they
// are always there as the card's last row. Buttons cannot sit inside a
// button, so the card's press is a layer beneath them. Titles, names and
// folders are agent data, shown as text, never markup.
//
// The title is selectable text (offer-card-title-copy, direction 1 Valinta,
// Jari 21.11.2026): people quote it when they answer the agent. It is the
// one part of the card that takes the pointer itself; a click on it that
// selects nothing still opens the card, after the double-click interval so
// that selecting a word does not open and close the panel.

const txt = liveText(offerCardText);
const linkTxt = liveText(viewLinksText);

/** What a card or a list row shows its mark for. */
export type OfferKind = "view" | FileKind | "folder";

type KindInfo = {
  icon: IconName;
  group: "media" | "document" | "data" | "other";
};

const kinds: Record<FileKind | "folder", KindInfo> = {
  image: { icon: "image", group: "media" },
  svg: { icon: "image", group: "media" },
  video: { icon: "film", group: "media" },
  audio: { icon: "music", group: "media" },
  markdown: { icon: "file", group: "document" },
  pdf: { icon: "file", group: "document" },
  docx: { icon: "file", group: "document" },
  pptx: { icon: "file", group: "document" },
  xlsx: { icon: "table", group: "data" },
  csv: { icon: "table", group: "data" },
  code: { icon: "code", group: "data" },
  text: { icon: "file", group: "data" },
  zip: { icon: "package", group: "other" },
  file: { icon: "file", group: "other" },
  folder: { icon: "folder", group: "other" },
};

/** The production marks: `</>` for a view, the file kind's icon otherwise. */
export function OfferMark({
  kind,
  size = "m",
}: {
  kind: OfferKind;
  size?: "m" | "s";
}) {
  if (kind === "view")
    return (
      <span
        className={`ah-view-offer-mark ah-offer-mark-${size}`}
        aria-hidden="true"
      >
        {"</>"}
      </span>
    );
  return (
    <span
      className={`ah-file-offer-mark ah-offer-mark-${size}`}
      data-group={kinds[kind].group}
      aria-hidden="true"
    >
      <Icon name={kinds[kind].icon} />
    </span>
  );
}

/** Who sees the item: a lock for the person only, a globe while public. */
export function OfferSeen({
  until,
  words = false,
}: {
  until?: string;
  words?: boolean;
}) {
  const label = until ? txt.publicUntil(formatUntil(until)) : txt.onlyYou;
  const icon = <Icon name={until ? "globe" : "lock"} />;
  return words ? (
    <span className="ah-offer-seen" data-public={until ? "true" : undefined}>
      {icon}
      <span>{label}</span>
    </span>
  ) : (
    <span
      className="ah-offer-seen"
      data-public={until ? "true" : undefined}
      role="img"
      title={label}
      aria-label={label}
    >
      {icon}
    </span>
  );
}

const day = 24 * 60 * 60 * 1000;

/** The publication's end as a control: it opens the lengths the site
 * allows, each with the day it would end. A choice applies at once and
 * counts from now (proto-view-offer-card-r3, riff A). */
function DurationMenu({ visibility }: { visibility: ViewVisibility }) {
  const until = visibility.until ?? "";
  const [now, setNow] = useState(Date.now);
  const choices = expiryChoices(visibility.maxDays).map((days) => ({
    days,
    label:
      days === visibility.maxDays && days > 30
        ? linkTxt.atMost(daysLabel(days))
        : daysLabel(days),
    ends: formatUntil(new Date(now + days * day)),
  }));
  const current = choices.find((c) => c.ends === formatUntil(until));
  return (
    <MenuTrigger
      onOpenChange={(open) => {
        if (open) setNow(Date.now());
      }}
    >
      <ControlButton
        size="row"
        variant="quiet"
        className="ah-view-offer-until"
        data-testid="view-public-until"
        aria-label={txt.untilHint(formatUntil(until))}
        isDisabled={visibility.pending || visibility.unknown}
      >
        {formatUntil(until)}
        <span aria-hidden="true" className="ah-menu-chevron" />
      </ControlButton>
      <Popover
        placement="bottom end"
        className="ah-popover ah-view-offer-durations"
      >
        <p className="ah-view-offer-durations-head">
          {txt.durationHead(formatUntil(until))}
        </p>
        <Menu
          aria-label={txt.duration}
          selectionMode="single"
          selectedKeys={[current ? String(current.days) : "current"]}
          onAction={(key) => {
            if (key !== "current") visibility.onDuration(Number(key));
          }}
        >
          {!current && (
            <ControlMenuItem
              id="current"
              className="ah-single-choice-item"
              data-testid="view-duration-current"
              textValue={txt.until(formatUntil(until))}
            >
              <span className="ah-single-choice-mark" aria-hidden="true">
                ✓
              </span>
              <span className="ah-view-offer-duration">
                {txt.until(formatUntil(until))}
              </span>
            </ControlMenuItem>
          )}
          {choices.map((c) => (
            <ControlMenuItem
              key={c.days}
              id={String(c.days)}
              className="ah-single-choice-item"
              data-testid={`view-duration-${c.days}`}
              textValue={c.label}
            >
              {({ isSelected }) => (
                <>
                  <span className="ah-single-choice-mark" aria-hidden="true">
                    {isSelected ? "✓" : ""}
                  </span>
                  <span className="ah-view-offer-duration">{c.label}</span>
                  <span className="ah-view-offer-duration-ends">
                    {txt.until(c.ends)}
                  </span>
                </>
              )}
            </ControlMenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

/** Where an item downloads and under which name. */
export type OfferDownload = { href: string; name: string; label: string };

/** The item's own icons, the same on the card, in the conversation's list
 * and in the panel's top bar. The globe publishes at once for the site's
 * default length, as the view card's Julkinen switch did; while public the
 * date opens the lengths and the link icon copies the address. Kinds the
 * host cannot publish carry no globe. */
export function OfferActions({
  label,
  publish,
  onTab,
  download,
  children,
}: {
  /** The item's title, for the controls' accessible names. */
  label: string;
  publish?: ViewVisibility;
  onTab?: () => void;
  download?: OfferDownload;
  /** Further icons after these, such as the list's way back to the card. */
  children?: ReactNode;
}) {
  const shown = !!publish?.public && !publish.unknown;
  return (
    // biome-ignore lint/a11y/useSemanticElements: A labelled group of icon buttons, not a form fieldset.
    <span
      className="ah-offer-icons"
      data-testid="offer-actions"
      role="group"
      aria-label={txt.actions(label)}
    >
      {publish ? (
        <ControlButton
          size="row"
          variant="quiet"
          className="ah-offer-ib"
          data-testid="view-public"
          data-public={shown || undefined}
          aria-pressed={publish.public}
          aria-label={txt.public}
          title={
            publish.unknown
              ? txt.unknownHint
              : shown && publish.until
                ? txt.publicHint(formatUntil(publish.until))
                : txt.privateHint(daysLabel(defaultExpiry(publish.maxDays)))
          }
          isDisabled={publish.pending || publish.unknown}
          onPress={() => publish.onPublic(!publish.public)}
        >
          <Icon name="globe" />
        </ControlButton>
      ) : null}
      {shown && publish?.until ? <DurationMenu visibility={publish} /> : null}
      {shown && publish?.url ? (
        <CopyButton iconOnly text={publish.url} data-testid="view-copy-link" />
      ) : null}
      {onTab ? (
        <ControlButton
          size="row"
          variant="quiet"
          className="ah-offer-ib"
          data-testid="offer-open-tab"
          aria-label={txt.openTab}
          title={txt.openTab}
          onPress={onTab}
        >
          <Icon name="external" />
        </ControlButton>
      ) : null}
      {download ? (
        <TooltipLink
          data-testid="offer-download"
          className={`${controlClassName({
            variant: "quiet",
            size: "row",
            presentation: "icon",
          })} ah-offer-ib`}
          href={download.href}
          download={download.name}
          aria-label={download.label}
          title={download.label}
        >
          <Icon name="download" />
        </TooltipLink>
      ) : null}
      {children}
    </span>
  );
}

/** How long a click on the title waits for a second click before it opens
 * the card. A double-click selects a word instead. */
const TITLE_OPEN_DELAY_MS = 300;

/** The selection lies at least partly in `el`. */
function selectionIn(el: Element) {
  const sel = document.getSelection();
  return !!sel && !sel.isCollapsed && sel.containsNode(el, true);
}

type Point = [Node, number];

function titleOf(node: Node | null) {
  const el = node instanceof Element ? node : node?.parentElement;
  return el?.closest<HTMLElement>(".ah-offer-title") ?? null;
}

/** The start or end of the title's line at height `y`, found from the
 * characters' own boxes: a caret lookup beside the text would resolve to
 * the card's press or the icons' free corner instead. Titles are short
 * plain text. */
function lineEdge(title: HTMLElement, y: number, end: boolean): Point | null {
  const text = document
    .createTreeWalker(title, NodeFilter.SHOW_TEXT)
    .nextNode();
  if (!(text instanceof Text)) return null;
  const range = document.createRange();
  const n = text.length;
  for (let k = 0; k < n; k++) {
    const i = end ? n - 1 - k : k;
    range.setStart(text, i);
    range.setEnd(text, i + 1);
    const r = range.getBoundingClientRect();
    if (r.height && y >= r.top && y < r.bottom) return [text, end ? i + 1 : i];
  }
  return null;
}

/** The text position under a point, where the browser can tell. */
function caretAt(x: number, y: number): Point | null {
  const d = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y);
    return p ? [p.offsetNode, p.offset] : null;
  }
  const r = d.caretRangeFromPoint?.(x, y);
  return r ? [r.startContainer, r.startOffset] : null;
}

/** The start or end of the title's text, whichever side `p` lies on. */
function domEdge(title: HTMLElement, p: Point): Point {
  const range = document.createRange();
  range.selectNodeContents(title);
  return range.comparePoint(p[0], p[1]) < 0
    ? [title, 0]
    : [title, title.childNodes.length];
}

/** Where a selection dragged from a title to (x, y) ends in the title, or
 * null while the pointer is over the title's text, where the browser's own
 * choice stands. Elsewhere the browser resolves the point to the card's
 * press beneath, which comes first in the card, so the selection jumped
 * back to the icon in the prototype. Beside a line the selection runs to
 * that line's end, below the title to its end, above to its start. */
function pointerEdge(title: HTMLElement, x: number, y: number): Point | null {
  const under = document.elementFromPoint(x, y);
  if (under && title.contains(under)) return null;
  const r = title.getBoundingClientRect();
  const start: Point = [title, 0];
  const end: Point = [title, title.childNodes.length];
  if (y >= r.bottom) return end;
  if (y < r.top) return start;
  const toEnd = x >= r.left;
  return lineEdge(title, y, toEnd) ?? (toEnd ? end : start);
}

// A drag or click that began in a title: where the selection began and
// where the pointer is. Kept a moment after the button is released, because
// the browser's last selection update arrives after it.
let titleDrag: {
  title: HTMLElement;
  anchor: Point | null;
  x: number;
  y: number;
  until: number;
} | null = null;

const samePoint = (a: Point, node: Node | null, offset: number) =>
  a[0] === node && a[1] === offset;

function keepSelectionInTitle() {
  const sel = document.getSelection();
  if (!sel) return;
  const drag =
    titleDrag && performance.now() < titleDrag.until ? titleDrag : null;
  if (drag) {
    const { title } = drag;
    const inTitle = (n: Node | null) => !!n && title.contains(n);
    const target = pointerEdge(title, drag.x, drag.y);
    if (!target) {
      if (!drag.anchor && inTitle(sel.anchorNode) && sel.anchorNode)
        drag.anchor = [sel.anchorNode, sel.anchorOffset];
      // A word, line or paragraph the browser extended past the title: a
      // triple-click selects the title as a block, from or to the edges of
      // its neighbours.
      if (
        sel.isCollapsed ||
        !sel.anchorNode ||
        !sel.focusNode ||
        (inTitle(sel.anchorNode) && inTitle(sel.focusNode)) ||
        !sel.containsNode(title, true)
      )
        return;
      const from: Point = inTitle(sel.anchorNode)
        ? [sel.anchorNode, sel.anchorOffset]
        : domEdge(title, [sel.anchorNode, sel.anchorOffset]);
      const to: Point = inTitle(sel.focusNode)
        ? [sel.focusNode, sel.focusOffset]
        : domEdge(title, [sel.focusNode, sel.focusOffset]);
      sel.setBaseAndExtent(from[0], from[1], to[0], to[1]);
      return;
    }
    const anchor: Point | null =
      drag.anchor ??
      (sel.anchorNode && inTitle(sel.anchorNode)
        ? [sel.anchorNode, sel.anchorOffset]
        : null);
    if (!anchor) return;
    if (
      samePoint(anchor, sel.anchorNode, sel.anchorOffset) &&
      samePoint(target, sel.focusNode, sel.focusOffset)
    )
      return;
    sel.setBaseAndExtent(anchor[0], anchor[1], target[0], target[1]);
    return;
  }
  // Otherwise a selection begun in a title, by whatever means, stays in it.
  if (sel.isCollapsed || !sel.anchorNode || !sel.focusNode) return;
  const title = titleOf(sel.anchorNode);
  if (!title || title.contains(sel.focusNode)) return;
  const [node, offset] = domEdge(title, [sel.focusNode, sel.focusOffset]);
  sel.extend(node, offset);
}

let titleSelectionInstalled = false;

/** A selection that begins in an offer title stays in it, and copying it
 * gives the plain title without the line break a triple-click adds. */
function containTitleSelection() {
  if (titleSelectionInstalled || typeof document === "undefined") return;
  titleSelectionInstalled = true;
  document.addEventListener(
    "pointerdown",
    (e) => {
      const title = titleOf(e.target instanceof Node ? e.target : null);
      if (!title) {
        titleDrag = null;
        return;
      }
      // Where the selection begins, read now: once the pointer leaves the
      // title the browser may already have moved the selection's anchor
      // before the first selection event arrives.
      const at = caretAt(e.clientX, e.clientY);
      titleDrag = {
        title,
        anchor: at && title.contains(at[0]) ? at : null,
        x: e.clientX,
        y: e.clientY,
        until: Infinity,
      };
    },
    true,
  );
  document.addEventListener(
    "pointermove",
    (e) => {
      if (!titleDrag || !e.buttons || titleDrag.until !== Infinity) return;
      titleDrag.x = e.clientX;
      titleDrag.y = e.clientY;
    },
    true,
  );
  const release = () => {
    if (titleDrag?.until === Infinity)
      titleDrag.until = performance.now() + 250;
  };
  document.addEventListener("pointerup", release, true);
  document.addEventListener("pointercancel", release, true);
  document.addEventListener("selectionchange", keepSelectionInTitle);
  document.addEventListener("copy", (e) => {
    const sel = document.getSelection();
    if (!sel?.anchorNode || !e.clipboardData || !titleOf(sel.anchorNode))
      return;
    const text = sel.toString().replace(/\s+/g, " ").trim();
    if (!text) return;
    e.clipboardData.setData("text/plain", text);
    e.preventDefault();
  });
}

/** One offer in the conversation, whatever its kind. */
export function OfferCard({
  kind,
  title,
  facts,
  until,
  open = false,
  onToggle,
  hitRef,
  actions,
  media,
  status,
  inert = false,
  ...data
}: {
  kind: OfferKind;
  title: string;
  /** Kind and size, in the words the card and the panel share. */
  facts: string[];
  /** The end of the item's publication while it is public. */
  until?: string;
  /** The item is the one open in the panel. */
  open?: boolean;
  /** Absent: nothing opens (a removed file). */
  onToggle?: (opener: HTMLElement | null) => void;
  hitRef?: Ref<HTMLButtonElement>;
  actions?: ReactNode;
  /** An image's thumbnail or a folder's strip of images. */
  media?: ReactNode;
  status?: ReactNode;
  inert?: boolean;
  "aria-label": string;
  "data-testid": string;
  [data: `data-${string}`]: string | undefined;
}) {
  const card = useRef<HTMLElement>(null);
  const hit = useRef<HTMLButtonElement | null>(null);
  const pendingOpen = useRef<number | undefined>(undefined);
  const opens = !!onToggle && !inert;
  const hasActs = !!actions && !inert;
  const setHit = useCallback(
    (el: HTMLButtonElement | null) => {
      hit.current = el;
      if (typeof hitRef === "function") hitRef(el);
      else if (hitRef) hitRef.current = el;
    },
    [hitRef],
  );
  useEffect(containTitleSelection, []);
  useEffect(() => () => window.clearTimeout(pendingOpen.current), []);
  // The floating icon row would cover the end of a long title's first
  // lines; the title keeps that corner free (OfferCard.css), measured here
  // because the row's width depends on the item's icons and state.
  useLayoutEffect(() => {
    if (!hasActs) return;
    const el = card.current;
    const acts = el?.querySelector<HTMLElement>(":scope > .ah-offer-acts");
    const title = el?.querySelector<HTMLElement>(".ah-offer-title");
    if (!el || !acts || !title || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      if (getComputedStyle(acts).position !== "absolute") {
        el.style.removeProperty("--ah-offer-acts-w");
        el.style.removeProperty("--ah-offer-acts-h");
        return;
      }
      const a = acts.getBoundingClientRect();
      const t = title.getBoundingClientRect();
      el.style.setProperty(
        "--ah-offer-acts-w",
        `${Math.max(0, Math.ceil(t.right - a.left + 4))}px`,
      );
      el.style.setProperty(
        "--ah-offer-acts-h",
        `${Math.max(0, Math.ceil(a.bottom - t.top))}px`,
      );
    };
    measure();
    const o = new ResizeObserver(measure);
    o.observe(acts);
    o.observe(el);
    return () => o.disconnect();
  }, [hasActs]);
  return (
    <aside
      ref={card}
      className="ah-offer"
      role="note"
      data-kind-mark={kind}
      data-open={open || undefined}
      data-inert={inert || undefined}
      {...data}
    >
      {onToggle && !inert ? (
        <button
          type="button"
          ref={setHit}
          className="ah-offer-hit"
          data-testid="offer-open"
          aria-expanded={open}
          aria-label={open ? txt.close(title) : txt.open(title)}
          title={open ? txt.closeHint : txt.openHint}
          onClick={(event) => onToggle(event.currentTarget)}
        />
      ) : null}
      <OfferMark kind={kind} />
      <span className="ah-offer-body">
        <strong className="ah-offer-title" data-testid="offer-title">
          {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/noNoninteractiveElementInteractions lint/a11y/useKeyWithClickEvents: A pointer shortcut to the card's own press, which is the keyboard and screen reader route. */}
          <span
            className="ah-offer-title-text"
            onPointerDown={() => window.clearTimeout(pendingOpen.current)}
            onClick={
              opens
                ? (event) => {
                    const title = event.currentTarget;
                    window.clearTimeout(pendingOpen.current);
                    if (event.detail > 1 || selectionIn(title)) return;
                    pendingOpen.current = window.setTimeout(() => {
                      if (!selectionIn(title)) onToggle?.(hit.current);
                    }, TITLE_OPEN_DELAY_MS);
                  }
                : undefined
            }
          >
            {inert ? <s>{title}</s> : title}
          </span>
        </strong>
        <span className="ah-offer-facts">
          {facts.join(" · ")}
          {inert ? null : (
            <>
              {facts.length ? " · " : null}
              <OfferSeen until={until} />
            </>
          )}
        </span>
        {media}
        {status}
      </span>
      {actions && !inert ? (
        <span className="ah-offer-acts">{actions}</span>
      ) : null}
      {onToggle && !inert ? (
        <span className="ah-offer-chev" aria-hidden="true">
          <Icon name="forward" className="ah-offer-chev-go" />
          <Icon name="cross" className="ah-offer-chev-x" />
        </span>
      ) : null}
    </aside>
  );
}
