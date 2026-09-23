import { useRef } from "react";
import type { ReactNode, RefObject } from "react";
import {
  Button as AriaButton,
  Dialog as AriaDialog,
  DialogTrigger,
  Heading,
  Menu as AriaMenu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
} from "react-aria-components";
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
}: {
  triggerLabel: string;
  title: string;
  description?: string;
  children: ReactNode;
  closeAvailability?: Availability;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const reason = unavailableReason(closeAvailability);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <DialogTrigger
      onOpenChange={(open) => {
        if (!open) queueMicrotask(() => triggerRef.current?.focus());
      }}
    >
      <AriaButton ref={triggerRef} className="ah-button ah-button-secondary">
        {triggerLabel}
      </AriaButton>
      <ModalOverlay className="ah-overlay" isDismissable={!reason}>
        <Modal className="ah-modal">
          <AriaDialog className="ah-dialog" aria-label={title}>
            <Heading slot="title" tabIndex={-1}>
              {title}
            </Heading>
            {description ? <p>{description}</p> : null}
            {children}
            <div className="ah-dialog-actions">
              <AriaButton
                className="ah-button ah-button-secondary"
                slot="close"
                isDisabled={Boolean(reason)}
                onPress={() => returnFocusRef?.current?.focus()}
              >
                Sulje
              </AriaButton>
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
  onConfirm,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  confirmationControl?: ReactNode;
  actionLabel: string;
  actionAvailability?: Availability;
  onConfirm: () => void;
}) {
  const reason = unavailableReason(actionAvailability);
  return (
    <DialogTrigger>
      <AriaButton className="ah-button ah-button-danger">
        {triggerLabel}
      </AriaButton>
      <ModalOverlay className="ah-overlay">
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
              <AriaButton
                autoFocus
                className="ah-button ah-button-secondary"
                slot="close"
              >
                Peruuta
              </AriaButton>
              <Button
                label={actionLabel}
                variant="danger"
                availability={actionAvailability}
                onPress={onConfirm}
              />
            </div>
            {reason ? <p className="ah-control-reason">{reason}</p> : null}
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
export function Menu({
  label,
  items,
  onAction,
}: {
  label: string;
  items: {
    id: string;
    label: string;
    description?: string;
    availability?: Availability;
    danger?: boolean;
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
      <AriaButton ref={triggerRef} className="ah-button ah-button-secondary">
        {label}
        <span aria-hidden="true"> ▾</span>
      </AriaButton>
      <Popover className="ah-popover">
        <AriaMenu aria-label={label} onAction={(key) => onAction(String(key))}>
          {items.map((item) => (
            <MenuItem
              className={item.danger ? "ah-menu-danger" : undefined}
              id={item.id}
              key={item.id}
              isDisabled={Boolean(unavailableReason(item.availability))}
              textValue={item.label}
            >
              <span>{item.label}</span>
              {item.description || unavailableReason(item.availability) ? (
                <small>
                  {item.description ?? unavailableReason(item.availability)}
                </small>
              ) : null}
            </MenuItem>
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
      <button
        aria-expanded={expanded}
        className="ah-disclosure-button"
        type="button"
        onClick={onToggle}
      >
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span> {label}
        {summary ? <small>{summary}</small> : null}
      </button>
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
    <div>
      <div aria-label={label} className="ah-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-controls={`panel-${tab.id}`}
            aria-selected={tab.id === selected}
            id={`tab-${tab.id}`}
            key={tab.id}
            role="tab"
            tabIndex={tab.id === selected ? 0 : -1}
            type="button"
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active ? (
        <div
          aria-labelledby={`tab-${active.id}`}
          id={`panel-${active.id}`}
          role="tabpanel"
        >
          {active.panel}
        </div>
      ) : null}
    </div>
  );
}
