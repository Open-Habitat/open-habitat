/** Native title bubbles cannot be hidden with CSS. Keep titles current across
 * React updates and portals, restoring the latest value when Explain ends. */
export function suppressNativeTitles(root: HTMLElement): () => void {
  const saved = new Map<Element, { title: string; label: string | null }>();
  const suppress = (el: Element) => {
    const title = el.getAttribute("title");
    if (!title) return;
    const previous = saved.get(el);
    const label = previous?.label ?? null;
    saved.set(el, { title, label });
    // A title can be the only name of an empty control or embedded frame.
    if (
      !el.hasAttribute("aria-label") &&
      !el.hasAttribute("aria-labelledby") &&
      !("labels" in el && (el as HTMLInputElement).labels?.length) &&
      !el.hasAttribute("alt") &&
      !el.matches(
        'input[type="button"], input[type="submit"], input[type="reset"]',
      ) &&
      !el.textContent?.trim()
    ) {
      el.setAttribute("aria-label", title);
      saved.set(el, { title, label: title });
    } else if (label && el.getAttribute("aria-label") === label) {
      el.setAttribute("aria-label", title);
      saved.set(el, { title, label: title });
    }
    el.setAttribute("title", "");
  };
  const scan = (el: Element) => {
    suppress(el);
    for (const child of el.querySelectorAll("[title]")) suppress(child);
  };
  scan(root);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        const el = record.target as Element;
        if (
          !el.hasAttribute("title") ||
          (el.getAttribute("title") === "" && record.oldValue === "")
        ) {
          const entry = saved.get(el);
          if (entry?.label && el.getAttribute("aria-label") === entry.label)
            el.removeAttribute("aria-label");
          saved.delete(el);
        } else suppress(el);
      } else {
        for (const node of record.addedNodes)
          if (node instanceof Element) scan(node);
      }
    }
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["title"],
    attributeOldValue: true,
  });
  return () => {
    observer.disconnect();
    for (const [el, entry] of saved) {
      if (el.getAttribute("title") === "")
        el.setAttribute("title", entry.title);
      if (entry.label && el.getAttribute("aria-label") === entry.label)
        el.removeAttribute("aria-label");
    }
  };
}
