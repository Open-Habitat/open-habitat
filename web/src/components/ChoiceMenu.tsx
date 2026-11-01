import { useRef, useState } from "react";
import { Menu, MenuTrigger, Popover, Text } from "react-aria-components";
import { ControlButton, ControlMenuItem } from "./ControlElements";
import "./ChoiceMenu.css";

/** A single choice whose labels or notes are too long for segments. */
export function ChoiceMenu<T extends string>({
  label,
  options,
  value,
  onChange,
  isDisabled,
  "data-testid": testId,
}: {
  label: string;
  options: readonly { id: T; label: string; description?: string }[];
  value: T;
  onChange: (id: T) => void;
  isDisabled?: boolean;
  "data-testid"?: string;
}) {
  const [open, setOpen] = useState(false);
  const mousePress = useRef(false);
  return (
    <MenuTrigger
      isOpen={open}
      onOpenChange={(next) => {
        // A phone sheet can cover the opener. Open on mouse release too,
        // otherwise that same release can select an option under the pointer.
        if (!next || !mousePress.current) setOpen(next);
      }}
    >
      <ControlButton
        size="row"
        className="ah-choice-trigger"
        aria-label={`${label}: ${options.find((option) => option.id === value)?.label ?? ""}`}
        data-testid={testId}
        data-value={value}
        // Pending blocks activation without discarding focus while the
        // setting is saved; a native disabled button cannot receive it back.
        isPending={isDisabled}
        onPointerDownCapture={(event) => {
          mousePress.current = event.pointerType === "mouse";
        }}
        onPressEnd={() => {
          mousePress.current = false;
        }}
        onPress={(event) => {
          if (event.pointerType === "mouse") setOpen(true);
        }}
      >
        <span className="ah-choice-labels">
          {options.map((option) => (
            <span
              key={option.id}
              aria-hidden={option.id !== value || undefined}
              className={option.id === value ? undefined : "ah-choice-measure"}
            >
              {option.label}
            </span>
          ))}
        </span>
        <span aria-hidden="true" className="ah-menu-chevron" />
      </ControlButton>
      <Popover placement="bottom end" className="ah-popover ah-choice-popover">
        <Menu
          aria-label={label}
          selectionMode="single"
          selectedKeys={[value]}
          disabledKeys={isDisabled ? options.map((option) => option.id) : []}
          onAction={(key) => {
            if (isDisabled) return;
            const option = options.find((o) => o.id === key);
            if (option) onChange(option.id);
          }}
        >
          {options.map((option) => (
            <ControlMenuItem
              key={option.id}
              id={option.id}
              data-testid={`choice-${option.id}`}
              textValue={option.label}
            >
              {({ isSelected }) => (
                <>
                  <span className="ah-choice-check" aria-hidden="true">
                    {isSelected ? "✓" : ""}
                  </span>
                  <span className="ah-choice-option">
                    <Text slot="label">{option.label}</Text>
                    {option.description && (
                      <Text slot="description">{option.description}</Text>
                    )}
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
