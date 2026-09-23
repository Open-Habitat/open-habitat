import { Button as AriaButton } from "react-aria-components";
export interface ButtonProps {
  label: string;
  onPress: () => void;
  pending?: boolean;
  disabledReason?: string;
}
export function Button({
  label,
  onPress,
  pending = false,
  disabledReason,
}: ButtonProps) {
  const disabled = pending || disabledReason !== undefined;
  return (
    <span className="control">
      <AriaButton isDisabled={disabled} onPress={onPress}>
        {pending ? `${label}…` : label}
      </AriaButton>
      {disabledReason ? <small>{disabledReason}</small> : null}
    </span>
  );
}
