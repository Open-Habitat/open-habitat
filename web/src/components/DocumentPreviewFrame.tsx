import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { StartPageCheck } from "../app/startPageCheck";
import { useText } from "../i18n";
import { editorContentPreviewText } from "../text/editorContentPreview";
import { ControlButton } from "./ControlElements";
import type { FileView } from "./editorPreview";
import { Markdown } from "./Markdown";
import { preparePreviewInput } from "./previewInput";
import { choosePreviewRenderer } from "./previewRegistry";
import "./StartPagePreview.css";

const FilePreview = lazy(() => import("./EditorFilePreview"));
export default function DocumentPreviewFrame({
  kind,
  text,
  path,
  workspace,
  csrf,
}: {
  kind: FileView["kind"];
  text: string;
  path: string;
  workspace?: string;
  csrf?: string;
}) {
  const t = useText(editorContentPreviewText);
  const candidate = choosePreviewRenderer({ root: "workspace", path });
  const oversized =
    !!candidate && new TextEncoder().encode(text).byteLength > 32768;
  const input = useMemo(
    () =>
      oversized ? null : preparePreviewInput({ root: "workspace", path }, text),
    [path, text, oversized],
  );
  const [plain, setPlain] = useState(false);
  const [result, setResult] = useState<{
    input: typeof input;
    workspace?: string;
    csrf?: string;
    value: StartPageCheck | "unavailable";
  }>();
  useEffect(() => {
    if (!candidate || !input) return;
    const controller = new AbortController();
    if (!workspace || !csrf) {
      setResult({ input, workspace, csrf, value: "unavailable" });
    } else {
      candidate.read(input, { workspace, csrf }, controller.signal).then(
        (value) => {
          if (!controller.signal.aborted)
            setResult({ input, workspace, csrf, value });
        },
        () => {
          if (!controller.signal.aborted)
            setResult({ input, workspace, csrf, value: "unavailable" });
        },
      );
    }
    return () => controller.abort();
  }, [candidate, input, workspace, csrf]);
  const value = oversized
    ? {
        valid: false as const,
        problems: [{ code: "too_large" as const, path: "" }],
      }
    : result?.input === input &&
        result?.workspace === workspace &&
        result?.csrf === csrf
      ? result?.value
      : undefined;
  const special = candidate && value && value !== "unavailable" && value.valid;
  const View = candidate?.View;
  return (
    <>
      {candidate ? (
        <header className="ah-preview-check" data-testid="preview-check">
          <strong>{t[candidate.label]}</strong>
          <p role="status" data-testid="preview-validity">
            {!value
              ? t.checking
              : value === "unavailable"
                ? t.unavailable
                : value.valid
                  ? t.valid
                  : t.declined}
          </p>
          {value && value !== "unavailable" && !value.valid ? (
            <ul>
              {value.problems.map((problem) => (
                <li key={`${problem.path}:${problem.code}`}>
                  <code>{problem.path}</code> {t.problems[problem.code]}
                </li>
              ))}
            </ul>
          ) : null}
          {special ? (
            <ControlButton
              size="row"
              variant="quiet"
              data-testid="preview-renderer-toggle"
              aria-pressed={plain}
              onPress={() => setPlain(!plain)}
            >
              {plain ? t.special : t.plain}
            </ControlButton>
          ) : null}
        </header>
      ) : null}
      {special && !plain && View ? (
        <Suspense fallback={<p role="status">{t.checking}</p>}>
          <View page={value.page} />
        </Suspense>
      ) : kind === "markdown" ? (
        <Markdown text={text} document />
      ) : (
        <FilePreview kind={kind} text={text} path={path} />
      )}
    </>
  );
}
