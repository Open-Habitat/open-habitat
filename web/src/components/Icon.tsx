import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "menu"
  | "home"
  | "back"
  | "forward"
  | "down"
  | "refresh"
  | "copy"
  | "check"
  | "cross"
  | "question"
  | "external"
  | "edges"
  | "top"
  | "bottom"
  | "expand";

/** Decorative icon only: the adjacent control supplies its accessible name. */
export function Icon({
  name,
  ...props
}: { name: IconName } & Omit<SVGProps<SVGSVGElement>, "children">) {
  const paths: Record<IconName, ReactNode> = {
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v11h14V10M9 21v-7h6v7" />
      </>
    ),
    back: <path d="m15 5-7 7 7 7" />,
    forward: <path d="m9 5 7 7-7 7" />,
    down: <path d="m5 9 7 7 7-7" />,
    refresh: <path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7" />,
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    cross: <path d="M5 5 19 19M19 5 5 19" />,
    question: (
      <>
        <path d="M9 9a3 3 0 1 1 5 2c-1.3 1-2 1.5-2 3" />
        <path d="M12 18h.01" />
      </>
    ),
    edges: (
      <>
        <path d="M4 4h16M4 20h16M12 7v10m-3-3 3 3 3-3M9 10l3-3 3 3" />
      </>
    ),
    top: (
      <>
        <path d="M4 4h16M12 19V8m-4 4 4-4 4 4" />
      </>
    ),
    bottom: (
      <>
        <path d="M4 20h16M12 5v11m-4-4 4 4 4-4" />
      </>
    ),
    expand: (
      <>
        <path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5" />
      </>
    ),
    external: (
      <>
        <path d="M13 5h6v6M19 5l-9 9" />
        <path d="M19 14v5H5V5h5" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
