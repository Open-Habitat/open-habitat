import { lazy } from "react";
import type { FileView } from "./editorPreview";
import { Markdown } from "./Markdown";

export const loadFilePreview = () => import("./EditorFilePreview");
const FilePreview = lazy(loadFilePreview);

/** The editor's renderer-selection boundary. A later file-specific renderer
 * can use path here without changing either generic YAML or Markdown rendering. */
export function EditorContentPreview({
  kind,
  text,
  path,
}: {
  kind: FileView["kind"];
  text: string;
  path: string;
}) {
  return kind === "markdown" ? (
    <Markdown text={text} document />
  ) : (
    <FilePreview kind={kind} text={text} path={path} />
  );
}
