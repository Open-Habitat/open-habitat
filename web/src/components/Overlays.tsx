import type { ReactNode, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog as AriaDialog,
  Menu as AriaMenu,
  Tabs as AriaTabs,
  DialogTrigger,
  Heading,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
  TabList,
  TabPanel,
} from "react-aria-components";
import { liveText } from "../i18n";
import { overlaysText } from "../text/overlays";
import {
  ControlButton,
  ControlMenuItem,
  ControlTab,
  DisclosureButton,
} from "./ControlElements";
import { Icon } from "./Icon";
import { Button } from "./Primitives";
import type { Availability } from "./types";
import { enabled, unavailableReason } from "./types";

const txt = liveText(overlaysText);

export function Dialog({
  "data-testid": testId,
  triggerLabel,
  title,
  description,
  children,
  closeAvailability = enabled,
  returnFocusRef,
  isOpen,
  onOpenChange,
}: {
  "data-testid"?: string;
  triggerLabel: string;
  title: string;
  description?: string;
  children: ReactNode;
  closeAvailability?: Availability;
  returnFocusRef?: RefObject<HTMLElement | null>;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const reason = unavailableReason(closeAvailability);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusHeading = useCallback(
    (node: HTMLHeadingElement | null) => node?.focus(),
    [],
  );
  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        onOpenChange?.(open);
        if (!open)
          queueMicrotask(() =>
            (returnFocusRef?.current ?? triggerRef.current)?.focus(),
          );
      }}
    >
      <ControlButton
        data-testid={testId}
        size="row"
        ref={triggerRef}
        variant="secondary"
      >
        {triggerLabel}
      </ControlButton>
      <ModalOverlay
        className="ah-overlay"
        isDismissable={!reason}
        isKeyboardDismissDisabled={Boolean(reason)}
      >
        <Modal className="ah-modal">
          <AriaDialog
            data-testid="rename-dialog"
            className="ah-dialog"
            aria-label={title}
          >
            <Heading ref={focusHeading} slot="title" tabIndex={-1}>
              {title}
            </Heading>
            {description ? <p>{description}</p> : null}
            {children}
            <div className="ah-dialog-actions">
              <ControlButton
                data-testid="dialog-close"
                size="page"
                variant="secondary"
                slot="close"
                isDisabled={Boolean(reason)}
              >
                {txt.close}
              </ControlButton>
            </div>
            {reason ? <p className="ah-control-reason">{reason}</p> : null}
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
export function AlertDialog({
  triggerLabel,
  title,
  description,
  confirmationControl,
  actionLabel,
  actionAvailability = enabled,
  closeAvailability = enabled,
  onConfirm,
}: {
  "data-testid"?: string;
  triggerLabel: string;
  title: string;
  description: string;
  confirmationControl?: ReactNode;
  actionLabel: string;
  actionAvailability?: Availability;
  closeAvailability?: Availability;
  onConfirm: () => void;
}) {
  const reason = unavailableReason(actionAvailability);
  const closeReason = unavailableReason(closeAvailability);
  return (
    <DialogTrigger>
      <ControlButton size="row" variant="danger">
        {triggerLabel}
      </ControlButton>
      <ModalOverlay
        className="ah-overlay"
        isDismissable={!closeReason}
        isKeyboardDismissDisabled={Boolean(closeReason)}
      >
        <Modal className="ah-modal">
          <AriaDialog
            className="ah-dialog"
            role="alertdialog"
            aria-label={title}
          >
            <Heading slot="title">{title}</Heading>
            <p>{description}</p>
            {confirmationControl}
            <div className="ah-dialog-actions">
              <ControlButton
                data-testid="cancel"
                size="page"
                autoFocus
                variant="secondary"
                isDisabled={Boolean(closeReason)}
                slot="close"
              >
                {txt.cancel}
              </ControlButton>
              <Button
                size="page"
                label={actionLabel}
                variant="danger"
                availability={actionAvailability}
                onPress={onConfirm}
              />
            </div>
            {reason ? <p className="ah-control-reason">{reason}</p> : null}
            {closeReason ? (
              <p className="ah-control-reason">{closeReason}</p>
            ) : null}
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
export function Menu({
  label,
  triggerLabel,
  trigger,
  heading,
  items,
  betweenItems,
  onAction,
  popoverClassName,
  triggerPresentation,
  triggerClassName,
  triggerTestId,
  buttonRef,
  placement,
  isNonModal,
}: {
  label: string;
  triggerLabel?: string;
  trigger?: ReactNode;
  heading?: ReactNode;
  popoverClassName?: string;
  triggerPresentation?: "account" | "icon";
  triggerClassName?: string;
  triggerTestId?: string;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  isNonModal?: boolean;
  placement?: "top start" | "end top" | "bottom start" | "bottom end";
  betweenItems?: ReactNode;
  items: {
    id: string;
    label: string;
    description?: string;
    availability?: Availability;
    danger?: boolean;
    selected?: boolean;
    group?: string;
    displayLabel?: string;
  }[];
  onAction: (id: string) => void;
}) {
  const ownTriggerRef = useRef<HTMLButtonElement>(null);
  const triggerRef = buttonRef ?? ownTriggerRef;
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!isNonModal || !open) return;
    // Nonmodal React Aria popovers close on blur, but a tap on plain text
    // need not move focus. Keep that outside-tap dismissal as well.
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !triggerRef.current?.contains(event.target) &&
        !popoverRef.current?.contains(event.target)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss, true);
    return () => document.removeEventListener("pointerdown", dismiss, true);
  }, [isNonModal, open, triggerRef]);
  return (
    <MenuTrigger
      isOpen={isNonModal ? open : undefined}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) queueMicrotask(() => triggerRef.current?.focus());
      }}
    >
      <ControlButton
        size="row"
        data-testid={
          triggerTestId ??
          (triggerPresentation === "account"
            ? "account-menu-trigger"
            : "workspace-menu")
        }
        ref={triggerRef}
        variant="secondary"
        presentation={triggerPresentation}
        className={triggerClassName}
        aria-label={triggerLabel ?? label}
      >
        {trigger ?? label}
        <span aria-hidden="true" className="ah-menu-chevron" />
      </ControlButton>
      <Popover
        ref={popoverRef}
        isNonModal={isNonModal}
        shouldCloseOnInteractOutside={
          isNonModal
            ? (target) => !triggerRef.current?.contains(target)
            : undefined
        }
        placement={placement}
        className={`ah-popover${popoverClassName ? ` ${popoverClassName}` : ""}`}
      >
        {heading ? <div className="ah-menu-heading">{heading}</div> : null}
        <AriaMenu
          data-testid="disclosure-toggle"
          aria-label={label}
          onAction={(key) => onAction(String(key))}
        >
          {(betweenItems ? items.slice(0, -1) : items).map((item) => (
            <ControlMenuItem
              data-menu-item={item.id}
              danger={item.danger}
              className={item.danger ? "ah-menu-danger" : undefined}
              data-group={item.group}
              data-group-selected={item.selected || undefined}
              data-testid={`menu-${item.id}`}
              id={item.id}
              key={item.id}
              isDisabled={Boolean(unavailableReason(item.availability))}
              textValue={item.label}
              aria-label={item.displayLabel ? item.label : undefined}
            >
              <span>{item.displayLabel ?? item.label}</span>
              {item.description ? <small>{item.description}</small> : null}
              {unavailableReason(item.availability) ? (
                <small>{unavailableReason(item.availability)}</small>
              ) : null}
            </ControlMenuItem>
          ))}
        </AriaMenu>
        {betweenItems ? (
          <>
            {betweenItems}
            <AriaMenu
              aria-label={txt.menuEnd(label)}
              onAction={(key) => onAction(String(key))}
            >
              <ControlMenuItem
                data-testid={`menu-${items[items.length - 1].id}`}
                id={items[items.length - 1].id}
                danger={items[items.length - 1].danger}
                className={
                  items[items.length - 1].danger ? "ah-menu-danger" : undefined
                }
                textValue={items[items.length - 1].label}
              >
                {items[items.length - 1].label}
              </ControlMenuItem>
            </AriaMenu>
          </>
        ) : null}
      </Popover>
    </MenuTrigger>
  );
}
export function Disclosure({
  label,
  expanded,
  summary,
  onToggle,
  children,
}: {
  label: string;
  expanded: boolean;
  summary?: string;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="ah-disclosure">
      <DisclosureButton aria-expanded={expanded} onPress={onToggle}>
        <Icon
          name="forward"
          className={expanded ? "ah-icon-expanded" : undefined}
        />{" "}
        {label}
        {summary ? <small>{summary}</small> : null}
      </DisclosureButton>
      {expanded ? <div className="ah-disclosure-panel">{children}</div> : null}
    </section>
  );
}
export function Tabs<T extends string>({
  label,
  selected,
  tabs,
  onChange,
}: {
  label: string;
  selected: T;
  tabs: { id: T; label: string; panel: ReactNode }[];
  onChange: (id: T) => void;
}) {
  const active = tabs.find((tab) => tab.id === selected) ?? tabs[0];
  return (
    <AriaTabs
      selectedKey={selected}
      onSelectionChange={(key) => onChange(String(key) as T)}
    >
      <TabList
        data-testid="disclosure-toggle"
        aria-label={label}
        className="ah-tabs"
        items={tabs}
      >
        {(tab) => <ControlTab id={tab.id}>{tab.label}</ControlTab>}
      </TabList>
      {active ? <TabPanel id={active.id}>{active.panel}</TabPanel> : null}
    </AriaTabs>
  );
}
