import { useEffect } from "react";
import type { GitMark } from "../../app/composerReads";
import { useText } from "../../i18n";
import { choiceListText } from "../../text/choiceList";
import { Icon } from "../Icon";
import { ownName } from "./fieldTree";

/** One row of the composer's list. A loading or failed row is not pickable. */
export type Choice =
  | {
      type: "status";
      text: string;
      loading?: boolean;
      /** In the folder tree: its indentation, and the folder it waits for. */
      depth?: number;
      folder?: string;
    }
  | {
      type: "command";
      name: string;
      description: string;
      tag: string;
      tone: "skill" | "prompt" | "extension" | "browser";
      /** Opens Pi's own terminal dialogs: listed, not runnable here. */
      terminalOnly?: boolean;
      /** A browser action runs at once instead of inserting text. */
      run?: () => void;
    }
  | {
      type: "file";
      path: string;
      git?: GitMark;
      /** In the folder tree: the row shows its own name, indented. */
      depth?: number;
      /** In the in-field search: the folder shown after the name. */
      where?: string;
    }
  /** A folder of the in-field tree; its path ends with a slash. */
  | {
      type: "folder";
      path: string;
      /** Changed files beneath it. */
      changed: number;
      depth: number;
      open: boolean;
    };

export type ChoiceGroup = { label: string; choices: Choice[] };

export const pickable = (c: Choice | undefined) =>
  !!c && c.type !== "status" && !(c.type === "command" && c.terminalOnly);

/** Flatten groups into rows; the index of a row is its option index. */
export function flatChoices(groups: ChoiceGroup[]): Choice[] {
  return groups.flatMap((g) => g.choices);
}

export const optionId = (list: string, i: number) => `${list}-opt-${i}`;

/** A tree row's indentation by its depth. */
const indent = (depth?: number) =>
  depth === undefined ? undefined : { paddingLeft: `${10 + 18 * depth}px` };

const gitLetter: Record<GitMark, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  untracked: "U",
  conflict: "!",
};

export function GitBadge({ mark }: { mark: GitMark }) {
  const letter = gitLetter[mark];
  const title = useText(choiceListText).git[mark];
  return (
    <span
      className={`ah-choice-git ah-choice-git-${mark === "untracked" ? "new" : "changed"}`}
      title={title}
      data-testid="file-git-mark"
      data-git-mark={mark}
    >
      {letter}
      <span className="ah-visually-hidden"> {title}</span>
    </span>
  );
}

/** The list the caret list, the buttons' lists and the palette share: same
 * rows, groups and tags; only the placement differs. Rows are picked with the
 * mouse here; keys stay with the field or the search input that owns focus. */
export function ChoiceList({
  id,
  label,
  groups,
  selected,
  marks,
  checks,
  emptyText,
  onPick,
  onHover,
}: {
  id: string;
  label: string;
  groups: ChoiceGroup[];
  selected: number;
  marks?: Set<string>;
  /** The in-field list: a box on every file and folder row marks it. */
  checks?: { marked: readonly string[]; onMark: (index: number) => void };
  emptyText: string;
  onPick: (index: number) => void;
  onHover?: (index: number) => void;
}) {
  const t = useText(choiceListText);
  useEffect(() => {
    if (selected >= 0)
      document
        .getElementById(optionId(id, selected))
        ?.scrollIntoView?.({ block: "nearest" });
  }, [id, selected]);
  let index = -1;
  const rows = groups.flatMap((group) => {
    if (!group.choices.length) return [];
    return [
      group.label ? (
        <div
          key={`g:${group.label}`}
          className="ah-choice-group"
          role="presentation"
        >
          {group.label}
        </div>
      ) : null,
      ...group.choices.map((choice) => {
        index++;
        const i = index;
        if (choice.type === "status")
          return (
            <div
              key={`s:${i}`}
              className={`ah-choice-empty${choice.loading ? " ah-choice-loading" : ""}`}
              role="presentation"
              style={indent(choice.depth)}
            >
              {choice.loading ? (
                <span className="ah-choice-dot" aria-hidden="true" />
              ) : null}
              {choice.text}
            </div>
          );
        const common = {
          id: optionId(id, i),
          role: "option" as const,
          "data-testid":
            choice.type === "command"
              ? `composer-command-${choice.name}`
              : choice.type === "folder"
                ? "composer-folder-choice"
                : "composer-file-choice",
          "aria-selected": i === selected,
          onClick: () => onPick(i),
          onMouseMove: () => onHover?.(i),
          onMouseDown: (e: { preventDefault: () => void }) =>
            e.preventDefault(),
        };
        if (checks && (choice.type === "file" || choice.type === "folder")) {
          const marked = checks.marked.includes(choice.path);
          const tree = choice.type === "folder" || choice.depth !== undefined;
          const named = choice.type === "file" && choice.where !== undefined;
          const name = tree || named ? ownName(choice.path) : choice.path;
          return (
            <div
              data-path={choice.path}
              key={`${choice.type}:${choice.path}`}
              className={`ah-choice-file${choice.type === "folder" ? " ah-choice-folder" : ""}${choice.type === "file" && choice.git ? " ah-choice-changed" : ""}`}
              data-open={
                choice.type === "folder" ? String(choice.open) : undefined
              }
              data-marked={marked || undefined}
              style={tree ? indent(choice.depth) : undefined}
              {...common}
            >
              {/* The box answers a press; the keyboard marks with Tab, and a
                  screen reader hears the row's marked note. */}
              <span
                className="ah-choice-check"
                data-testid="composer-mark"
                aria-hidden="true"
                onClick={(e) => {
                  e.stopPropagation();
                  checks.onMark(i);
                }}
              >
                <Icon name="check" />
              </span>
              {tree ? (
                <span className="ah-choice-twist" aria-hidden="true">
                  {choice.type === "folder" ? "›" : ""}
                </span>
              ) : null}
              <Icon
                name={choice.type === "folder" ? "folder" : "file"}
                className="ah-choice-icon"
              />
              {named ? (
                <span className="ah-choice-path ah-choice-named">
                  <span className="ah-choice-name-first">{name}</span>
                  <span className="ah-choice-dir ah-choice-where">
                    {choice.where}
                  </span>
                </span>
              ) : (
                <span className="ah-choice-path">{name}</span>
              )}
              {choice.type === "file" && choice.git ? (
                <GitBadge mark={choice.git} />
              ) : null}
              {choice.type === "folder" ? (
                <span className="ah-visually-hidden">
                  {" "}
                  {choice.open ? t.folderOpen : t.folderClosed}
                </span>
              ) : null}
              {marked ? (
                <span className="ah-visually-hidden"> {t.marked}</span>
              ) : null}
              {choice.type === "folder" && choice.changed ? (
                <span
                  className="ah-choice-count"
                  data-testid="composer-folder-changed"
                  title={t.changedBeneath(choice.changed)}
                >
                  {choice.changed}
                  <span className="ah-visually-hidden">
                    {" "}
                    {t.changedBeneath(choice.changed)}
                  </span>
                </span>
              ) : null}
            </div>
          );
        }
        if (choice.type === "folder") return null;
        if (choice.type === "file") {
          const slash = choice.path.lastIndexOf("/");
          return (
            <div
              data-path={choice.path}
              key={`f:${choice.path}`}
              className="ah-choice-file"
              {...common}
            >
              {marks ? (
                <span className="ah-choice-mark" aria-hidden="true">
                  {marks.has(choice.path) ? "●" : ""}
                </span>
              ) : null}
              <Icon name="file" className="ah-choice-icon" />
              <span className="ah-choice-path">
                <span className="ah-choice-dir">
                  {choice.path.slice(0, slash + 1)}
                </span>
                {choice.path.slice(slash + 1)}
              </span>
              {choice.git ? <GitBadge mark={choice.git} /> : null}
              {marks?.has(choice.path) ? (
                <span className="ah-visually-hidden"> {t.marked}</span>
              ) : null}
            </div>
          );
        }
        return (
          <div
            key={`c:${choice.tone}:${choice.name}`}
            className="ah-choice-command"
            aria-disabled={choice.terminalOnly || undefined}
            {...common}
          >
            <span className="ah-choice-name">/{choice.name}</span>
            <span className={`ah-choice-tag ah-choice-tag-${choice.tone}`}>
              {choice.tag}
            </span>
            {choice.description ? (
              <span className="ah-choice-desc">{choice.description}</span>
            ) : null}
            {choice.terminalOnly ? (
              <span className="ah-choice-why">{t.terminalOnly}</span>
            ) : null}
          </div>
        );
      }),
    ];
  });
  return (
    <div className="ah-choice-list" role="listbox" id={id} aria-label={label}>
      {index < 0 ? (
        <div className="ah-choice-empty" role="presentation">
          {emptyText}
        </div>
      ) : (
        rows
      )}
    </div>
  );
}
