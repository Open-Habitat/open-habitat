import common from "../../../contracts/v1/common.schema.json";
import composer from "../../../contracts/v1/composer.schema.json";
import schema from "../../../contracts/v1/start-page-check.schema.json";
import type { StartPage } from "./composerReads";
import { LazyAjv } from "./lazyAjv";
import { jsonWrite } from "./mutations";
import { readJSON as bounded } from "./readJSON";

export type StartPageProblem = {
  code:
    | "too_large"
    | "invalid_utf8"
    | "missing_frontmatter"
    | "missing_frontmatter_end"
    | "invalid_frontmatter"
    | "invalid_page_fields"
    | "invalid_goal_fields"
    | "invalid_step"
    | "invalid_skill";
  path: string;
};
export type CheckedStartPage = Exclude<StartPage, { state: string }>;
export type StartPageCheck =
  | { valid: true; page: CheckedStartPage }
  | { valid: false; problems: StartPageProblem[] };
const ajv = new LazyAjv({ strict: false });
ajv.addSchema(common);
ajv.addSchema(composer);
ajv.addSchema(schema);
const valid = ajv.compile({ $ref: `${schema.$id}#/$defs/reply` });

export async function checkStartPage(
  workspace: string,
  content: string,
  csrf: string,
  signal: AbortSignal,
): Promise<StartPageCheck> {
  const response = await jsonWrite(
    "editor.checkStartPage",
    "/api/v1/workspaces/start_page/check",
    { schema_version: 1, workspace_id: workspace, content },
    csrf,
    { signal },
  );
  if (!response.ok) throw new Error("check unavailable");
  const value = await bounded(response, 256 * 1024);
  if (!valid(value)) throw new Error("invalid check reply");
  return value as StartPageCheck;
}
