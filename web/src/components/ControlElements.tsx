import type { ReactNode, Ref } from "react";
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
export function ControlButton({
  variant = "secondary",
  size = "normal",
  presentation,
  className,
  title,
  ...props
}: AriaButtonProps & {
  title?: string;
  variant?: ControlVariant;
  size?: "compact" | "normal";
  presentation?: "icon" | "account" | "back" | "floating" | "messageIcon";
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <AriaButton
      {...props}
      {...(title ? { title } : {})}
      data-ah-primitive="button"
      className={`${styles.button} ${variants[variant]} ${size === "compact" ? styles.compact : ""} ${presentation ? styles[presentation] : ""} ah-button ah-button-${variant} ah-button-${size} ${className ?? ""}`}
    />
  );
}
export function IconButton(
  props: Omit<Parameters<typeof ControlButton>[0], "presentation">,
) {
  return <ControlButton {...props} presentation="icon" />;
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
  "aria-label"?: string;
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
