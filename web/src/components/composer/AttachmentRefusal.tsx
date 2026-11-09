import { useText } from "../../i18n";
import { attachmentRefusalText } from "../../text/attachmentRefusal";
import { ControlButton } from "../ControlElements";
import { Icon } from "../Icon";
import { WarningBanner } from "../WarningBanner";

export type AttachmentRefusalReason =
  | "large"
  | "empty"
  | "count"
  | "total"
  | "quota"
  | "disk"
  | "failed";
export type RefusedAttachment = {
  id: string;
  file: File;
  reason: AttachmentRefusalReason;
  used?: number;
};
export function AttachmentRefusal({
  refused,
  onDismiss,
  onRetry,
}: {
  refused: RefusedAttachment[];
  onDismiss: () => void;
  onRetry: (files: File[]) => void;
}) {
  const t = useText(attachmentRefusalText);
  if (!refused.length) return null;
  const one = refused.length === 1 ? refused[0] : undefined;
  const failed = refused.filter((r) => r.reason === "failed");
  const detail = (r: RefusedAttachment) =>
    r.reason === "large"
      ? t.why.large(t.size(r.file.size))
      : r.reason === "total"
        ? t.why.total(t.size(r.used ?? 0))
        : t.why[r.reason];
  return (
    <WarningBanner
      data-testid="attachment-refusal"
      subject="attachments"
      tone="danger"
      lifetime="event"
      title={one ? t.title[one.reason](one.file.name) : t.many(refused.length)}
      actions={
        <>
          {failed.length ? (
            <ControlButton
              data-testid="attachment-refusal-retry"
              size="row"
              variant="secondary"
              onPress={() => onRetry(failed.map((r) => r.file))}
            >
              {t.retry}
            </ControlButton>
          ) : null}
          <ControlButton
            data-testid="attachment-refusal-dismiss"
            size="inline"
            variant="quiet"
            presentation="icon"
            aria-label={t.dismiss}
            onPress={onDismiss}
          >
            <Icon name="cross" />
          </ControlButton>
        </>
      }
    >
      {one ? (
        <>
          {detail(one)} {t.todo[one.reason]}
        </>
      ) : (
        <>
          <ul className="ah-refused-files">
            {refused.map((r) => (
              <li key={r.id}>
                <span>{r.file.name}</span>
                <span>
                  {t.short[r.reason]}
                  {r.reason === "large" ? ` (${t.size(r.file.size)})` : null}
                </span>
              </li>
            ))}
          </ul>
          <p>{[...new Set(refused.map((r) => t.todo[r.reason]))].join(" ")}</p>
        </>
      )}
    </WarningBanner>
  );
}
