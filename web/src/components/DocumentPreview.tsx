import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useMemo, useRef, useState } from "react";
import { type PreviewKind, utf8 } from "../app/attachments";
import {
  columnName,
  frameCSP,
  inertMarkup,
  readPresentation,
  readWorkbook,
  type Sheet,
  type Slide,
  zipWithinLimits,
} from "../app/documentPreview";
import { Markdown } from "./Markdown";
import { Tabs } from "./Overlays";

/** Pages beyond this are left out of the preview; the file has them all. */
export const pdfPageLimit = 200;

function Unavailable() {
  return (
    <p
      className="ah-attachment-preview-note"
      data-testid="attachment-preview-unavailable"
      role="status"
    >
      Esikatselu ei onnistunut. Lataa tiedosto ja avaa se omalla ohjelmalla.
    </p>
  );
}

function Loading() {
  return (
    <p className="ah-attachment-preview-note" role="status">
      Avataan esikatselua…
    </p>
  );
}

/**
 * A document's content from its bytes. Nothing in it runs: PDF pages are
 * drawn onto canvases by pdf.js, which has no document scripting outside its
 * viewer; Markdown goes through the app's sanitising renderer; a Word
 * document is laid out into an inert document, stripped of active content and
 * shown in a frame without scripts, origin or network; sheets and slides are
 * read into text that React escapes.
 */
export default function DocumentPreview({
  kind,
  bytes,
  name,
}: {
  kind: PreviewKind;
  bytes: Uint8Array;
  name: string;
}) {
  return (
    // A scrolling region is reachable from the keyboard.
    <section
      className={`ah-attachment-document ah-attachment-document-${kind}`}
      data-testid="attachment-document"
      data-preview-kind={kind}
      aria-label={name}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the region scrolls.
      tabIndex={0}
    >
      {kind === "pdf" ? (
        <PdfPages bytes={bytes} />
      ) : kind === "markdown" ? (
        <div className="ah-attachment-markdown">
          <Markdown text={utf8(bytes) ?? ""} />
        </div>
      ) : kind === "docx" ? (
        <WordFrame bytes={bytes} name={name} />
      ) : kind === "xlsx" ? (
        <Workbook bytes={bytes} />
      ) : (
        <Slides bytes={bytes} />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ PDF */

function PdfPages({ bytes }: { bytes: Uint8Array }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | "failed">();
  useEffect(() => {
    let loaded: PDFDocumentProxy | undefined;
    let cancelled = false;
    let destroy = () => {};
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
      // The worker takes ownership of the buffer it is given.
      const task = pdfjs.getDocument({
        data: bytes.slice(),
        enableXfa: false,
        stopAtErrors: false,
      });
      destroy = () => void task.destroy();
      if (cancelled) return destroy();
      loaded = await task.promise;
      if (!cancelled) setDoc(loaded);
    })().catch(() => {
      if (!cancelled) setDoc("failed");
    });
    return () => {
      cancelled = true;
      destroy();
    };
  }, [bytes]);
  if (doc === "failed") return <Unavailable />;
  if (!doc) return <Loading />;
  const pages = Math.min(doc.numPages, pdfPageLimit);
  return (
    <>
      <ol className="ah-attachment-pages">
        {Array.from({ length: pages }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: pages are their numbers.
          <PdfPage key={index} doc={doc} number={index + 1} />
        ))}
      </ol>
      {doc.numPages > pages ? (
        <p className="ah-attachment-preview-note">
          Esikatselussa on {pages} ensimmäistä sivua {doc.numPages} sivusta.
        </p>
      ) : null}
    </>
  );
}

/** One page, drawn when it comes near the visible part of the dialog. */
function PdfPage({ doc, number }: { doc: PDFDocumentProxy; number: number }) {
  const holder = useRef<HTMLLIElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(Math.SQRT2);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let cancel = () => {};
    doc
      .getPage(number)
      .then((page) => {
        const target = canvas.current;
        if (cancelled || !target) return;
        const base = page.getViewport({ scale: 1 });
        setRatio(base.height / base.width);
        const width = target.parentElement?.clientWidth || base.width;
        const scale =
          (width / base.width) * Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale });
        target.width = Math.floor(viewport.width);
        target.height = Math.floor(viewport.height);
        const task = page.render({ canvas: target, viewport });
        cancel = () => task.cancel();
        return task.promise;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      cancel();
    };
  }, [doc, number, near]);
  return (
    <li
      ref={holder}
      className="ah-attachment-page"
      style={{ aspectRatio: `1 / ${ratio}` }}
    >
      <canvas
        ref={canvas}
        data-testid="attachment-pdf-page"
        role="img"
        aria-label={`Sivu ${number}`}
      />
    </li>
  );
}

/* ----------------------------------------------------------------- Word */

/**
 * docx-preview's element factory, writing into `doc` instead of the page.
 * Elements of an inert document never load, run or fire anything, so the
 * renderer's output is data until it has been cleaned.
 */
function inertFactory(doc: Document) {
  type Spec = {
    ns?: string;
    tagName: string;
    className?: string;
    style?: string | Record<string, string>;
    children?: unknown[];
    [prop: string]: unknown;
  };
  const h = (spec: unknown): Node => {
    if (typeof spec === "string") return doc.createTextNode(spec);
    if (spec instanceof Node) return spec;
    const { ns, tagName, className, style, children, ...props } = spec as Spec;
    if (tagName === "#fragment") {
      const fragment = doc.createDocumentFragment();
      for (const c of children ?? []) fragment.appendChild(h(c));
      return fragment;
    }
    if (tagName === "#comment") return doc.createComment("");
    const element = ns
      ? doc.createElementNS(ns, tagName)
      : doc.createElement(tagName);
    if (className) element.setAttribute("class", className);
    if (typeof style === "string") element.setAttribute("style", style);
    else if (style)
      Object.assign((element as HTMLElement).style ?? {}, style as object);
    for (const [key, value] of Object.entries(props))
      if (value !== undefined) Reflect.set(element, key, value);
    for (const c of children ?? []) element.appendChild(h(c));
    return element;
  };
  return h;
}

// The frame has no scripts, so it cannot report its height; it scrolls within
// the dialog. On a phone the fixed page width gives way to the screen.
const frameStyle = `
html { background: #e8e8e8; color-scheme: light; }
body { margin: 0; }
.docx-wrapper { padding: 16px !important; }
@media (max-width: 640px) {
  .docx-wrapper { padding: 0 !important; background: #fff !important; }
  .docx-wrapper > section.docx {
    width: auto !important; min-height: 0 !important;
    padding: 16px !important; margin: 0 !important; box-shadow: none !important;
  }
}`;

const escapeAttribute = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** The rendered document as a self-contained page for a sandboxed frame. */
export async function wordFrame(bytes: Uint8Array): Promise<string> {
  zipWithinLimits(bytes);
  const { renderAsync } = await import("docx-preview");
  const doc = document.implementation.createHTMLDocument("");
  const body = doc.createElement("div");
  const styles = doc.createElement("div");
  await renderAsync(bytes, body, styles, {
    // An altChunk is foreign HTML shown in a same-origin frame of its own.
    renderAltChunks: false,
    renderComments: false,
    renderChanges: false,
    useBase64URL: true,
    experimental: false,
    h: inertFactory(doc),
  } as Parameters<typeof renderAsync>[3]);
  inertMarkup(styles);
  inertMarkup(body);
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${escapeAttribute(frameCSP)}"><style>${frameStyle}</style>${styles.innerHTML}</head><body>${body.innerHTML}</body></html>`;
}

function WordFrame({ bytes, name }: { bytes: Uint8Array; name: string }) {
  const [page, setPage] = useState<string | "failed">();
  useEffect(() => {
    let cancelled = false;
    wordFrame(bytes).then(
      (html) => {
        if (!cancelled) setPage(html);
      },
      () => {
        if (!cancelled) setPage("failed");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [bytes]);
  if (page === "failed") return <Unavailable />;
  if (page === undefined) return <Loading />;
  return (
    <iframe
      className="ah-attachment-frame"
      data-testid="attachment-docx-frame"
      title={name}
      // No token: no scripts, no app origin, no forms, popups or navigation.
      sandbox=""
      referrerPolicy="no-referrer"
      srcDoc={page}
    />
  );
}

/* ---------------------------------------------------------------- Excel */

function Workbook({ bytes }: { bytes: Uint8Array }) {
  const sheets = useMemo(() => {
    try {
      return readWorkbook(bytes);
    } catch {
      return null;
    }
  }, [bytes]);
  const [selected, setSelected] = useState("0");
  if (!sheets?.length) return <Unavailable />;
  if (sheets.length === 1) return <SheetTable sheet={sheets[0]} />;
  return (
    <Tabs
      label="Taulukot"
      selected={selected}
      tabs={sheets.map((sheet, index) => ({
        id: String(index),
        label: sheet.name,
        panel: <SheetTable sheet={sheet} />,
      }))}
      onChange={setSelected}
    />
  );
}

function SheetTable({ sheet }: { sheet: Sheet }) {
  return (
    <>
      <div className="ah-attachment-sheet">
        <table data-testid="attachment-sheet" aria-label={sheet.name}>
          <thead>
            <tr>
              <td />
              {Array.from({ length: sheet.columns }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: columns are their letters.
                <th key={index} scope="col">
                  {columnName(index)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, r) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are their numbers.
              <tr key={r}>
                <th scope="row">{r + 1}</th>
                {row.map((cell, c) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: cells are their positions.
                  <td key={c}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sheet.truncated ? (
        <p className="ah-attachment-preview-note">
          Taulukossa on enemmän rivejä tai sarakkeita kuin esikatselu näyttää.
        </p>
      ) : null}
    </>
  );
}

/* ----------------------------------------------------------- PowerPoint */

function Slides({ bytes }: { bytes: Uint8Array }) {
  const slides = useMemo<Slide[] | null>(() => {
    try {
      return readPresentation(bytes);
    } catch {
      return null;
    }
  }, [bytes]);
  // Pictures are shown from object URLs that live as long as the preview.
  const pictures = useMemo(
    () =>
      new Map(
        (slides ?? []).flatMap((slide) =>
          slide.blocks.flatMap((block) =>
            block.kind === "image"
              ? [
                  [
                    block,
                    URL.createObjectURL(
                      new Blob([block.bytes as BlobPart], { type: block.type }),
                    ),
                  ] as const,
                ]
              : [],
          ),
        ),
      ),
    [slides],
  );
  useEffect(
    () => () => {
      for (const url of pictures.values()) URL.revokeObjectURL(url);
    },
    [pictures],
  );
  if (!slides?.length) return <Unavailable />;
  return (
    <ol className="ah-attachment-slides">
      {slides.map((slide, index) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: slides are their numbers.
          key={index}
          className="ah-attachment-slide"
          data-testid="attachment-slide"
        >
          <h3 className="ah-attachment-slide-title">
            <span className="ah-attachment-slide-number">{index + 1}</span>
            {slide.title}
          </h3>
          {slide.blocks.map((block, b) =>
            block.kind === "text" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: blocks keep slide order.
              <div key={b} className="ah-attachment-slide-text">
                {block.paragraphs.map((p, i) => (
                  <p
                    // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs keep their order.
                    key={i}
                    className="ah-attachment-slide-paragraph"
                    style={{ paddingInlineStart: `${p.level * 1.25}em` }}
                  >
                    {p.text}
                  </p>
                ))}
              </div>
            ) : block.kind === "table" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: blocks keep slide order.
              <div key={b} className="ah-attachment-sheet">
                <table>
                  <tbody>
                    {block.rows.map((row, r) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: rows keep their order.
                      <tr key={r}>
                        {row.map((cell, c) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: cells keep their order.
                          <td key={c}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <img
                // biome-ignore lint/suspicious/noArrayIndexKey: blocks keep slide order.
                key={b}
                className="ah-attachment-slide-image"
                src={pictures.get(block)}
                alt=""
              />
            ),
          )}
        </li>
      ))}
    </ol>
  );
}
