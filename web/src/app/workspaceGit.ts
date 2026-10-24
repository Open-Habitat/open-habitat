import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import common from "../../../contracts/v1/common.schema.json";
import schema from "../../../contracts/v1/workspace-git.schema.json";
import type { GitDetailFacts } from "../components/GitStatus";
import { jsonWrite, WriteRefused, writeOutcome } from "./mutations";

const ajv = addFormats(new Ajv({ strict: false }));
ajv.addSchema(common);
const validate = ajv.compile(schema);
export type WorkspaceGit = GitDetailFacts & {
  schema_version: 1;
  workspace_id: string;
};
export async function workspaceGit(
  id: string,
  signal: AbortSignal,
): Promise<WorkspaceGit> {
  const response = await fetch(
    `/api/v1/workspaces/git?${new URLSearchParams({ workspace_id: id })}`,
    { signal, credentials: "same-origin", cache: "no-store" },
  );
  if (!response.ok) throw new Error("Git-tilaa ei voitu lukea.");
  return readGit(response, id);
}

/** Päivitä tila: `git fetch` as the person; the reply is the state read again. */
export async function fetchWorkspaceGit(
  id: string,
  csrf: string,
): Promise<WorkspaceGit> {
  const outcome = await writeOutcome(
    await jsonWrite(
      "workspace.git_fetch",
      "/api/v1/workspaces/git/fetch",
      { workspace_id: id },
      csrf,
    ).catch(() => undefined),
  );
  if (outcome.kind === "refused")
    throw new WriteRefused(outcome.status, outcome.code);
  if (outcome.kind !== "ok") throw new Error(outcome.kind);
  return readGit(outcome.response, id);
}

/** Why Päivitä tila did not fetch, in words the person can act on. */
export function fetchFailureReason(error: unknown): string {
  const code = error instanceof WriteRefused ? error.code : "";
  switch (code) {
    case "remote_ssh_unavailable":
      return "Haku epäonnistui: etärepo käyttää SSH:ta, eikä palvelimella ole SSH-agenttia tai avainta, jolla yhteys aukeaisi. Hae päätteessä tai vaihda etärepo HTTPS-osoitteeseen.";
    case "remote_auth_unavailable":
      return "Haku epäonnistui: etärepo vaati kirjautumisen, eikä Git löytänyt tunnuksia palvelimelta.";
    case "remote_unreachable":
      return "Haku epäonnistui: etärepoon ei saatu yhteyttä.";
    case "remote_rewritten":
      return "Hakua ei tehty: Git-asetuksesi (url.insteadOf tai pushInsteadOf) ohjaisivat Gitea-etärepon osoitteen muualle, tai etärepolla on useampi osoite. Tarkista asetukset päätteessä.";
    case "remote_not_found":
      return "Haku epäonnistui: etärepoa ei löytynyt tai siihen ei ole pääsyä.";
    case "fetch_timeout":
      return "Haku keskeytettiin, koska se kesti yli 45 sekuntia. Hae päätteessä.";
    case "no_remote":
      return "Työtilalla ei ole etärepoa, josta hakea.";
    case "fetch_in_progress":
      return "Haku on jo käynnissä.";
    case "workspace_changed":
    case "workspace_unavailable":
      return "Työtila muuttui. Lue tila uudelleen.";
    case "fetch_failed":
      return "Haku epäonnistui. Git ei kertonut syytä, jonka voisi näyttää.";
    default:
      return error instanceof WriteRefused
        ? "Palvelin ei hyväksynyt hakua."
        : error instanceof Error && error.message === "login"
          ? "Istunto päättyi. Kirjaudu uudelleen."
          : "Haun tulos jäi epävarmaksi. Lue tila uudelleen.";
  }
}

async function readGit(response: Response, id: string): Promise<WorkspaceGit> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Git-tilaa ei voitu lukea.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Git-vastaus ylitti lukurajan.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const value: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  );
  if (!validate(value) || (value as WorkspaceGit).workspace_id !== id)
    throw new Error("Git-tilaa ei voitu vahvistaa.");
  return value as WorkspaceGit;
}
