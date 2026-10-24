export type BashFailure = {
  kind: "exit" | "timeout" | "aborted";
  amount?: number;
  status_line: string;
};
export function failureLabel(cause?: BashFailure) {
  if (!cause) return "epäonnistui";
  if (cause.kind === "exit") return `paluuarvo ${cause.amount}`;
  if (cause.kind === "timeout") return `aikakatkaisu ${cause.amount} s`;
  return "keskeytetty";
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
