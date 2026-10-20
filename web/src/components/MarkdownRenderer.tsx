import { attachmentURL } from "../app/attachments";
import { isValidElement, type ReactNode, useContext } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { ExternalLink } from "./ControlElements";
import { FileLinkContext, parseFileRef } from "./fileRefs";
import { OutputBox } from "./OutputBox";
import remarkFileRefs from "./remarkFileRefs";

// Do not broaden this with the sanitizer's default schema: host content is untrusted.
const schema = {
  tagNames: [
    "img",
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
    img: ["src", "alt"],
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

// The parser gives each fence its own source range; counting fence-like lines
// across the whole answer misclassifies backticks inside code and open streams.
function fenceComplete(source: string, start?: number, end?: number): boolean {
  if (start === undefined || end === undefined) return false;
  const block = source.slice(start, end);
  const opening = /^ {0,3}(`{3,}|~{3,})[^\n]*\n/.exec(block);
  if (!opening) return false;
  const mark = opening[1][0];
  const width = opening[1].length;
  const last = block.trimEnd().split("\n").at(-1) ?? "";
  const closing = /^ {0,3}(`+|~+)\s*$/.exec(last);
  return !!closing && closing[1][0] === mark && closing[1].length >= width;
}

function MarkdownCode({
  text,
  language,
  complete,
}: {
  text: string;
  language?: string;
  complete: boolean;
}) {
  return (
    <figure className="ah-markdown-code">
      <OutputBox
        text={text}
        language={
          language === "bash" || language === "sh"
            ? "shell"
            : language === "py"
              ? "python"
              : language
        }
        copyLabel="Kopioi koodi"
        complete={complete}
        detect={!language}
      />
    </figure>
  );
}

// Inline code that names a workspace file opens it in the editor beside the
// conversation, where one is offered; elsewhere it stays code.
function InlineCode({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const links = useContext(FileLinkContext);
  const text = typeof children === "string" ? children : "";
  const ref = links && !className && text ? parseFileRef(text) : null;
  if (!links || !ref) return <code className={className}>{children}</code>;
  const where = ref.line
    ? ref.end
      ? `, rivit ${ref.line}–${ref.end}`
      : `, rivi ${ref.line}`
    : "";
  return (
    <code className="ah-file-link-code">
      <a
        className={`ah-file-link${links.opened === text ? " ah-file-link-opened" : ""}`}
        href={`#${encodeURIComponent(text)}`}
        title={`Avaa editorissa: ${ref.path}${where}`}
        onClick={(event) => {
          event.preventDefault();
          links.open(ref, text);
        }}
      >
        {children}
      </a>
    </code>
  );
}

function MarkdownLink({
  href,
  children,
  title,
}: {
  href?: string;
  children?: ReactNode;
  title?: string;
}) {
  const links = useContext(FileLinkContext);
  const ref = href ? parseFileRef(href) : null;
  if (ref) {
    // Never navigate a workspace file URL on the app origin, even when the
    // editor is unavailable (e.g. on a phone).
    if (!links) return <>{children}</>;
    return (
      <a
        href={`#${encodeURIComponent(href ?? "")}`}
        className={`ah-file-link${links.opened === href ? " ah-file-link-opened" : ""}`}
        title={`Avaa editorissa: ${href}`}
        onClick={(event) => {
          event.preventDefault();
          links.open(ref, href ?? "");
        }}
      >
        <FileLinkContext.Provider value={null}>
          {children}
        </FileLinkContext.Provider>
      </a>
    );
  }
  return (
    <ExternalLink
      href={href}
      title={title}
      download={
        href && attachmentURL.test(href) && typeof children === "string"
          ? children
          : undefined
      }
      target="_blank"
      rel="noopener noreferrer"
    >
      <FileLinkContext.Provider value={null}>
        {children}
      </FileLinkContext.Provider>
    </ExternalLink>
  );
}

export default function MarkdownRenderer({ text }: { text: string }) {
  return (
    <div className="ah-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkFileRefs]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        skipHtml
        urlTransform={safeUrl}
        components={{
          img: ({ src, alt }) =>
            typeof src === "string" && attachmentURL.test(src) ? (
              <a href={src} target="_blank" rel="noopener noreferrer">
                <img
                  src={src}
                  alt={alt ?? "Liite"}
                  loading="lazy"
                  style={{ maxWidth: "100%", maxHeight: 240 }}
                />
              </a>
            ) : (
              <span>{alt}</span>
            ),
          a: ({ href, children, title }) => (
            <MarkdownLink href={href} title={title}>
              {children}
            </MarkdownLink>
          ),
          pre: ({ children, node }) => {
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
                return (
                  <MarkdownCode
                    text={content}
                    language={language}
                    complete={fenceComplete(
                      text,
                      node?.position?.start?.offset,
                      node?.position?.end?.offset,
                    )}
                  />
                );
            }
            return <pre>{children}</pre>;
          },
          code: ({ className, children }) => (
            <InlineCode className={className}>{children}</InlineCode>
          ),
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
