import { catalog } from "../i18n";

// What fetching remote refs found (app/ConversationGitStatus.tsx).
const fi = {
  incoming: (upstream: string, n: number) => `${upstream}: ${n} tulossa`,
  behind: (base: string, n: number) => `${base}: ${n} jäljessä`,
  fetched: (parts: string[]) =>
    `Etätiedot haettu. ${parts.length ? `${parts.join(". ")}.` : "Vertailutietoja ei ole saatavilla."}`,
  loadingSession: "Ladataan istuntoa.",
};

export const conversationGitStatusText = catalog(fi, {
  incoming: (upstream, n) => `${upstream}: ${n} incoming`,
  behind: (base, n) => `${base}: ${n} behind`,
  fetched: (parts) =>
    `Remote refs fetched. ${parts.length ? `${parts.join(". ")}.` : "No comparison is available."}`,
  loadingSession: "Loading the session.",
});
