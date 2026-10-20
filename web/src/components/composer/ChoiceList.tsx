import { useEffect } from "react";
import type { GitMark } from "../../app/composerReads";
import { Icon } from "../Icon";

/** One row of the composer's list. A loading or failed row is not pickable. */
export type Choice =
  | { type: "status"; text: string; loading?: boolean }
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
  | { type: "file"; path: string; git?: GitMark };

export type ChoiceGroup = { label: string; choices: Choice[] };

export const pickable = (c: Choice | undefined) =>
  !!c && c.type !== "status" && !(c.type === "command" && c.terminalOnly);

/** Flatten groups into rows; the index of a row is its option index. */
export function flatChoices(groups: ChoiceGroup[]): Choice[] {
  return groups.flatMap((g) => g.choices);
}

export const optionId = (list: string, i: number) => `${list}-opt-${i}`;

const gitLabel: Record<GitMark, [string, string]> = {
  modified: ["M", "muutettu"],
  added: ["A", "lisätty"],
  deleted: ["D", "poistettu"],
  renamed: ["R", "nimetty uudelleen"],
  untracked: ["U", "uusi, ei versionhallinnassa"],
  conflict: ["!", "ristiriita"],
};

export function GitBadge({ mark }: { mark: GitMark }) {
  const [letter, title] = gitLabel[mark];
  return (
    <span
      className={`ah-choice-git ah-choice-git-${mark === "untracked" ? "new" : "changed"}`}
      title={title}
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
  emptyText,
  onPick,
  onHover,
}: {
  id: string;
  label: string;
  groups: ChoiceGroup[];
  selected: number;
  marks?: Set<string>;
  emptyText: string;
  onPick: (index: number) => void;
  onHover?: (index: number) => void;
}) {
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
      <div
        key={`g:${group.label}`}
        className="ah-choice-group"
        role="presentation"
      >
        {group.label}
      </div>,
      ...group.choices.map((choice) => {
        index++;
        const i = index;
        if (choice.type === "status")
          return (
            <div
              key={`s:${i}`}
              className={`ah-choice-empty${choice.loading ? " ah-choice-loading" : ""}`}
              role="presentation"
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
          "aria-selected": i === selected,
          onClick: () => onPick(i),
          onMouseMove: () => onHover?.(i),
          onMouseDown: (e: { preventDefault: () => void }) =>
            e.preventDefault(),
        };
        if (choice.type === "file") {
          const slash = choice.path.lastIndexOf("/");
          return (
            <div
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
                <span className="ah-visually-hidden"> (merkitty)</span>
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
              <span className="ah-choice-why">vain Pi:n päätteessä</span>
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
