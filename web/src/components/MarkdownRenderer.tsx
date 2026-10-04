import { isValidElement, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { ExternalLink } from "./ControlElements";
import { Button } from "./Primitives";

// Do not broaden this with the sanitizer's default schema: host content is untrusted.
const schema = {
  tagNames: [
    "p",
    "br",
    "strong",
    "em",
    "del",
    "blockquote",
    "hr",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "a",
    "pre",
    "code",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "input",
    "sup",
  ],
  attributes: {
    a: ["href", "title"],
    code: [["className", /^language-[a-zA-Z0-9_+-]+$/]],
    ol: ["start"],
    th: ["align"],
    td: ["align"],
    input: ["type", "checked", "disabled"],
  },
  protocols: { href: ["http", "https", "mailto"] },
};

function safeUrl(url: string): string {
  // Refuse control characters and protocol-relative URLs even if a parser normalizes them.
  if (
    Array.from(url).some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    ) ||
    url.includes("\\") ||
    url.startsWith("//")
  )
    return "";
  if (/^(https?:|mailto:)/i.test(url)) return url;
  if (/^(\/[^/]|\/$|#|\.\/|\.\.\/)/.test(url)) return url;
  return "";
}

function MarkdownCode({ text, language }: { text: string; language?: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 16000;
  return (
    <figure className="ah-code ah-markdown-code">
      <figcaption>{language || "Koodi"}</figcaption>
      <pre>
        <code>{long && !expanded ? `${text.slice(0, 16000)}\n…` : text}</code>
      </pre>
      <div className="ah-actions">
        <Button
          label="Kopioi koodi"
          variant="quiet"
          size="compact"
          onPress={() => void navigator.clipboard?.writeText(text)}
        />
        {long ? (
          <Button
            label={expanded ? "Näytä vähemmän" : "Näytä koko koodi"}
            variant="quiet"
            size="compact"
            onPress={() => setExpanded(!expanded)}
          />
        ) : null}
      </div>
    </figure>
  );
}

export default function MarkdownRenderer({ text }: { text: string }) {
  return (
    <div className="ah-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        skipHtml
        urlTransform={safeUrl}
        components={{
          a: ({ href, children, ...props }) => (
            <ExternalLink
              {...props}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </ExternalLink>
          ),
          pre: ({ children }) => {
            if (
              isValidElement<{ className?: string; children?: unknown }>(
                children,
              )
            ) {
              const language = children.props.className?.match(
                /^language-([a-zA-Z0-9_+-]+)$/,
              )?.[1];
              const content = children.props.children;
              if (typeof content === "string")
                return <MarkdownCode text={content} language={language} />;
            }
            return <pre>{children}</pre>;
          },
          table: ({ children }) => (
            <div className="ah-markdown-table">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
