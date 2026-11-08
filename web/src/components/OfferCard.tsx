import "./OfferCard.css";
import "./ChoiceMenu.css";
import { type ReactNode, type Ref, useState } from "react";
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
  return (
    <aside
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
          ref={hitRef}
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
        <strong className="ah-offer-title">
          {inert ? <s>{title}</s> : title}
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
