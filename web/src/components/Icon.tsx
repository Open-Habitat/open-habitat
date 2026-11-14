import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "user"
  | "agent"
  | "link"
  | "eye"
  | "disk"
  | "server"
  | "users"
  | "bots"
  | "menu"
  | "more"
  | "up"
  | "info"
  | "home"
  | "folderPlus"
  | "repo"
  | "code"
  | "paperclip"
  | "plus"
  | "back"
  | "forward"
  | "down"
  | "refresh"
  | "copy"
  | "check"
  | "message"
  | "cross"
  | "question"
  | "external"
  | "edges"
  | "scroll"
  | "wrap"
  | "grid"
  | "top"
  | "bottom"
  | "expand"
  | "stop"
  | "editor"
  | "flask"
  | "thinking"
  | "terminal"
  | "system"
  | "sun"
  | "moon"
  | "contrast"
  | "archive"
  | "github"
  | "pencil"
  | "eyeOff"
  | "trash"
  | "branch"
  | "bell"
  | "merge"
  | "worktree"
  | "worktreeNew"
  | "warning"
  | "phone"
  | "laptop"
  | "devices"
  | "qr"
  | "clock"
  | "logout"
  | "lock"
  | "search"
  | "arrowUp"
  | "arrowDown"
  | "fetch"
  | "plug"
  | "folder"
  | "mail"
  | "calendar"
  | "contacts"
  | "shield"
  | "slash"
  | "at"
  | "file"
  | "steer"
  | "queue"
  | "swap"
  | "restore"
  | "run"
  | "key"
  | "updown"
  | "download"
  | "image"
  | "film"
  | "music"
  | "table"
  | "package"
  | "mic"
  | "save"
  | "gear"
  | "recap"
  | "spark"
  | "globe";

/** Decorative icon only: the adjacent control supplies its accessible name. */
export function Icon({
  name,
  ...props
}: { name: IconName } & Omit<SVGProps<SVGSVGElement>, "children">) {
  const paths: Record<IconName, ReactNode> = {
    flask: (
      <>
        <path d="M9 3h6M10 3v6.2L4.6 18.4A1.7 1.7 0 0 0 6.1 21h11.8a1.7 1.7 0 0 0 1.5-2.6L14 9.2V3" />
        <path d="M7.2 15h9.6" />
      </>
    ),
    editor: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M8 4v16m5-11-2 3 2 3m3-6 2 3-2 3" />
      </>
    ),
    thinking: (
      <>
        <path d="M9 18h6m-6 3h6M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z" />
      </>
    ),
    phone: (
      <>
        <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
        <path d="M11 18.5h2" />
      </>
    ),
    laptop: (
      <>
        <rect x="4" y="5" width="16" height="11" rx="1.5" />
        <path d="M2 19h20" />
      </>
    ),
    devices: (
      <>
        <rect x="2.5" y="5" width="13" height="10" rx="1.5" />
        <path d="M1.5 18h10" />
        <rect x="16" y="8" width="6" height="12" rx="1.5" />
      </>
    ),
    qr: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
      </>
    ),
    mic: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5M21 12H9" />
      </>
    ),
    github: (
      <path
        d="M9 19c-4 1-4-2-6-2m12 4v-4a3.5 3.5 0 0 0-1-3c3.3-.4 6-1.6 6-5.5A4.3 4.3 0 0 0 19 5c.1-1-.1-2-.5-3 0 0-1.3-.4-4.5 1.7a15 15 0 0 0-8 0C2.8 1.6 1.5 2 1.5 2 1.1 3 .9 4 1 5a4.3 4.3 0 0 0-1 3.5C0 12.4 2.7 13.6 6 14a3.5 3.5 0 0 0-1 3v4"
        transform="translate(2 0) scale(.9)"
      />
    ),
    pencil: (
      <>
        <path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z" />
      </>
    ),
    eyeOff: (
      <>
        <path d="M3 3l18 18M10 6c6-1 11 6 11 6s-1 2-3 4M6 6c-2 2-4 6-4 6s4 7 10 6c1 0 2 0 3-1" />
        <path d="M10 10a3 3 0 0 0 4 4" />
      </>
    ),
    branch: (
      <>
        <circle cx="7" cy="6" r="2" />
        <path d="M7 8v10M7 12c0 3 3 4 7 4" />
        <circle cx="17" cy="16" r="2" />
      </>
    ),
    bell: (
      <>
        <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z" />
        <path d="M10 19.5a2 2 0 0 0 4 0" />
      </>
    ),
    merge: (
      <>
        <circle cx="6" cy="6" r="2" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="12" r="2" />
        <path d="M6 8v8M6 8c0 3 4 4 10 4" />
      </>
    ),
    // A branch that left its trunk: a worktree agent's own place.
    worktree: (
      <>
        <circle cx="6" cy="5" r="2" />
        <circle cx="6" cy="19" r="2" />
        <circle cx="18" cy="8" r="2" />
        <path d="M6 7v10M18 10c0 4-6 3-12 7" />
      </>
    ),
    worktreeNew: (
      <>
        <circle cx="6" cy="5" r="2" />
        <circle cx="6" cy="19" r="2" />
        <path d="M6 7v10M6 15c0-3 3-5 7-5M18 5v8M14 9h8" />
      </>
    ),
    warning: (
      <>
        <path d="M12 4 2.8 19.5h18.4z" />
        <path d="M12 10v4M12 17h.01" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
      </>
    ),
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
    save: (
      <>
        <path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M7 3v5h8V3M7 21v-7h10v7" />
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
    // Botit (proto-named-workers round 3): two agent heads, the front one
    // whole, as users doubles user; the named workers' chip.
    bots: (
      <>
        <rect x="3" y="10" width="12" height="9" rx="2.5" />
        <path d="M9 7v3M6.8 14.5h.01M11.2 14.5h.01" />
        <path d="M9 10V8.5A2.5 2.5 0 0 1 11.5 6h7A2.5 2.5 0 0 1 21 8.5v4a2.5 2.5 0 0 1-2.5 2.5H17M15 3v3" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1.2" />
        <circle cx="12" cy="12" r="1.2" />
        <circle cx="19" cy="12" r="1.2" />
      </>
    ),
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
    contrast: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
      </>
    ),
    up: <path d="M12 20V4m-6 6 6-6 6 6" />,
    slash: <path d="M15 4 9 20" />,
    at: (
      <>
        <circle cx="12" cy="12" r="3.5" />
        <path d="M15.5 12v1.5a2.5 2.5 0 0 0 5 0V12a8.5 8.5 0 1 0-3.3 6.7" />
      </>
    ),
    file: (
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
      </>
    ),
    steer: <path d="M5 4v6a4 4 0 0 0 4 4h10m-4-4 4 4-4 4" />,
    queue: <path d="M4 6h12M4 12h9M4 18h6M18 13v7M14.5 16.5h7" />,
    swap: <path d="M7 7h11l-3-3M17 17H6l3 3" />,
    key: (
      <>
        <circle cx="8" cy="15" r="4" />
        <path d="m11 12 9-9m-4 4 3 3m-6 0 2 2" />
      </>
    ),
    restore: (
      <>
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
      </>
    ),
    run: <path d="M7 5v14l11-7z" />,
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
    code: (
      <>
        <path d="M8 8l-4 4 4 4" />
        <path d="M16 8l4 4-4 4" />
        <path d="M13.5 5l-3 14" />
      </>
    ),
    repo: (
      <>
        <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
        <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" />
        <path d="M9 7h6" />
      </>
    ),
    back: <path d="m15 5-7 7 7 7" />,
    forward: <path d="m9 5 7 7-7 7" />,
    paperclip: (
      <path d="M21 11.5 12.5 20a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.9-2.9l8.5-8.5" />
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    down: <path d="m5 9 7 7 7-7" />,
    updown: <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />,
    download: <path d="M12 4v11m-5-5 5 5 5-5M5 20h14" />,
    image: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="1.6" />
        <path d="m4 18 5-5 4 4 3-3 4 4" />
      </>
    ),
    film: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m10 9 5 3-5 3Z" />
      </>
    ),
    music: (
      <>
        <path d="M9 18V6l10-2v12" />
        <circle cx="6.5" cy="18" r="2.5" />
        <circle cx="16.5" cy="16" r="2.5" />
      </>
    ),
    table: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M3 15h18M9 4v16" />
      </>
    ),
    package: (
      <>
        <path d="M6 3h9l4 4v14H6Z" />
        <path d="M11 3v2h2v2h-2v2h2v2h-2v3" />
      </>
    ),
    refresh: <path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7" />,
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1.5" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" />
        <rect x="4" y="14" width="6" height="6" rx="1.5" />
        <rect x="14" y="14" width="6" height="6" rx="1.5" />
      </>
    ),
    message: (
      <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
    ),
    arrowUp: <path d="M12 19V5m-6 6 6-6 6 6" />,
    arrowDown: <path d="M12 5v14m-6-6 6 6 6-6" />,
    fetch: <path d="M12 4v11m-5-5 5 5 5-5M5 20h14" />,
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
    lock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-4.5-4.5" />
      </>
    ),
    external: (
      <>
        <path d="M13 5h6v6M19 5l-9 9" />
        <path d="M19 14v5H5V5h5" />
      </>
    ),
    plug: (
      <>
        <path d="M9 2v5M15 2v5" />
        <path d="M6 7h12v4a6 6 0 0 1-12 0z" />
        <path d="M12 17v5" />
      </>
    ),
    folder: (
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </>
    ),
    contacts: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <circle cx="12" cy="10" r="2.6" />
        <path d="M8 17c.8-2 2.3-3 4-3s3.2 1 4 3" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />
        <path d="M12 8v4M12 15h.01" />
      </>
    ),
    gear: (
      <>
        <path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    // The person's own server browser.
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </>
    ),
    // A model's suggestion (proto-workspace-icon-setting round 2).
    spark: (
      <>
        <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
        <path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" />
      </>
    ),
    // Lines of a summary and a spark: a recap written now.
    recap: (
      <>
        <path d="M4 6h16M4 12h9M4 18h6" />
        <path d="m18 13 .9 2.1 2.1.9-2.1.9L18 19l-.9-2.1L15 16l2.1-.9Z" />
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
