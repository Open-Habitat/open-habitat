# components/Primitives.tsx

Generated from web/src/components/Primitives.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import {
  Checkbox as AriaCheckbox,
  RadioGroup as AriaRadioGroup,
  TextArea as AriaTextArea,
  TextField as AriaTextField,
  FieldError,
  Input,
  Label,
  Radio,
  Text,
} from "react-aria-components";
import { liveText } from "../i18n";
import { statusText } from "../text/status";
import {
  ControlButton,
  type ControlSize,
  controlStyles,
  IconButton,
} from "./ControlElements";
import { Icon, type IconName } from "./Icon";
import type { Availability, Option } from "./types";
import { enabled, unavailableReason } from "./types";

const txt = liveText(statusText);

export interface ButtonProps {
  "data-testid"?: string;
  "data-unread-count"?: number;
  "data-working"?: boolean;
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "quiet" | "danger" | "danger-subtle";
  size: ControlSize;
  availability?: Availability;
  pending?: boolean;
  shortcutHint?: string;
  ariaLabel?: string;
  icon?: IconName;
  trailingIcon?: IconName;
  presentation?: "back" | "floating" | "messageIcon";
}
export function Button({
  "data-testid": testId,
  "data-unread-count": unreadCount,
  "data-working": working,
  label,
  onPress,
  variant = "primary",
  size,
  availability = enabled,
  pending = false,
  shortcutHint,
  ariaLabel,
  icon,
  trailingIcon,
  presentation,
}: ButtonProps) {
  const reason = unavailableReason(availability);
  const control = (
    <ControlButton
      data-testid={testId}
      data-unread-count={unreadCount}
      data-working={working}
      aria-label={ariaLabel}
      variant={variant}
      size={size}
      presentation={presentation ?? (icon ? "icon" : undefined)}
      isDisabled={Boolean(reason)}
      isPending={pending}
      onPress={onPress}
    >
      {icon ? <Icon name={icon} /> : pending ? `${label}…` : label}
      {trailingIcon ? <Icon name={trailingIcon} /> : null}
      {shortcutHint ? <kbd>{shortcutHint}</kbd> : null}
    </ControlButton>
  );
  return reason ? (
    <span className="ah-button-stack">
      {control}
      <span data-testid="control-reason" className="ah-control-reason">
        {reason}
      </span>
    </span>
  ) : (
    control
  );
}

/* Actions and their guidance share a baseline; blocked reasons remain below their button. */
export function ActionRow({
  children,
  hint,
  className = "",
}: {
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ah-action-row ${className}`}>
      <div className="ah-action-row-buttons">{children}</div>
      {hint ? <p className="ah-composer-hint">{hint}</p> : null}
    </div>
  );
}

/* Indicator, flexible content and trailing action use the same row structure. */
export function ListRow({
  indicator,
  children,
  trailing,
  className = "",
}: {
  indicator?: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ah-list-row ${className}`}>
      {indicator ? (
        <span className="ah-list-row-indicator">{indicator}</span>
      ) : null}
      <div className="ah-list-row-content">{children}</div>
      {trailing ? <div className="ah-list-row-trailing">{trailing}</div> : null}
    </div>
  );
}

export function RefreshIconButton({ onPress }: { onPress: () => void }) {
  return (
    <IconButton
      data-testid="snapshot-refresh"
      aria-label={txt.refresh}
      variant="secondary"
      size="row"
      onPress={onPress}
    >
      <Icon name="refresh" />
    </IconButton>
  );
}

interface FieldProps {
  "data-testid"?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
  mono?: boolean;
  availability?: Availability;
  name?: string;
  // A field without a token is one Chromium cannot classify, and Brave
  // 1.96 (Chromium 154) then offers saved addresses on typing next to its
  // own email-alias entry, which fails a browser-process CHECK on the third
  // matching character. Every field therefore names what it holds.
  autoComplete?: string;
}
export function TextField({
  "data-testid": testId,
  label,
  value,
  onChange,
  hint,
  error,
  required,
  mono,
  availability = enabled,
  name,
  autoComplete = "off",
}: FieldProps) {
  const reason = unavailableReason(availability);
  const readOnly = availability.state === "read_only";
  return (
    <AriaTextField
      className={`ah-field ${controlStyles.field}`}
      isDisabled={Boolean(reason) && !readOnly}
      isReadOnly={readOnly}
      isInvalid={Boolean(error)}
      isRequired={required}
      name={name}
      autoComplete={autoComplete}
      value={value}
      onChange={onChange}
    >
      <Label>{label}</Label>
      <Input
        data-testid={testId}
        className={`${controlStyles.fieldInput} ${mono ? "ah-mono" : ""}`}
      />
      {hint || reason ? (
        <Text slot="description">
          {hint ? <span className="ah-hint">{hint}</span> : null}
          {reason ? (
            <span data-testid="control-reason" className="ah-control-reason">
              {reason}
            </span>
          ) : null}
        </Text>
      ) : null}
      <FieldError>{error}</FieldError>
    </AriaTextField>
  );
}
export function TextArea({
  "data-testid": testId,
  label,
  value,
  onChange,
  hint,
  placeholder,
  error,
  required,
  mono,
  availability = enabled,
  rows = 5,
  onCommit,
  autoComplete = "off",
}: FieldProps & { rows?: number; onCommit?: () => void }) {
  const reason = unavailableReason(availability);
  const readOnly = availability.state === "read_only";
  return (
    <AriaTextField
      className={`ah-field ${controlStyles.field}`}
      isDisabled={Boolean(reason) && !readOnly}
      isReadOnly={readOnly}
      isInvalid={Boolean(error)}
      isRequired={required}
      autoComplete={autoComplete}
      value={value}
      onChange={onChange}
    >
      <Label>{label}</Label>
      <AriaTextArea
        data-testid={testId}
        className={`${controlStyles.fieldInput} ${mono ? "ah-mono" : ""}`}
        placeholder={placeholder}
        rows={rows}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing &&
            onCommit
          ) {
            event.preventDefault();
            onCommit();
          }
        }}
      />
      {hint || reason ? (
        <Text slot="description">
          {hint ? <span className="ah-hint">{hint}</span> : null}
          {reason ? (
            <span data-testid="control-reason" className="ah-control-reason">
              {reason}
            </span>
          ) : null}
        </Text>
      ) : null}
      <FieldError>{error}</FieldError>
    </AriaTextField>
  );
}
export function SearchField(
  props: Omit<FieldProps, "hint" | "error"> & {
    resultSummary: string;
    onClear: () => void;
  },
) {
  return (
    <div className="ah-search">
      <TextField {...props} />
      <span role="status">{props.resultSummary}</span>
      {props.value ? (
        <Button
          data-testid="search-clear"
          label={txt.clearSearch}
          variant="quiet"
          size="row"
          onPress={props.onClear}
        />
      ) : null}
    </div>
  );
}
export function Checkbox({
  "data-testid": testId,
  label,
  checked,
  onChange,
  hint,
  availability = enabled,
}: {
  label: string;
  "data-testid"?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  availability?: Availability;
}) {
  const reason = unavailableReason(availability);
  return (
    <AriaCheckbox
      data-testid={testId}
      className="ah-checkbox"
      isDisabled={Boolean(reason)}
      isSelected={checked}
      onChange={onChange}
    >
      <span className="ah-checkbox-box" aria-hidden="true">
        {checked ? <Icon name="check" /> : null}
      </span>
      <span>
        {label}
        {hint ? <small>{hint}</small> : null}
        {reason ? <small>{reason}</small> : null}
      </span>
    </AriaCheckbox>
  );
}
export function RadioGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <AriaRadioGroup
      className="ah-radio-group"
      aria-label={label}
      value={value}
      onChange={(next) => onChange(next as T)}
    >
      <span className="ah-field-label">{label}</span>
      {options.map((option) => {
        const reason = unavailableReason(option.availability);
        return (
          <Radio
            key={option.value}
            value={option.value}
            isDisabled={Boolean(reason)}
          >
            <span className="ah-radio-dot" aria-hidden="true" />
            <span>
              {option.label}
              {option.description ? <small>{option.description}</small> : null}
              {reason ? <small>{reason}</small> : null}
            </span>
          </Radio>
        );
      })}
    </AriaRadioGroup>
  );
}
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="ah-field">
      <span className="ah-field-label">{label}</span>
      <select
        className="ah-native-select"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={Boolean(unavailableReason(option.availability))}
          >
            {option.label}
            {unavailableReason(option.availability)
              ? ` — ${unavailableReason(option.availability)}`
              : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
export function ControlReason({
  reason,
  relatedAction,
}: {
  reason: string;
  relatedAction?: ReactNode;
}) {
  return (
    <div className="ah-control-reason">
      <strong>{txt.unavailableAction}</strong> {reason}
      {relatedAction}
    </div>
  );
}

```
