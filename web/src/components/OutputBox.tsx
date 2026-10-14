import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ControlButton, IconButton } from "./ControlElements";
import { Icon } from "./Icon";

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
  copyLabel = "Kopioi tuloste",
  onCopy,
}: {
  text: string;
  language?: string;
  running?: boolean;
  copyLabel?: string;
  onCopy?: () => void;
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
  const checkOverflow = () => {
    const mounted = [
      head.current,
      tail.current,
      viewport.current,
      all.current,
    ].filter((pre): pre is HTMLPreElement => !!pre);
    setOverflows(
      mounted.some((pre) => {
        if (!wrap || typeof CanvasRenderingContext2D === "undefined")
          return pre.scrollWidth > pre.clientWidth + 1;
        // Wrapped scrollWidth conceals the unwrapped line. Measure in the
        // viewport's own font so the control remains available to undo wrap.
        const context = document.createElement("canvas").getContext("2d");
        if (!context) return false;
        const style = getComputedStyle(pre);
        context.font = style.font;
        const available =
          pre.clientWidth -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight);
        return lines.some(
          (line) => context.measureText(line).width > available + 1,
        );
      }),
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
  }, [text, view, wrap, running]);
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
  }, [view, wrap, text]);
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
      else await navigator.clipboard.writeText(text);
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
      variant="quiet"
      aria-label={label}
      aria-pressed={pressed}
      isDisabled={disabled}
      onPress={action}
    >
      <Icon name={icon} />
    </IconButton>
  );
  const content = (section: string[]) =>
    section.map((line, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: Render-only line sequence.
      <span className="ah-output-line" key={i}>
        {line || " "}
        {"\n"}
      </span>
    ));
  const pre = (
    section: string[],
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
        {content(section)}
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
      <div className="ah-bash-window">
        {view === "edges" ? (
          <div className="ah-output-edges">
            {pre(lines.slice(0, 3), "ah-bash-head", head)}
            <ControlButton
              variant="quiet"
              size="micro"
              className="ah-bash-gap"
              onPress={() => select("all")}
            >
              {lines.length - 10} riviä välistä · Näytä kaikki
            </ControlButton>
            {pre(lines.slice(-7), "ah-bash-tail", tail)}
          </div>
        ) : (
          pre(
            lines,
            view === "scroll" ? "ah-output-scroll" : "ah-output-all",
            view === "scroll" ? viewport : all,
          )
        )}
        <fieldset className="ah-bash-rail" aria-label="Tulosteen toiminnot">
          <div className="ah-output-group">
            {button(
              copied ? "Tuloste kopioitu" : copyLabel,
              copied ? "check" : "copy",
              () => void copy(),
            )}
          </div>
          {long ? (
            <fieldset
              className="ah-output-group ah-output-selector"
              aria-label="Näkymä"
            >
              {button(
                "Alku ja loppu",
                "edges",
                () => select("edges"),
                view === "edges",
              )}
              {button(
                "Vieritettävä ikkuna",
                "scroll",
                () => select("scroll"),
                view === "scroll",
              )}
              {button(
                "Kaikki rivit",
                "expand",
                () => select("all"),
                view === "all",
              )}
            </fieldset>
          ) : null}
          {view === "scroll" ? (
            <fieldset className="ah-output-group" aria-label="Siirry">
              {button(
                "Alkuun",
                "top",
                () => viewport.current?.scrollTo({ top: 0 }),
                undefined,
                position.top,
              )}
              {button(
                "Loppuun",
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
            {overflows
              ? button(
                  wrap ? "Älä rivitä pitkiä rivejä" : "Rivitä pitkät rivit",
                  "wrap",
                  () => setWrap(!wrap),
                  wrap,
                )
              : null}
            {long
              ? button("Avaa omassa ikkunassa", "external", () =>
                  setDialog(true),
                )
              : null}
          </div>
        </fieldset>
      </div>
      {language || long ? (
        <small className="ah-output-meta">
          {language}
          {language && long ? " · " : ""}
          {long ? `${lines.length} riviä` : ""}
        </small>
      ) : null}
      {dialog ? (
        <dialog
          ref={dialogRef}
          className="ah-bash-dialog"
          aria-label="Tuloste"
          onClose={() => setDialog(false)}
        >
          <header>
            <strong>{language || "Tuloste"}</strong>
            <ControlButton
              variant="quiet"
              size="compact"
              onPress={() => void copy()}
            >
              Kopioi
            </ControlButton>
            <ControlButton
              variant="quiet"
              size="compact"
              onPress={() => {
                dialogRef.current?.close?.();
                setDialog(false);
              }}
            >
              Sulje
            </ControlButton>
          </header>
          <pre>
            {lines.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Render-only line numbers.
              <code key={i}>
                <span>{i + 1}</span>
                {line || " "}
                {"\n"}
              </code>
            ))}
          </pre>
        </dialog>
      ) : null}
    </div>
  );
}
