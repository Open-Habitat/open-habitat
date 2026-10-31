import { liveText } from "../i18n";
import { appMessagesText } from "../text/appMessages";

const txt = liveText(appMessagesText);

export type BashFailure = {
  kind: "exit" | "timeout" | "aborted";
  amount?: number;
  status_line: string;
};
export function failureLabel(cause?: BashFailure) {
  if (!cause) return txt.failed;
  if (cause.kind === "exit") return txt.exitCode(cause.amount);
  if (cause.kind === "timeout") return txt.timeout(cause.amount);
  return txt.aborted;
}
// Remove only the exact daemon-recognized terminal line, not arbitrary output.
export function bashOutput(text?: string, cause?: BashFailure) {
  if (!text || !cause) return text;
  const trimmed = text.replace(/[\r\n]+$/, "");
  if (trimmed === cause.status_line) return "";
  const suffix = `\n${cause.status_line}`;
  return trimmed.endsWith(suffix)
    ? trimmed.slice(0, -suffix.length).replace(/[\r\n]+$/, "")
    : text;
}
/** A tool that Pi's abort ended was stopped by the person, not failed. */
export function toolStopped(cause?: BashFailure) {
  return cause?.kind === "aborted";
}
