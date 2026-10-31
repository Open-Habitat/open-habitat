// Full-view previews of a CSV/TSV, an SVG and an HTML file in the browser
// editor, loaded with the first such preview. Each shows the buffer as data:
// nothing in the file runs, and nothing it names is fetched.

import { useEffect, useMemo, useState } from "react";
import { frameCSP, inertMarkup } from "../app/documentPreview";
import { useText } from "../i18n";
import { editorFilePreviewText } from "../text/editorFilePreview";
import { readTable } from "./csvTable";

/** Rows past this are left out, and the caption says so: the editor opens
 * files up to 1 MiB, and tens of thousands of rows would stall the tab. */
const tableLimit = 5000;
const tableColumns = 200;
const numeric = /^[-+]?\d[\d\s]*([.,]\d+)?\s*%?$/;

export function TablePreview({ text, tabs }: { text: string; tabs: boolean }) {
  const { rows, more, separator } = useMemo(
    () => readTable(text, tabs, tableLimit + 1, tableColumns),
    [text, tabs],
  );
  const [head, ...body] = rows;
  const shown = body.slice(0, tableLimit);
  const width = Math.max(0, ...rows.map((r) => r.cells.length));
  const t = useText(editorFilePreviewText);
  return (
    <>
      <p className="ah-preview-caption">
        {t.tableCaption(
          shown.length,
          width,
          separator === ";"
            ? "semicolon"
            : separator === "\t"
              ? "tab"
              : "comma",
          more || body.length > tableLimit ? tableLimit : undefined,
        )}
      </p>
      {head ? (
        <table className="ah-preview-table" data-testid="editor-preview-table">
          <thead>
            <tr data-line={head.line}>
              <th className="ah-preview-line" scope="col">
                {head.line + 1}
              </th>
              {head.cells.map((cell, c) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: cells have no identity beyond their place.
                <th key={c} scope="col">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.line} data-line={row.line}>
                <th className="ah-preview-line" scope="row">
                  {row.line + 1}
                </th>
                {row.cells.map((cell, c) => (
                  <td
                    // biome-ignore lint/suspicious/noArrayIndexKey: cells have no identity beyond their place.
                    key={c}
                    data-numeric={numeric.test(cell) || undefined}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}

/** An SVG drawn as an image: an `<img>` runs no script and fetches nothing
 * the picture names. A `data:` URL rather than a `blob:` one, because a blob
 * shares the app's origin: opening the image in a tab of its own would run
 * the picture's scripts there. */
export function ImagePreview({ text, name }: { text: string; name: string }) {
  const url = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`,
    [text],
  );
  const t = useText(editorFilePreviewText);
  const [size, setSize] = useState<{ url: string; w: number; h: number }>();
  const [failed, setFailed] = useState<string>();
  useEffect(() => {
    const probe = new Image();
    probe.onload = () =>
      setSize({ url, w: probe.naturalWidth, h: probe.naturalHeight });
    probe.onerror = () => setFailed(url);
    probe.src = url;
  }, [url]);
  if (failed === url)
    return (
      <p className="ah-preview-caption" data-testid="editor-preview-failed">
        {t.notSvg}
      </p>
    );
  return (
    <figure className="ah-preview-image">
      <div className="ah-preview-checker">
        <img src={url} alt={name} data-testid="editor-preview-image" />
      </div>
      <figcaption className="ah-preview-caption">
        {size?.url === url && size.w ? `${size.w} × ${size.h} · ` : ""}
        {t.checker}
      </figcaption>
    </figure>
  );
}

/** An HTML file as a self-contained page for a sandboxed frame, made inert
 * the way a Word document's preview is: no scripts, handlers, forms or
 * frames, and a policy that fetches nothing. A link or relative image has
 * nowhere to go. A light canvas comes first, so the page's own styles win. */
export function inertPage(text: string): string {
  const doc = new DOMParser().parseFromString(text, "text/html");
  inertMarkup(doc.documentElement);
  const head = doc.head;
  const style = doc.createElement("style");
  style.textContent = "html { background: #fff; color-scheme: light; }";
  head.prepend(style);
  const policy = doc.createElement("meta");
  policy.setAttribute("http-equiv", "Content-Security-Policy");
  policy.setAttribute("content", frameCSP);
  head.prepend(policy);
  const charset = doc.createElement("meta");
  charset.setAttribute("charset", "utf-8");
  head.prepend(charset);
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

export function PagePreview({ text, name }: { text: string; name: string }) {
  const t = useText(editorFilePreviewText);
  const page = useMemo(() => inertPage(text), [text]);
  return (
    <>
      <p className="ah-preview-caption ah-preview-page-note">{t.inert}</p>
      <iframe
        className="ah-preview-page"
        data-testid="editor-preview-page"
        title={name}
        // No token: no scripts, no app origin, no forms, popups or navigation.
        sandbox=""
        referrerPolicy="no-referrer"
        srcDoc={page}
      />
    </>
  );
}

export default function FilePreview({
  kind,
  text,
  path,
}: {
  kind: "table" | "image" | "page";
  text: string;
  path: string;
}) {
  const name = path.split("/").pop() ?? path;
  return kind === "table" ? (
    <TablePreview text={text} tabs={/\.tsv$/i.test(path)} />
  ) : kind === "image" ? (
    <ImagePreview text={text} name={name} />
  ) : (
    <PagePreview text={text} name={name} />
  );
}
