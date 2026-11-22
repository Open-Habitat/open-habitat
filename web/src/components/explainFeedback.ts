import { serverInfo } from "../app/serverAdministration";
import { currentLanguage } from "../i18n";
import { explainModeText } from "../text/explainMode";
import type { CardId } from "./explainParts";

/* Feedback on an explain card (explain-mode-feedback, round 3 direction A):
 * the person's own words open as a prefilled public issue in the product's
 * GitHub repository, in a new tab of their own browser. Nothing is stored or
 * sent by the host; the issue exists only once they press Submit in GitHub.
 *
 * The URL carries exactly: the template name, a title naming the card, the
 * person's text, the card's id and English name, the product version and the
 * interface language. Never the server's name, the person, their account,
 * workspaces, conversations or the page address: the issue is public. */

export const FEEDBACK_REPO = "Open-Habitat/open-habitat";
/** The issue form in .github/ISSUE_TEMPLATE; its field ids are the query
 * parameters below. A form, not `body=`, because the repository disables
 * blank issues, which would drop a prefilled body for most people. */
export const FEEDBACK_TEMPLATE = "explain-feedback.yml";
export const NOTE_MAX = 600;

export type FeedbackIssue = {
  title: string;
  fields: { fix: string; card?: string; version: string; language: string };
  url: string;
};

export function feedbackIssue(
  id: CardId,
  note: string,
  version: string | undefined,
  language: string = currentLanguage(),
): FeedbackIssue {
  // The English card name, so issues read alike whatever the person's
  // language, and the id finds duplicates in GitHub search.
  const name = (explainModeText.en.cards[id] as { name: string }).name;
  const card = `${id} · ${name}`;
  const title = `Explanation wrong or incomplete: ${name} (${id})`;
  const fields = {
    fix: note.trim().slice(0, NOTE_MAX),
    card,
    version: version || "unknown",
    language,
  };
  const query = new URLSearchParams({
    template: FEEDBACK_TEMPLATE,
    title,
    ...fields,
  });
  return {
    title,
    fields,
    url: `https://github.com/${FEEDBACK_REPO}/issues/new?${query}`,
  };
}

export const GENERAL_NOTE_MAX = 1200;

/** General feedback deliberately has no selected part or page context. */
export function generalFeedbackIssue(
  note: string,
  version: string | undefined,
  language: string = currentLanguage(),
): FeedbackIssue {
  const title = "Feedback about Habitat";
  const fields = {
    fix: note.trim().slice(0, GENERAL_NOTE_MAX),
    version: version || "unknown",
    language,
  };
  const query = new URLSearchParams({
    template: "general-feedback.yml",
    title,
    ...fields,
  });
  return {
    title,
    fields,
    url: `https://github.com/${FEEDBACK_REPO}/issues/new?${query}`,
  };
}

/** The issue as plain text, for Copy text and the preview. */
export function feedbackText(issue: FeedbackIssue): string {
  const f = issue.fields;
  return [
    issue.title,
    "",
    f.fix,
    "",
    ...(f.card ? [`Card: ${f.card}`] : []),
    `Open Habitat ${f.version} · ${f.language}`,
  ].join("\n");
}

// The version is read once per page, when the first report opens; a failed
// read is tried again next time and the issue says "unknown" meanwhile.
let version: string | undefined;
let reading: Promise<string | undefined> | undefined;
export function readVersion(): Promise<string | undefined> {
  if (version !== undefined) return Promise.resolve(version);
  if (reading) return reading;
  reading = serverInfo()
    .then((info) => {
      version = info.version ?? "";
      return version;
    })
    .catch(() => undefined)
    .finally(() => {
      reading = undefined;
    });
  return reading;
}

/** Cards reported in this page, so returning to one says so. */
export const reportedNow = new Set<CardId>();
