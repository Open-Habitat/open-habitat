import { useMemo } from "react";
import "./YamlPreview.css";
import { useText } from "../i18n";
import { yamlPreviewText } from "../text/yamlPreview";
import { parseYamlPreview, type YamlValue } from "./yamlPreview";

function NestedValue({
  value,
  depth = 0,
}: {
  value: YamlValue;
  depth?: number;
}) {
  const t = useText(yamlPreviewText);
  const capped = depth >= 4;
  if (value === null || value === "" || (value instanceof Map && !value.size))
    return <span className="ah-yaml-empty">{t.empty}</span>;
  if (Array.isArray(value)) {
    if (!value.length)
      return <span className="ah-yaml-empty">{t.noItems}</span>;
    const chips =
      value.length <= 8 &&
      value.every(
        (v) => typeof v === "string" && v.length <= 24 && !v.includes("\n"),
      );
    const cards = value.every((v) => v instanceof Map);
    const List = cards ? "ol" : "ul";
    return (
      <List
        className={
          chips ? "ah-yaml-chips" : cards ? "ah-yaml-cards" : "ah-yaml-list"
        }
        data-flat={capped || undefined}
      >
        {value.map((item, i) => {
          const titleKey =
            cards && item instanceof Map
              ? ["title", "name", "heading"].find(
                  (k) =>
                    typeof item.get(k) === "string" &&
                    item.get(k) !== "" &&
                    !String(item.get(k)).includes("\n"),
                )
              : undefined;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: source order identifies static preview items.
            <li key={i} className={cards ? "ah-yaml-card" : undefined}>
              {cards ? (
                <header>
                  <span className="ah-yaml-index">{i + 1}</span>
                  {titleKey && item instanceof Map ? (
                    <strong>{String(item.get(titleKey))}</strong>
                  ) : null}
                </header>
              ) : null}
              {!(titleKey && item instanceof Map && item.size === 1) ? (
                <NestedValue
                  value={
                    titleKey && item instanceof Map
                      ? new Map([...item].filter(([k]) => k !== titleKey))
                      : item
                  }
                  depth={depth + 1}
                />
              ) : null}
            </li>
          );
        })}
      </List>
    );
  }
  if (value instanceof Map)
    return (
      <dl className="ah-yaml-map" data-flat={capped || undefined}>
        {[...value].map(([key, item]) => (
          <div key={key}>
            <dt>{key || t.empty}</dt>
            <dd>
              <NestedValue value={item} depth={depth + 1} />
            </dd>
          </div>
        ))}
      </dl>
    );
  if (typeof value === "string")
    return value.includes("\n") ? (
      <blockquote className="ah-yaml-block">{value}</blockquote>
    ) : (
      <span>{value}</span>
    );
  return <code>{String(value)}</code>;
}

/** Shared generic renderer. Callers choose this renderer, not its internals;
 * a future file-specific preview can replace it at the editor entry point. */
export function YamlPreview({
  text,
  frontmatter = false,
}: {
  text: string;
  frontmatter?: boolean;
}) {
  const t = useText(yamlPreviewText);
  const parsed = useMemo(() => parseYamlPreview(text), [text]);
  return (
    <section
      className={`ah-yaml${frontmatter ? " ah-frontmatter" : ""}`}
      data-testid={frontmatter ? "markdown-frontmatter" : "yaml-preview"}
      aria-label={t.label}
    >
      {parsed.ok ? (
        <NestedValue value={parsed.value} />
      ) : (
        <>
          <p role="status">
            {parsed.reason === "invalid"
              ? t.invalid(
                  parsed.line === undefined
                    ? undefined
                    : parsed.line + (frontmatter ? 1 : 0),
                )
              : t.unsupported}
          </p>
          <pre data-testid="markdown-frontmatter-raw">
            <code>{text}</code>
          </pre>
        </>
      )}
    </section>
  );
}
