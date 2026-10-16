import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "user"
  | "agent"
  | "link"
  | "eye"
  | "disk"
  | "server"
  | "users"
  | "menu"
  | "up"
  | "info"
  | "home"
  | "folderPlus"
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
  | "scroll"
  | "wrap"
  | "top"
  | "bottom"
  | "expand"
  | "stop"
  | "terminal"
  | "system"
  | "sun"
  | "moon"
  | "archive";

/** Decorative icon only: the adjacent control supplies its accessible name. */
export function Icon({
  name,
  ...props
}: { name: IconName } & Omit<SVGProps<SVGSVGElement>, "children">) {
  const paths: Record<IconName, ReactNode> = {
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5" />
      </>
    ),
    agent: (
      <>
        <rect x="4" y="7" width="16" height="12" rx="3" />
        <path d="M12 3v4M9 13h.01M15 13h.01" />
      </>
    ),
    link: (
      <>
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      </>
    ),
    eye: (
      <>
        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    disk: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 14h18M7 17h.01" />
      </>
    ),
    server: (
      <>
        <rect x="4" y="4" width="16" height="7" rx="2" />
        <rect x="4" y="13" width="16" height="7" rx="2" />
        <path d="M8 7.5h.01M8 16.5h.01" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8.5" r="3" />
        <path d="M3.5 19c.9-3 3-4.5 5.5-4.5s4.6 1.5 5.5 4.5M16 6a3 3 0 0 1 0 5.6M17.5 14.6c1.6.6 2.6 2 3 4.4" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    archive: (
      <>
        <rect x="3" y="4" width="18" height="5" rx="1" />
        <path d="M5 9v11h14V9M10 13h4" />
      </>
    ),
    terminal: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="m7 8 4 4-4 4M14 16h3" />
      </>
    ),
    system: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
    up: <path d="M12 20V4m-6 6 6-6 6 6" />,
    stop: (
      <rect
        x="7"
        y="7"
        width="10"
        height="10"
        rx="1.5"
        fill="currentColor"
        stroke="none"
      />
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10h.01" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v11h14V10M9 21v-7h6v7" />
      </>
    ),
    folderPlus: (
      <>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M12 11v5m-2.5-2.5h5" />
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
    scroll: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M16 8v5" />
      </>
    ),
    wrap: (
      <>
        <path d="M4 6h16M4 12h12a3 3 0 0 1 0 6h-4" />
        <path d="m14 16-2 2 2 2M4 18h4" />
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
