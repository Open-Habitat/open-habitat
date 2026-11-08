import { useEffect, useState } from "react";
import type { FilePreview, TreeFolder } from "../../app/composerReads";
import { useText } from "../../i18n";
import { previewPaneText } from "../../text/previewPane";
import { type Choice, GitBadge } from "./ChoiceList";

/** Read only after the selection rests on a file; a changed file shows its diff. */
function usePreview(
  choice: Choice | undefined,
  read?: (path: string, signal: AbortSignal) => Promise<FilePreview>,
) {
  const path = choice?.type === "file" ? choice.path : "";
  const [state, setState] = useState<{
    path: string;
    preview?: FilePreview;
    failed?: boolean;
  }>({ path: "" });
  useEffect(() => {
    if (!path || !read) return;
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      read(path, abort.signal).then(
        (preview) => setState({ path, preview }),
        () => {
          if (!abort.signal.aborted) setState({ path, failed: true });
        },
      );
    }, 150);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
  }, [path, read]);
  return state.path === path ? state : { path };
}

/** The selected row's preview beside the in-field list. */
export function PreviewPane({
  choice,
  read,
  folder,
  describe = false,
}: {
  choice: Choice | undefined;
  read?: (path: string, signal: AbortSignal) => Promise<FilePreview>;
  folder?: TreeFolder;
  describe?: boolean;
}) {
  const t = useText(previewPaneText);
  const state = usePreview(choice, read);
  if (!choice) return <p className="ah-pal-none">{t.nothingSelected}</p>;
  if (choice.type === "folder")
    return (
      <>
        <h2 className="ah-pal-mono">{choice.path}</h2>
        {choice.changed ? (
          <p className="ah-pal-state">{t.changedBeneath(choice.changed)}</p>
        ) : null}
        {!folder ? (
          <p className="ah-pal-none">{t.reading}</p>
        ) : folder.entries.length ? (
          <pre>
            {folder.entries
              .map((e) => e.path.slice(choice.path.length))
              .join("\n")}
            {folder.truncated ? "\n…" : ""}
          </pre>
        ) : (
          <p className="ah-pal-none">{t.emptyFolder}</p>
        )}
      </>
    );
  if (choice.type === "status")
    return <p className="ah-pal-none">{choice.text}</p>;
  if (choice.type === "command")
    return (
      <>
        <h2>/{choice.name}</h2>
        <p>{choice.description}</p>
        <dl>
          <dt>{t.source}</dt>
          <dd>{choice.tag}</dd>
        </dl>
        <p className="ah-pal-explain">
          {choice.run
            ? t.runsAtOnce
            : choice.terminalOnly
              ? t.terminalOnly
              : choice.tone === "skill"
                ? t.addsSkill
                : choice.tone === "prompt"
                  ? t.addsPrompt
                  : t.addsCommand}
        </p>
      </>
    );
  const p = state.preview;
  return (
    <>
      <h2 className="ah-pal-mono">
        {choice.path} {choice.git ? <GitBadge mark={choice.git} /> : null}
      </h2>
      {describe && choice.git ? (
        <p className="ah-pal-state">
          {choice.git === "untracked" ? t.untrackedState : t.changedState}
        </p>
      ) : null}
      {state.failed ? (
        <p className="ah-pal-none">{t.previewFailed}</p>
      ) : !p ? (
        <p className="ah-pal-none">{t.reading}</p>
      ) : p.kind === "binary" ? (
        <p className="ah-pal-none">{t.binary}</p>
      ) : (
        <pre className={p.kind === "diff" ? "ah-pal-diff" : undefined}>
          {p.kind === "diff"
            ? p.text.split("\n").map((line, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: preview lines are positional.
                  key={i}
                  className={
                    line.startsWith("+") && !line.startsWith("+++")
                      ? "ah-pal-add"
                      : line.startsWith("-") && !line.startsWith("---")
                        ? "ah-pal-del"
                        : undefined
                  }
                >
                  {line}
                  {"\n"}
                </span>
              ))
            : p.text}
          {p.truncated ? "…" : ""}
        </pre>
      )}
    </>
  );
}
