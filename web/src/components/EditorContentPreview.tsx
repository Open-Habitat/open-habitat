import { lazy } from "react";
import type { FileView } from "./editorPreview";

export const loadFilePreview = () => import("./EditorFilePreview");
const Frame = lazy(() => import("./DocumentPreviewFrame"));

/** Single editor renderer-selection boundary; offers and attachments stay generic. */
export function EditorContentPreview(props: {
  kind: FileView["kind"];
  text: string;
  path: string;
  workspace?: string;
  csrf?: string;
}) {
  return <Frame key={`${props.workspace}:${props.path}`} {...props} />;
}
