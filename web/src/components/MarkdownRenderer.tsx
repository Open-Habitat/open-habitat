import {
  createContext,
  isValidElement,
  memo,
  type ReactNode,
  useContext,
  useState,
} from "react";
import ReactMarkdown, {
  type Components,
  type ExtraProps,
  type Options,
} from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { attachmentURL } from "../app/attachments";
import { AttachmentPreview } from "./AttachmentPreview";
import { ControlButton, ExternalLink } from "./ControlElements";
import { FileLinkContext, parseFileRef } from "./fileRefs";
import { MermaidDiagram } from "./MermaidDiagram";
import { OutputBox } from "./OutputBox";
import rehypeStableText from "./rehypeStableText";
import remarkBreaks from "./remarkBreaks";
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

/** An attached image in Markdown opens in the preview dialog, not a raw tab. */
function AttachmentImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ControlButton
        data-testid="attachment-open"
        className="ah-markdown-attachment"
        variant="quiet"
        size="inline"
        aria-label={`Avaa liite ${alt}`}
        onPress={() => setOpen(true)}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          style={{ maxWidth: "100%", maxHeight: 240 }}
        />
      </ControlButton>
      {open ? (
        <AttachmentPreview
          attachment={{ image: true, name: alt, url: src, source: "" }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

// The reply source, for telling a finished fence from one still streaming.
const SourceContext = createContext("");

function MarkdownPre({
  children,
  node,
}: ExtraProps & { children?: ReactNode }) {
  const text = useContext(SourceContext);
  if (isValidElement<{ className?: string; children?: unknown }>(children)) {
    const language = children.props.className?.match(
      /^language-([a-zA-Z0-9_+-]+)$/,
    )?.[1];
    const content = children.props.children;
    if (typeof content === "string") {
      const complete = fenceComplete(
        text,
        node?.position?.start?.offset,
        node?.position?.end?.offset,
      );
      const code = (
        <MarkdownCode text={content} language={language} complete={complete} />
      );
      return language === "mermaid" ? (
        <MermaidDiagram source={content} complete={complete} fallback={code} />
      ) : (
        code
      );
    }
  }
  return <pre>{children}</pre>;
}

// React compares component types by identity. Components created per render
// would remount every code block, link and inline code on each re-render of a
// reply, replacing the DOM under a selection and resetting hover state.
const components: Components = {
  img: ({ src, alt }) =>
    typeof src === "string" && attachmentURL.test(src) ? (
      <AttachmentImage src={src} alt={alt || "Liite"} />
    ) : (
      <span>{alt}</span>
    ),
  a: ({ href, children, title }) => (
    <MarkdownLink href={href} title={title}>
      {children}
    </MarkdownLink>
  ),
  pre: MarkdownPre,
  code: ({ className, children }) => (
    <InlineCode className={className}>{children}</InlineCode>
  ),
  table: ({ children }) => (
    <div className="ah-markdown-table">
      <table>{children}</table>
    </div>
  ),
};
const plainPlugins = [remarkGfm, remarkFileRefs];
const breakPlugins = [remarkGfm, remarkBreaks, remarkFileRefs];
const rehypePlugins: Options["rehypePlugins"] = [
  [rehypeSanitize, schema],
  rehypeStableText,
];

// A settled reply re-renders with its parent (clock ticks, live updates of
// other turns); unchanged text needs no new parse.
export default memo(function MarkdownRenderer({
  text,
  breaks = false,
}: {
  text: string;
  breaks?: boolean;
}) {
  return (
    <div className="ah-markdown">
      <SourceContext.Provider value={text}>
        <ReactMarkdown
          remarkPlugins={breaks ? breakPlugins : plainPlugins}
          rehypePlugins={rehypePlugins}
          skipHtml
          urlTransform={safeUrl}
          components={components}
        >
          {text}
        </ReactMarkdown>
      </SourceContext.Provider>
    </div>
  );
});
