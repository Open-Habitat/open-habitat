import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useText } from "../i18n";
import { editorFileTreeText } from "../text/editorFileTree";
import { ControlButton } from "./ControlElements";
import { type TreeDirectories, type TreeRow, treeRows } from "./editorTree";
import type { FileRef } from "./fileRefs";
import { Icon } from "./Icon";

export function EditorFileTree({
  visible,
  directories,
  openPath,
  reveal,
  dirty,
  onLoad,
  onOpen,
  onClose,
}: {
  visible: boolean;
  directories: TreeDirectories;
  openPath?: string;
  reveal?: FileRef;
  dirty: boolean;
  onLoad: (path: string, background?: boolean) => void;
  onOpen: (path: string) => void;
  onClose: () => void;
}) {
  const t = useText(editorFileTreeText);
  const [expanded, setExpanded] = useState(new Set<string>());
  const [filter, setFilter] = useState("");
  const [focused, setFocused] = useState<string>();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const focusedReveal = useRef<FileRef | undefined>(undefined);
  useEffect(() => {
    const path = reveal?.path ?? openPath;
    if (!path) return;
    if (reveal) setFilter("");
    const parts = path.split("/");
    setExpanded((before) => {
      const next = new Set(before);
      for (let i = 1; i < parts.length; i++)
        next.add(parts.slice(0, i).join("/"));
      return next;
    });
  }, [openPath, reveal]);
  const rows = treeRows(directories, expanded, filter);
  // Read only the displayed branches (including compacted ancestors), not a
  // recursive workspace watch. Filtering must not freeze the underlying tree.
  const refreshPaths = useRef(new Set<string>());
  const paths = new Set([""]);
  for (const row of treeRows(directories, expanded, "")) {
    const parts = row.path.split("/");
    for (let i = 1; i < parts.length; i++)
      paths.add(parts.slice(0, i).join("/"));
    if (row.kind === "directory" && expanded.has(row.path)) paths.add(row.path);
  }
  refreshPaths.current = paths;
  useEffect(() => {
    if (!visible) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      for (const path of refreshPaths.current) onLoad(path, true);
    };
    refresh();
    const timer = window.setInterval(refresh, 3000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [visible, onLoad]);
  useEffect(() => {
    if (
      !visible ||
      !reveal?.path.endsWith("/") ||
      focusedReveal.current === reveal
    )
      return;
    const path = reveal.path.slice(0, -1);
    // A loaded single-child chain can represent the target on a combined row.
    const row = rows.find(
      (row) => row.path === path || row.path.startsWith(`${path}/`),
    );
    const button = row && buttons.current.get(row.key);
    if (!button) return;
    focusedReveal.current = reveal;
    setFocused(row.key);
    button.focus({ preventScroll: true });
    button.scrollIntoView({ block: "nearest" });
  }, [visible, reveal, rows]);
  const available = rows.filter((row) => row.kind !== "unsupported");
  const tabKey = available.some((row) => row.key === focused)
    ? focused
    : available[0]?.key;
  const focus = (row?: TreeRow) => {
    if (row) {
      setFocused(row.key);
      buttons.current.get(row.key)?.focus();
    }
  };
  const toggle = (row: TreeRow) => {
    const next = new Set(expanded);
    if (next.has(row.path)) next.delete(row.path);
    else {
      next.add(row.path);
      if (!directories[row.path]?.entries || directories[row.path]?.error)
        onLoad(row.path);
    }
    setExpanded(next);
  };
  return (
    <nav
      hidden={!visible}
      aria-label={t.workspaceFiles}
      className="ah-browser-picker"
      data-testid="editor-file-picker"
    >
      <header>
        <span>{t.files}</span>
        <ControlButton size="row" onPress={onClose} aria-label={t.closePicker}>
          {t.close}
        </ControlButton>
      </header>
      <label className="ah-tree-filter">
        {t.filter}
        <input
          data-testid="editor-file-filter"
          autoComplete="off"
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </label>
      <p className="ah-tree-scope">{t.scope}</p>
      <div className="ah-file-tree" role="tree" aria-label={t.workspaceFiles}>
        {rows.map((row) => {
          const folder = row.kind === "directory";
          const current = row.path === openPath;
          return (
            <div key={row.key} role="none">
              <button
                ref={(element) => {
                  if (element) buttons.current.set(row.key, element);
                  else buttons.current.delete(row.key);
                }}
                type="button"
                role="treeitem"
                data-testid="editor-file-entry"
                data-path={row.path}
                className="ah-tree-row"
                style={{ "--tree-depth": row.depth } as CSSProperties}
                title={row.path}
                aria-level={row.depth + 1}
                aria-posinset={row.position}
                aria-setsize={row.size}
                aria-expanded={folder ? expanded.has(row.path) : undefined}
                aria-current={current ? "page" : undefined}
                aria-disabled={row.kind === "unsupported" || undefined}
                disabled={row.kind === "unsupported"}
                tabIndex={row.key === tabKey ? 0 : -1}
                onFocus={() => setFocused(row.key)}
                onClick={() => (folder ? toggle(row) : onOpen(row.path))}
                onKeyDown={(event) => {
                  const index = available.findIndex(
                    (item) => item.key === row.key,
                  );
                  switch (event.key) {
                    case "ArrowDown":
                      focus(
                        available[Math.min(index + 1, available.length - 1)],
                      );
                      break;
                    case "ArrowUp":
                      focus(available[Math.max(index - 1, 0)]);
                      break;
                    case "Home":
                      focus(available[0]);
                      break;
                    case "End":
                      focus(available.at(-1));
                      break;
                    case "ArrowRight":
                      if (folder && !expanded.has(row.path)) toggle(row);
                      else if (
                        folder &&
                        available[index + 1]?.parent === row.key
                      )
                        focus(available[index + 1]);
                      break;
                    case "ArrowLeft":
                      if (folder && expanded.has(row.path)) toggle(row);
                      else
                        focus(
                          available.find((item) => item.key === row.parent),
                        );
                      break;
                    default:
                      return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <span className="ah-tree-guides" aria-hidden="true">
                  {Array.from({ length: row.depth }, (_, depth) => (
                    <i
                      // biome-ignore lint/suspicious/noArrayIndexKey: Guides are fixed depth slots, not stateful list items.
                      key={depth}
                      style={{ "--guide-depth": depth } as CSSProperties}
                    />
                  ))}
                </span>
                {folder ? (
                  <span aria-hidden="true" className="ah-disclosure-chevron" />
                ) : (
                  <span
                    className="ah-tree-disclosure-slot"
                    aria-hidden="true"
                  />
                )}
                <Icon name={folder ? "folder" : "file"} />
                <code>{row.label}</code>
                {row.kind === "unsupported" && (
                  <span className="ah-tree-state">{t.unsupported}</span>
                )}
                {current && (
                  <span
                    className="ah-tree-state"
                    data-testid="editor-file-state"
                  >
                    {dirty ? t.modified : t.open}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
      {filter && rows.length === 0 && <p role="status">{t.noMatches}</p>}
      {Object.entries(directories)
        .filter(([path]) => !path || filter.trim() || expanded.has(path))
        .map(([path, directory]) => (
          <div key={path} className="ah-tree-note">
            {directory.loading && <p role="status">{t.loading(path || "/")}</p>}
            {directory.error && (
              <>
                <p role="status">{t.unreadable(path || "/")}</p>
                <ControlButton
                  data-testid="editor-directory-retry"
                  size="row"
                  onPress={() => onLoad(path)}
                >
                  {t.retry}
                </ControlButton>
              </>
            )}
            {directory.truncated && (
              <p role="status">{t.truncated(path || "/")}</p>
            )}
          </div>
        ))}
    </nav>
  );
}
