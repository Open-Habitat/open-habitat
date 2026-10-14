import type { ReactNode, RefObject } from "react";
import { useCallback, useRef } from "react";
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

export function Dialog({
  triggerLabel,
  title,
  description,
  children,
  closeAvailability = enabled,
  returnFocusRef,
  isOpen,
  onOpenChange,
}: {
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
      <ControlButton ref={triggerRef} variant="secondary">
        {triggerLabel}
      </ControlButton>
      <ModalOverlay
        className="ah-overlay"
        isDismissable={!reason}
        isKeyboardDismissDisabled={Boolean(reason)}
      >
        <Modal className="ah-modal">
          <AriaDialog className="ah-dialog" aria-label={title}>
            <Heading ref={focusHeading} slot="title" tabIndex={-1}>
              {title}
            </Heading>
            {description ? <p>{description}</p> : null}
            {children}
            <div className="ah-dialog-actions">
              <ControlButton
                variant="secondary"
                slot="close"
                isDisabled={Boolean(reason)}
              >
                Sulje
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
      <ControlButton variant="danger">{triggerLabel}</ControlButton>
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
                autoFocus
                variant="secondary"
                isDisabled={Boolean(closeReason)}
                slot="close"
              >
                Peruuta
              </ControlButton>
              <Button
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
  onAction,
  popoverClassName,
  triggerPresentation,
  triggerClassName,
  placement,
}: {
  label: string;
  triggerLabel?: string;
  trigger?: ReactNode;
  heading?: ReactNode;
  popoverClassName?: string;
  triggerPresentation?: "account" | "icon";
  triggerClassName?: string;
  placement?: "top start" | "end top";
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <MenuTrigger
      onOpenChange={(open) => {
        if (!open) queueMicrotask(() => triggerRef.current?.focus());
      }}
    >
      <ControlButton
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
        placement={placement}
        className={`ah-popover${popoverClassName ? ` ${popoverClassName}` : ""}`}
      >
        {heading ? <div className="ah-menu-heading">{heading}</div> : null}
        <AriaMenu aria-label={label} onAction={(key) => onAction(String(key))}>
          {items.map((item) => (
            <ControlMenuItem
              danger={item.danger}
              className={item.danger ? "ah-menu-danger" : undefined}
              data-group={item.group}
              data-group-selected={item.selected || undefined}
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
      <TabList aria-label={label} className="ah-tabs" items={tabs}>
        {(tab) => <ControlTab id={tab.id}>{tab.label}</ControlTab>}
      </TabList>
      {active ? <TabPanel id={active.id}>{active.panel}</TabPanel> : null}
    </AriaTabs>
  );
}
