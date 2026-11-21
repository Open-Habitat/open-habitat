import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { liveText } from "../i18n";
import { outputBoxText } from "../text/outputBox";
import { ControlButton, IconButton } from "./ControlElements";
import { Icon } from "./Icon";
import { SyntaxCode } from "./SyntaxCode";

const txt = liveText(outputBoxText);

type View = "edges" | "scroll" | "all";
type Shadow = { left: boolean; right: boolean };
const noShadow = (): Record<"head" | "tail" | "single", Shadow> => ({
  head: { left: false, right: false },
  tail: { left: false, right: false },
  single: { left: false, right: false },
});
export function OutputBox({
  text,
  language,
  running = false,
  complete = !running,
  detect = false,
  copyLabel = txt.copyOutput,
  onCopy,
  actions,
  rendered,
  renderLines,
  copyText,
}: {
  text: string;
  language?: string;
  running?: boolean;
  complete?: boolean;
  detect?: boolean;
  copyLabel?: string;
  onCopy?: () => void;
  actions?: ReactNode;
  rendered?: ReactNode;
  /** Renders lines [start, end) of `text` in place of syntax-coloured code
   *  (a diff's rows), keeping the box's views, wrap and copy controls. */
  renderLines?: (start: number, end: number) => ReactNode;
  /** What copy places on the clipboard when it is not `text` itself. */
  copyText?: string;
}) {
  const lines = text.replace(/\n$/, "").split("\n");
  const long = lines.length > 10;
  const [mode, setMode] = useState<View | null>(null);
  const view = long ? (mode ?? (running ? "scroll" : "edges")) : "all";
  const [wrap, setWrap] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [position, setPosition] = useState({ top: true, bottom: false });
  const [shadows, setShadows] = useState(noShadow);
  const [dialog, setDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const viewport = useRef<HTMLPreElement>(null);
  const all = useRef<HTMLPreElement>(null);
  const head = useRef<HTMLPreElement>(null);
  const tail = useRef<HTMLPreElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const follow = useRef(running);
  const savedTop = useRef(0);
  const update = (pre: HTMLPreElement) => {
    const top = pre.scrollTop <= 1;
    const bottom = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 2;
    setPosition({
      top: top || pre.scrollHeight <= pre.clientHeight + 1,
      bottom: bottom || pre.scrollHeight <= pre.clientHeight + 1,
    });
    const key =
      pre === head.current ? "head" : pre === tail.current ? "tail" : "single";
    const next = {
      left: pre.scrollLeft > 1,
      right: pre.scrollLeft + pre.clientWidth < pre.scrollWidth - 1,
    };
    setShadows((previous) =>
      previous[key].left === next.left && previous[key].right === next.right
        ? previous
        : { ...previous, [key]: next },
    );
    if (view === "scroll") {
      savedTop.current = pre.scrollTop;
      follow.current = bottom;
    }
  };
  // Wrapped, nothing overflows, so the lines are measured unwrapped: the class
  // comes off for one synchronous layout read and goes back before paint. The
  // toggle stays while a line would overflow, so wrap can always be undone.
  // (A canvas re-measure failed in Chromium: the viewport's
  // font-variant-ligatures: none leaves the computed `font` shorthand empty,
  // the canvas fell back to 10px sans-serif, and the toggle vanished on the
  // click that turned wrap on.)
  const checkOverflow = () => {
    setOverflows(
      [head.current, tail.current, viewport.current, all.current].some(
        (pre) => {
          if (!pre) return false;
          if (!pre.classList.contains("ah-output-wrap"))
            return pre.scrollWidth > pre.clientWidth + 1;
          // Unwrapped lines are fewer, which could clamp the scroll position.
          const top = pre.scrollTop;
          pre.classList.remove("ah-output-wrap");
          const over = pre.scrollWidth > pre.clientWidth + 1;
          pre.classList.add("ah-output-wrap");
          pre.scrollTop = top;
          return over;
        },
      ),
    );
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reconcile after content changes, not after scroll state updates.
  useLayoutEffect(() => {
    const pre = viewport.current;
    if (pre && view === "scroll")
      pre.scrollTop =
        follow.current && running ? pre.scrollHeight : savedTop.current;
    for (const mounted of [head.current, tail.current, pre, all.current])
      if (mounted) update(mounted);
    checkOverflow();
  }, [text, view, wrap, running, rendered]);
  // Recreate the observer when measurement inputs change so its callback does
  // not use the pre-wrap state after a wrapped viewport resizes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Recapture the current measurement inputs, not the per-render callback identities.
  useLayoutEffect(() => {
    const mounted = [
      head.current,
      tail.current,
      viewport.current,
      all.current,
    ].filter((pre): pre is HTMLPreElement => !!pre);
    if (!mounted.length || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      mounted.forEach(update);
      checkOverflow();
    });
    mounted.forEach((pre) => {
      observer.observe(pre);
    });
    return () => observer.disconnect();
  }, [view, wrap, text, rendered]);
  useEffect(() => {
    if (!dialog || !dialogRef.current) return;
    if (typeof dialogRef.current.showModal === "function")
      dialogRef.current.showModal();
    else dialogRef.current.setAttribute("open", ""); // jsdom lacks showModal
  }, [dialog]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      if (onCopy) onCopy();
      else await navigator.clipboard.writeText(copyText ?? text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const select = (next: View) => {
    follow.current = running && next === "scroll";
    savedTop.current = 0;
    setShadows(noShadow());
    setMode(next);
  };
  const button = (
    label: string,
    icon:
      | "edges"
      | "scroll"
      | "wrap"
      | "expand"
      | "top"
      | "bottom"
      | "copy"
      | "check"
      | "external",
    action: () => void,
    pressed?: boolean,
    disabled?: boolean,
  ) => (
    <IconButton
      size="inline"
      variant="quiet"
      data-testid={`output-${icon === "check" ? "copy" : icon}`}
      aria-label={label}
      aria-pressed={pressed}
      isDisabled={disabled}
      onPress={action}
    >
      <Icon name={icon} />
    </IconButton>
  );
  const content = (section: string[], start: number) =>
    renderLines ? (
      renderLines(start, start + section.length)
    ) : (
      <SyntaxCode
        text={`${section.join("\n")}\n`}
        language={language}
        complete={complete}
        detect={detect}
      />
    );
  const pre = (
    section: string[],
    start: number,
    className: string,
    ref?: React.Ref<HTMLPreElement>,
  ) => {
    const shadow =
      shadows[
        className === "ah-bash-head"
          ? "head"
          : className === "ah-bash-tail"
            ? "tail"
            : "single"
      ];
    return (
      <pre
        ref={ref}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Scrollable output is keyboard focusable.
        tabIndex={0}
        className={`ah-output-viewport ${className}${wrap ? " ah-output-wrap" : ""}${shadow.left ? " ah-output-more-left" : ""}${shadow.right ? " ah-output-more-right" : ""}`}
        onScroll={(e) => {
          const target = e.currentTarget;
          if (view === "edges") {
            const other = target === head.current ? tail.current : head.current;
            if (other && other.scrollLeft !== target.scrollLeft)
              other.scrollLeft = target.scrollLeft;
          }
          update(target);
        }}
      >
        {content(section, start)}
        {running && className === "ah-output-scroll" ? (
          <span className="ah-bash-caret" aria-hidden="true">
            ▏
          </span>
        ) : null}
      </pre>
    );
  };
  return (
    <div className="ah-output-box">
      <div
        className={`ah-bash-window${view === "scroll" && !position.top ? " ah-output-scrolled" : ""}`}
      >
        {language || long ? (
          <small className="ah-output-meta">
            {language}
            {language && long ? " · " : ""}
            {long ? txt.lines(lines.length) : ""}
          </small>
        ) : null}
        {rendered ??
          (view === "edges" ? (
            <div className="ah-output-edges">
              {pre(lines.slice(0, 3), 0, "ah-bash-head", head)}
              <ControlButton
                variant="quiet"
                size="inline"
                className="ah-bash-gap"
                data-testid="output-expand-gap"
                onPress={() => select("all")}
              >
                {txt.hiddenLines(lines.length - 10)}
              </ControlButton>
              {pre(lines.slice(-7), lines.length - 7, "ah-bash-tail", tail)}
            </div>
          ) : (
            pre(
              lines,
              0,
              view === "scroll" ? "ah-output-scroll" : "ah-output-all",
              view === "scroll" ? viewport : all,
            )
          ))}
        <fieldset
          className="ah-bash-rail"
          aria-label={txt.actions}
          style={
            long && actions
              ? {
                  minWidth:
                    "calc(var(--ah-output-rail-width) + 2 * var(--ah-focus-room))",
                }
              : undefined
          }
        >
          <div className="ah-output-group">
            {button(
              copied ? txt.copied : copyLabel,
              copied ? "check" : "copy",
              () => void copy(),
            )}
          </div>
          {actions ? <div className="ah-output-group">{actions}</div> : null}
          {!rendered && long ? (
            <fieldset
              className="ah-output-group ah-output-selector"
              aria-label={txt.view}
            >
              {button(
                txt.edges,
                "edges",
                () => select("edges"),
                view === "edges",
              )}
              {button(
                txt.scroll,
                "scroll",
                () => select("scroll"),
                view === "scroll",
              )}
              {button(txt.all, "expand", () => select("all"), view === "all")}
            </fieldset>
          ) : null}
          {!rendered && view === "scroll" ? (
            <fieldset className="ah-output-group" aria-label={txt.go}>
              {button(
                txt.top,
                "top",
                () => viewport.current?.scrollTo({ top: 0 }),
                undefined,
                position.top,
              )}
              {button(
                txt.bottom,
                "bottom",
                () =>
                  viewport.current?.scrollTo({
                    top: viewport.current.scrollHeight,
                  }),
                undefined,
                position.bottom,
              )}
            </fieldset>
          ) : null}
          <div className="ah-output-group">
            {!rendered && overflows
              ? button(
                  wrap ? txt.noWrap : txt.wrap,
                  "wrap",
                  () => setWrap(!wrap),
                  wrap,
                )
              : null}
            {!rendered && long
              ? button(txt.window, "external", () => setDialog(true))
              : null}
          </div>
        </fieldset>
      </div>
      {dialog ? (
        <dialog
          data-testid="output-dialog"
          ref={dialogRef}
          className="ah-bash-dialog"
          aria-label={txt.output}
          onClose={() => setDialog(false)}
        >
          <header>
            <strong>{language || txt.output}</strong>
            <ControlButton
              data-testid="copy-output"
              variant="quiet"
              size="row"
              onPress={() => void copy()}
            >
              {txt.copy}
            </ControlButton>
            <ControlButton
              variant="quiet"
              size="row"
              onPress={() => {
                dialogRef.current?.close?.();
                setDialog(false);
              }}
            >
              {txt.close}
            </ControlButton>
          </header>
          <div className="ah-bash-dialog-code">
            <pre className="ah-bash-dialog-numbers" aria-hidden="true">
              {lines.map((_, i) => `${i + 1}\n`).join("")}
            </pre>
            <pre>
              {renderLines ? (
                renderLines(0, lines.length)
              ) : (
                <SyntaxCode
                  text={text}
                  language={language}
                  complete={complete}
                  detect={detect}
                />
              )}
            </pre>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
