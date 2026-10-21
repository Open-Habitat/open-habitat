import {
  isValidElement,
  type ReactNode,
  type Ref,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";
import type {
  ButtonProps as AriaButtonProps,
  MenuItemProps,
} from "react-aria-components";
import {
  Button as AriaButton,
  Link as AriaLink,
  MenuItem as AriaMenuItem,
  Tab as AriaTab,
  RouterProvider,
} from "react-aria-components";
import { useNavigate } from "react-router";
import styles from "./Controls.module.css";

export type ControlVariant =
  | "primary"
  | "secondary"
  | "quiet"
  | "danger"
  | "danger-subtle";
const variants: Record<ControlVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  quiet: styles.quiet,
  danger: styles.danger,
  "danger-subtle": styles.dangerSubtle,
};
const sizes: Record<ControlSize, string> = {
  page: styles.sizePage,
  row: styles.sizeRow,
  inline: styles.sizeInline,
};
// A label written in words, directly or beside an icon. Such a button always
// gets a visible surface; an icon-only control, or one labelled with a lone
// symbol such as ×, stays quiet.
function hasText(node: unknown): boolean {
  if (typeof node === "string") return /\p{L}/u.test(node);
  if (Array.isArray(node)) return node.some(hasText);
  return (
    isValidElement<{ children?: ReactNode }>(node) &&
    hasText(node.props.children)
  );
}
/** The role decides the size (Rooli ratkaisee): the screen's main action,
 * an action in a card or list row, or a control inside a field or strip. */
export type ControlSize = "page" | "row" | "inline";
export type ControlPresentation =
  | "icon"
  | "account"
  | "back"
  | "floating"
  | "messageIcon"
  | "pill"
  | "segment";
/** The primitive's classes, for a native element that must stay itself (a
 * disclosure's summary, an inert placeholder) yet look like the button. */
export function controlClassName({
  variant = "secondary",
  size,
  presentation,
  text = false,
}: {
  variant?: ControlVariant;
  size: ControlSize;
  presentation?: ControlPresentation;
  text?: boolean;
}) {
  // A segment labelled only with an icon is still square.
  const shape =
    presentation === "segment" && !text
      ? `${styles.segment} ${styles.icon}`
      : presentation
        ? styles[presentation]
        : text
          ? `${styles.text} ah-button-text`
          : "";
  return `${styles.button} ${variants[variant]} ${sizes[size]} ${shape} ah-button ah-button-${variant}`;
}
export function ControlButton({
  variant = "secondary",
  size,
  presentation,
  className,
  title,
  ref,
  ...props
}: AriaButtonProps & {
  title?: string;
  variant?: ControlVariant;
  size: ControlSize;
  presentation?: ControlPresentation;
  ref?: Ref<HTMLButtonElement>;
}) {
  const text = hasText(props.children);
  // React Aria's Button drops `title`, so the tooltip (often the reason a
  // control is disabled) is set on the element itself.
  const own = useRef<HTMLButtonElement | null>(null);
  const merged = useCallback(
    (node: HTMLButtonElement | null) => {
      own.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    },
    [ref],
  );
  useLayoutEffect(() => {
    if (!own.current) return;
    if (title) own.current.title = title;
    else own.current.removeAttribute("title");
  }, [title]);
  return (
    <AriaButton
      {...props}
      ref={merged}
      data-ah-primitive="button"
      data-ah-size={size}
      className={`${controlClassName({
        variant,
        size,
        // Labelled by an icon or a lone symbol (×, +): a square.
        presentation:
          presentation ?? (!text && props.children ? "icon" : undefined),
        text,
      })} ${className ?? ""}`}
    />
  );
}
export function IconButton(
  props: Omit<Parameters<typeof ControlButton>[0], "presentation">,
) {
  return <ControlButton {...props} presentation="icon" />;
}
/** One choice of several, drawn as touching segments of one track. */
export function Segmented<T extends string>({
  "data-testid": testId,
  label,
  options,
  value,
  onChange,
  size = "inline",
  isDisabled,
  className,
}: {
  "data-testid"?: string;
  label: string;
  options: readonly {
    id: T;
    label: string;
    icon?: ReactNode;
    /** Show only the icon; the label names it for assistive tech. */
    iconOnly?: boolean;
    title?: string;
    isDisabled?: boolean;
  }[];
  value: T | undefined;
  onChange: (id: T) => void;
  size?: ControlSize;
  isDisabled?: boolean;
  className?: string;
}) {
  return (
    <fieldset
      data-testid={testId ?? "segmented-choice"}
      className={`${styles.segmented} ${className ?? ""}`}
      aria-label={label}
      data-ah-primitive="segmented"
    >
      {options.map((o) => (
        <ControlButton
          key={o.id}
          data-testid={`segment-${o.id}`}
          variant="quiet"
          size={size}
          presentation="segment"
          aria-pressed={value === o.id}
          aria-label={o.iconOnly ? o.label : undefined}
          title={o.title ?? (o.iconOnly ? o.label : undefined)}
          isDisabled={isDisabled || o.isDisabled}
          onPress={() => onChange(o.id)}
        >
          {o.icon}
          {o.iconOnly ? null : o.label}
        </ControlButton>
      ))}
    </fieldset>
  );
}
export function LinkRow({
  href,
  children,
  current,
  kind = "nav",
  className,
  ...props
}: {
  href: string;
  children: ReactNode;
  current?: boolean;
  kind?:
    | "nav"
    | "agent"
    | "home"
    | "return"
    | "workspace"
    | "inline"
    | "header";
  className?: string;
  title?: string;
  "aria-label"?: string;
  "data-testid"?: string;
  "aria-describedby"?: string;
}) {
  const navigate = useNavigate();
  return (
    <RouterProvider navigate={navigate}>
      <AriaLink
        {...props}
        href={href}
        aria-current={current ? "page" : undefined}
        data-ah-primitive="link"
        className={`${styles.link} ${styles[kind]} ${className ?? ""}`}
      >
        {children}
      </AriaLink>
    </RouterProvider>
  );
}
export function ControlMenuItem({
  danger,
  className,
  ...props
}: MenuItemProps & { danger?: boolean }) {
  return (
    <AriaMenuItem
      {...props}
      data-ah-primitive="menu-item"
      className={`${styles.menuItem} ${danger ? styles.menuDanger : ""} ${className ?? ""}`}
    />
  );
}
export function DisclosureButton({
  tool = false,
  ...props
}: AriaButtonProps & { tool?: boolean }) {
  return (
    <AriaButton
      {...props}
      data-ah-primitive="disclosure"
      className={`${styles.disclosure} ${tool ? styles.toolDisclosure : ""} ah-disclosure-button`}
    />
  );
}
export { styles as controlStyles };

/** Links outside the router retain browser-native navigation and URL safety. */
export function ExternalLink({
  className,
  ...props
}: React.ComponentProps<"a">) {
  return (
    <a
      {...props}
      data-ah-primitive="external-link"
      className={`${styles.externalLink} ${className ?? ""}`}
    />
  );
}
export function ControlTab(props: React.ComponentProps<typeof AriaTab>) {
  return <AriaTab {...props} data-ah-primitive="tab" className={styles.tab} />;
}
