import { type RefObject, useLayoutEffect, useState } from "react";
import { useText } from "../i18n";
import { phoneHeaderText } from "../text/phoneHeader";
import { type ContextLevel, Ring } from "./ContextRing";
import { Icon } from "./Icon";
import { Menu } from "./Overlays";
import "./PhoneHeaderFacts.css";

type Readout = {
  git?: string;
  compactGit?: string;
  /** A ring that cannot be drawn honestly ("?" for an unknown fill). */
  compactContext?: string;
  context?: string;
  percent?: number;
  level?: ContextLevel;
  tick?: number;
  model?: string;
  compactModel?: string;
  actions: { id: string; label: string; selector: string; disabled: boolean }[];
};

/** Read the controls' presentation, not another copy of their host state.
 * Like desktop shortening, this follows the mounted controls, including Git's
 * newer on-demand reading. Their existing handlers still own opening details.
 */
export function usePhoneHeaderReadout(row: RefObject<HTMLElement | null>) {
  const [readout, setReadout] = useState<Readout>({ actions: [] });
  useLayoutEffect(() => {
    const root = row.current;
    if (!root) return;
    const read = () => {
      const git = root.querySelector<HTMLElement>(".ah-gs-chip");
      const context = root.querySelector<HTMLElement>(".ah-ctx-chip");
      const model = root.querySelector<HTMLElement>(".ah-set-chip");
      const number = (name: string) => {
        const value = context?.getAttribute(name);
        return value ? Number(value) : undefined;
      };
      const next: Readout = {
        git: git?.dataset.menuSummary,
        compactGit: git?.dataset.phoneSummary,
        compactContext: context?.dataset.phoneSummary,
        context: context?.dataset.menuSummary,
        percent: number("data-percent"),
        tick: number("data-tick"),
        level: context?.dataset.level as ContextLevel | undefined,
        model: model?.dataset.menuSummary,
        compactModel:
          model?.querySelector(".ah-set-model")?.textContent ?? undefined,
        actions: ["toggle-editor", "toggle-terminal", "guide-toggle"].flatMap(
          (id) => {
            const selector = `[data-testid='${id}']`;
            const control = root.querySelector<HTMLButtonElement>(selector);
            return control
              ? [
                  {
                    id,
                    selector,
                    label:
                      control.getAttribute("aria-label") ||
                      control.title ||
                      control.textContent ||
                      id,
                    disabled: control.disabled,
                  },
                ]
              : [];
          },
        ),
      };
      setReadout((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "data-menu-summary",
        "data-phone-summary",
        "data-percent",
        "data-tick",
        "data-level",
        "title",
        "aria-label",
        "disabled",
      ],
    });
    return () => observer.disconnect();
  }, [row]);
  return readout;
}

export function activateHeaderControl(
  row: RefObject<HTMLElement | null>,
  selector: string,
) {
  // Menus restore trigger focus first; then the destination may take focus.
  setTimeout(() => row.current?.querySelector<HTMLElement>(selector)?.click());
}

export function PhoneHeaderFacts({
  row,
  readout,
  workspace,
  onWorkspace,
  activity,
  showModel,
  onDetails,
}: {
  row: RefObject<HTMLElement | null>;
  readout: Readout;
  workspace: string;
  onWorkspace: () => void;
  activity: React.ReactNode;
  showModel: boolean;
  onDetails: () => void;
}) {
  const t = useText(phoneHeaderText);
  const items = [
    {
      id: "fact-workspace",
      label: t.workspace,
      description: workspace,
      run: onWorkspace,
    },
    ...(readout.git
      ? [
          {
            id: "fact-git",
            label: "Git",
            description: readout.git,
            run: () => activateHeaderControl(row, ".ah-gs-chip"),
          },
        ]
      : []),
    ...(readout.context
      ? [
          {
            id: "fact-context",
            label: t.context,
            description: readout.context,
            run: () => activateHeaderControl(row, ".ah-ctx-chip"),
          },
        ]
      : []),
    ...(readout.model
      ? [
          {
            id: "fact-model",
            label: t.model,
            description: readout.model,
            run: () => {
              if (row.current?.querySelector(".md-chip-picker summary"))
                activateHeaderControl(row, ".md-chip-picker summary");
              else onDetails();
            },
          },
        ]
      : []),
  ];
  return (
    <Menu
      label={t.facts}
      isNonModal
      triggerTestId="phone-header-facts"
      triggerClassName="ah-phone-facts"
      popoverClassName="ah-phone-facts-menu"
      placement="bottom start"
      heading={activity}
      items={items}
      onAction={(id) => items.find((item) => item.id === id)?.run()}
      trigger={
        <>
          <span className="ah-phone-workspace">{workspace}</span>
          {readout.git ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="ah-phone-git">
                {readout.compactGit || <Icon name="branch" />}
              </span>
            </>
          ) : null}
          {readout.context ? (
            <>
              <span aria-hidden="true">·</span>
              {readout.compactContext ? (
                <span className="ah-phone-context">
                  {readout.compactContext}
                </span>
              ) : (
                <span data-level={readout.level}>
                  <Ring
                    percent={readout.percent}
                    level={readout.level ?? "nowindow"}
                    tick={readout.tick}
                  />
                </span>
              )}
            </>
          ) : null}
          {showModel && readout.compactModel ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="ah-phone-model">{readout.compactModel}</span>
            </>
          ) : null}
        </>
      }
    />
  );
}
