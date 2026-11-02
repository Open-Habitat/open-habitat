import schema from "../../../contracts/v1/site-language.schema.json";
import { LazyAjv } from "../app/lazyAjv";
import { type LanguageChoice, setServerLanguage } from ".";

const validate = new LazyAjv({ strict: false }).compile<{
  schema_version: 1;
  default_language: LanguageChoice;
}>(schema);

/** Reads the server's default language, which needs no session. Without an
 * answer (no host, as in the demo) the browser's language applies. */
export async function loadSiteLanguage(): Promise<void> {
  try {
    const response = await fetch("/api/v1/site/language", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (
      !response.ok ||
      response.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      return;
    const text = await response.text();
    if (text.length > 256) return;
    const body: unknown = JSON.parse(text);
    if (validate(body)) setServerLanguage(body.default_language);
  } catch {
    // The browser's language stays.
  }
}
