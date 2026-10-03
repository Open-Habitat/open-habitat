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
import { ControlButton, controlStyles, IconButton } from "./ControlElements";
import { Icon, type IconName } from "./Icon";
import type { Availability, Option } from "./types";
import { enabled, unavailableReason } from "./types";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "quiet" | "danger" | "danger-subtle";
  size?: "compact" | "normal";
  availability?: Availability;
  pending?: boolean;
  shortcutHint?: string;
  ariaLabel?: string;
  icon?: IconName;
  trailingIcon?: IconName;
  presentation?: "back" | "floating" | "messageIcon";
}
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "normal",
  availability = enabled,
  pending = false,
  shortcutHint,
  ariaLabel,
  icon,
  trailingIcon,
  presentation,
}: ButtonProps) {
  const reason = unavailableReason(availability);
  return (
    <span className="ah-control">
      <ControlButton
        aria-label={ariaLabel}
        variant={variant}
        size={size}
        presentation={presentation}
        isDisabled={Boolean(reason)}
        isPending={pending}
        onPress={onPress}
      >
        {icon ? <Icon name={icon} /> : pending ? `${label}…` : label}
        {trailingIcon ? <Icon name={trailingIcon} /> : null}
        {shortcutHint ? <kbd>{shortcutHint}</kbd> : null}
      </ControlButton>
      {reason ? <span className="ah-control-reason">{reason}</span> : null}
    </span>
  );
}

export function RefreshIconButton({ onPress }: { onPress: () => void }) {
  return (
    <IconButton
      aria-label="Päivitä"
      variant="secondary"
      size="compact"
      onPress={onPress}
    >
      <Icon name="refresh" />
    </IconButton>
  );
}

interface FieldProps {
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
}
export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  required,
  mono,
  availability = enabled,
  name,
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
      value={value}
      onChange={onChange}
    >
      <Label>{label}</Label>
      <Input
        className={`${controlStyles.fieldInput} ${mono ? "ah-mono" : ""}`}
      />
      {hint || reason ? (
        <Text slot="description">
          {hint ? <span className="ah-hint">{hint}</span> : null}
          {reason ? <span className="ah-control-reason">{reason}</span> : null}
        </Text>
      ) : null}
      <FieldError>{error}</FieldError>
    </AriaTextField>
  );
}
export function TextArea({
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
      value={value}
      onChange={onChange}
    >
      <Label>{label}</Label>
      <AriaTextArea
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
          {reason ? <span className="ah-control-reason">{reason}</span> : null}
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
          label="Tyhjennä haku"
          variant="quiet"
          size="compact"
          onPress={props.onClear}
        />
      ) : null}
    </div>
  );
}
export function Checkbox({
  label,
  checked,
  onChange,
  hint,
  availability = enabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  availability?: Availability;
}) {
  const reason = unavailableReason(availability);
  return (
    <AriaCheckbox
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
      <strong>Toiminto ei ole käytettävissä.</strong> {reason}
      {relatedAction}
    </div>
  );
}
