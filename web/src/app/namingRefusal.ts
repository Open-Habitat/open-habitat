import { liveText } from "../i18n";
import { namingText } from "../text/naming";
import { ConversationNotFound, NotAdmitted } from "./conversations";

const txt = liveText(namingText);

/** The reason for a refused naming code, in the person's language. Every
 * naming refusal has one: the person needs to know what to do next. */
export function namingReason(code: string): string {
  switch (code) {
    case "title_pending":
      return txt.titlePending;
    case "writer_conflict":
      return txt.writerElsewhere;
    default:
      return txt.notNow;
  }
}

/** The sentence for a manual name the host refused with this code. */
export function nameRefusal(code: string): string {
  return txt.nameRefused(namingReason(code));
}

/** The reason when the host definitely refused a title or name (nothing was
 * written); undefined when the outcome is unknown or a model failed. */
export function namingRefusal(error: unknown): string | undefined {
  if (error instanceof NotAdmitted) return namingReason(error.code);
  if (error instanceof ConversationNotFound) return txt.notNow;
  return undefined;
}

/** Why a title model failed to make a title, when no model was usable. */
export const titleModelUnavailable = () => txt.modelUnavailable;

/** A manual name the host refused, carrying the sentence to show. */
export class NameNotSaved extends Error {
  constructor(readonly reason: string) {
    super("name not saved");
  }
}

/** Rethrows a refused manual name with its reason for the name field. */
export function nameRefused(error: unknown): unknown {
  const reason = namingRefusal(error);
  return reason ? new NameNotSaved(txt.nameRefused(reason)) : error;
}
