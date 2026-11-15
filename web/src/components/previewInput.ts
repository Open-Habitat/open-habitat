import { splitFrontmatter } from "./frontmatter";
import {
  parseJsonPreview,
  parseYamlPreview,
  type YamlPreview,
} from "./yamlPreview";

export type PreviewLocator =
  | { root: "workspace"; path: string }
  | { root: "offer"; path: string }
  | { root: "none"; path?: string };
export type PreviewInput = {
  locator: PreviewLocator;
  text: string;
  format: "markdown" | "yaml" | "json" | "other";
  data: YamlPreview | null;
  body: string;
};

/** Prepared once at the frame boundary, without interpreting a file's meaning. */
export function preparePreviewInput(
  locator: PreviewLocator,
  text: string,
): PreviewInput {
  const path = locator.path ?? "";
  if (/\.(md|markdown)$/i.test(path)) {
    const { frontmatter, body } = splitFrontmatter(text);
    return {
      locator,
      text,
      format: "markdown",
      data: frontmatter ? parseYamlPreview(frontmatter.raw) : null,
      body,
    };
  }
  if (/\.json$/i.test(path))
    return {
      locator,
      text,
      format: "json",
      data: parseJsonPreview(text),
      body: "",
    };
  if (/\.ya?ml$/i.test(path))
    return {
      locator,
      text,
      format: "yaml",
      data: parseYamlPreview(text),
      body: "",
    };
  return { locator, text, format: "other", data: null, body: text };
}
