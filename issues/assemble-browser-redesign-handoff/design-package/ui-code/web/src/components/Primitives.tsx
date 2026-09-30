import type { ReactNode } from "react";
import {
  Button as AriaButton,
  Checkbox as AriaCheckbox,
  FieldError,
  Input,
  Label,
  Radio,
  RadioGroup as AriaRadioGroup,
  Text,
  TextArea as AriaTextArea,
  TextField as AriaTextField,
} from "react-aria-components";
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
}: ButtonProps) {
  const reason = unavailableReason(availability);
  return (
    <span className="ah-control">
      <AriaButton
        aria-label={ariaLabel}
        className={`ah-button ah-button-${variant} ah-button-${size}`}
        isDisabled={Boolean(reason)}
        isPending={pending}
        onPress={onPress}
      >
        {pending ? `${label}…` : label}
        {shortcutHint ? <kbd>{shortcutHint}</kbd> : null}
      </AriaButton>
      {reason ? <span className="ah-control-reason">{reason}</span> : null}
    </span>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
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
      className="ah-field"
      isDisabled={Boolean(reason) && !readOnly}
      isReadOnly={readOnly}
      isInvalid={Boolean(error)}
      isRequired={required}
      name={name}
      value={value}
      onChange={onChange}
    >
      <Label>{label}</Label>
      <Input className={mono ? "ah-mono" : undefined} />
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
      className="ah-field"
      isDisabled={Boolean(reason) && !readOnly}
      isReadOnly={readOnly}
      isInvalid={Boolean(error)}
      isRequired={required}
      value={value}
      onChange={onChange}
    >
      <Label>{label}</Label>
      <AriaTextArea
        className={mono ? "ah-mono" : undefined}
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
        {checked ? "✓" : ""}
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
