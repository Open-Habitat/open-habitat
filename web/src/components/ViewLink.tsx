import "./ViewLink.css";
import { useEffect, useState } from "react";
import { liveText } from "../i18n";
import { viewLinksText } from "../text/viewLinks";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";

const txt = liveText(viewLinksText);

/** Copies a view's stable address and says so for a moment. Icon-only in a
 * panel header, where the label names it. */
export function CopyButton({
  text,
  "data-testid": testId,
  label = txt.copyLink,
  copiedLabel = txt.copied,
  blockedLabel = txt.copyBlocked,
  iconOnly = false,
}: {
  text: string;
  "data-testid"?: string;
  label?: string;
  copiedLabel?: string;
  blockedLabel?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState<"yes" | "failed">();
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(undefined), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const said =
    copied === "yes" ? copiedLabel : copied === "failed" ? blockedLabel : label;
  return (
    <ControlButton
      data-testid={testId ?? "view-link-copy"}
      data-copied={copied}
      size="row"
      variant={iconOnly ? "quiet" : "secondary"}
      aria-label={iconOnly ? said : undefined}
      title={iconOnly ? said : undefined}
      onPress={() =>
        void navigator.clipboard.writeText(text).then(
          () => setCopied("yes"),
          () => setCopied("failed"),
        )
      }
    >
      <Icon name={copied === "yes" ? "check" : "copy"} />
      {iconOnly ? null : ` ${said}`}
    </ControlButton>
  );
}
