import { useState } from "react";
import { mutationFetch, writeOutcome } from "../../../../web/src/app/mutations";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import { Icon } from "../../../../web/src/components/Icon";
import { WarningBanner } from "../../../../web/src/components/WarningBanner";
import { catalog, formatNumber, useLanguage, useText } from "../../../../web/src/i18n";

// proto-attachment-refusal, round 1: what the three directions share. Every
// refusal is one file and its reason, so a drop of several files can say
// which went in and which did not. The browser checks the limits it knows
// before uploading (20 MiB a file, 30 files and 100 MiB a message); the
// host's code says the rest (the person's 1 GiB attachments space, the
// server's disk). Production words these through its catalog; this is the
// round's copy of that catalog.

export const fileLimit = 20 * 1024 * 1024;
export const messageLimit = 100 * 1024 * 1024;
export const countLimit = 30;

export type Reason = "large" | "empty" | "count" | "total" | "quota" | "disk" | "failed";
export type Refused = {
  name: string;
  size: number;
  reason: Reason;
  /** What the message's attachments already weigh, for `total`. */
  used?: number;
  /** Kept for a retry when the save itself failed. */
  file?: File;
};
export type Presentation = "banner" | "chips" | "line";

/** Megabytes as people say them: "34 Mt", "0,4 Mt". */
const mt = (bytes: number, unit: string) => {
  const n = bytes / (1024 * 1024);
  return `${formatNumber(n, { maximumFractionDigits: n < 10 ? 1 : 0 })} ${unit}`;
};

const fi = {
  unit: "Mt",
  title: {
    large: (name: string) => `${name} on liian suuri`,
    empty: (name: string) => `${name} on tyhjä`,
    count: (name: string) => `${name} ei mahtunut viestiin`,
    total: (name: string) => `${name} ei mahtunut viestiin`,
    quota: (name: string) => `${name} jäi liittämättä`,
    disk: (name: string) => `${name} jäi liittämättä`,
    failed: (name: string) => `${name} ei tallentunut`,
  },
  many: (n: number) => `${n} tiedostoa jäi liittämättä`,
  why: {
    large: (size: string) => `Tiedosto on ${size}, ja liite voi olla enintään 20 Mt.`,
    empty: () => "Tiedostossa ei ole sisältöä.",
    count: () => "Viestiin voi liittää enintään 30 tiedostoa.",
    total: (used: string) =>
      `Viestin liitteet voivat olla yhteensä enintään 100 Mt, ja niitä on jo ${used}.`,
    quota: () => "Liitteillesi varattu tila, 1 Gt, on täynnä.",
    disk: () => "Palvelimen levy on täynnä.",
    failed: () => "Yhteys katkesi kesken tallennuksen.",
  },
  todo: {
    large: "Pienennä tai pakkaa tiedosto, tai jaa se osiin.",
    empty: "Tarkista, että valitsit oikean tiedoston.",
    count: "Lähetä tämä viesti ja liitä loput seuraavaan.",
    total: "Lähetä tämä viesti ja liitä loput seuraavaan.",
    quota: "Pyydä agenttia poistamaan vanhat liitteet, joita et enää tarvitse.",
    disk: "Kerro palvelimen ylläpitäjälle.",
    failed: "Yritä uudelleen.",
  },
  short: {
    large: "yli 20 Mt",
    empty: "tyhjä",
    count: "yli 30 tiedostoa",
    total: "yli 100 Mt yhteensä",
    quota: "liitetila täynnä",
    disk: "levy täynnä",
    failed: "ei tallentunut",
  },
  line: (name: string, short: string) => `${name} jäi pois: ${short}.`,
  retry: "Yritä uudelleen",
  retryOne: (name: string) => `Yritä tallentaa ${name} uudelleen`,
  dismiss: "Sulje",
  dismissOne: (name: string) => `Poista ilmoitus tiedostosta ${name}`,
  show: "Näytä",
  hide: "Piilota",
  refusedFiles: "Liittämättä jääneet",
};

export const refusalText = catalog(fi, {
  unit: "MB",
  title: {
    large: (name) => `${name} is too large`,
    empty: (name) => `${name} is empty`,
    count: (name) => `${name} did not fit in the message`,
    total: (name) => `${name} did not fit in the message`,
    quota: (name) => `${name} was not attached`,
    disk: (name) => `${name} was not attached`,
    failed: (name) => `${name} was not saved`,
  },
  many: (n) => `${n} files were not attached`,
  why: {
    large: (size) => `The file is ${size}, and an attachment can be at most 20 MB.`,
    empty: () => "The file has no content.",
    count: () => "A message can have at most 30 files.",
    total: (used) =>
      `A message's attachments can be at most 100 MB together, and it already has ${used}.`,
    quota: () => "The space for your attachments, 1 GB, is full.",
    disk: () => "The server's disk is full.",
    failed: () => "The connection broke while saving.",
  },
  todo: {
    large: "Make the file smaller, compress it or split it into parts.",
    empty: "Check that you chose the right file.",
    count: "Send this message and attach the rest to the next one.",
    total: "Send this message and attach the rest to the next one.",
    quota: "Ask the agent to delete old attachments you no longer need.",
    disk: "Tell the server's administrator.",
    failed: "Try again.",
  },
  short: {
    large: "over 20 MB",
    empty: "empty",
    count: "over 30 files",
    total: "over 100 MB in total",
    quota: "attachment space full",
    disk: "disk full",
    failed: "not saved",
  },
  line: (name, short) => `${name} was left out: ${short}.`,
  retry: "Try again",
  retryOne: (name) => `Try saving ${name} again`,
  dismiss: "Close",
  dismissOne: (name) => `Remove the notice about ${name}`,
  show: "Show",
  hide: "Hide",
  refusedFiles: "Not attached",
});

type T = ReturnType<typeof useText<typeof fi>>;
const why = (t: T, r: Refused) =>
  r.reason === "large"
    ? t.why.large(mt(r.size, t.unit))
    : r.reason === "total"
      ? t.why.total(mt(r.used ?? 0, t.unit))
      : t.why[r.reason]();
/** The reasons in the order they first occur, each said once. */
const reasons = (list: Refused[]) => [...new Set(list.map((r) => r.reason))];
const sentence = (t: T, r: Refused) => `${t.title[r.reason](r.name)}. ${why(t, r)} ${t.todo[r.reason]}`;

/** Why a save failed, from the host's answer. Production's uploadAttachment
 * throws only a worded message today; it would throw this instead. */
export class UploadRefused extends Error {
  constructor(public reason: Reason) {
    super(reason);
  }
}

/** The production upload request, with the host's code kept. Production's
 * reply checks (schema, size, length bound) stay as they are and are left
 * out of the round. */
export async function uploadWithReason(file: File, csrf: string, signal: AbortSignal) {
  const response = await mutationFetch("attachment.upload", "/api/v1/attachments", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers: { "Content-Type": "application/octet-stream", "X-Agent-Host-CSRF": csrf },
    body: file,
  }).catch(() => undefined);
  // 507 is the host's definite "nothing was kept, the disk is full"; today
  // the browser reads every 5xx as an uncertain write.
  if (response?.status === 507) throw new UploadRefused("disk");
  const outcome = await writeOutcome(response);
  if (outcome.kind === "refused")
    throw new UploadRefused(outcome.code === "attachment_quota_exceeded" ? "quota" : "failed");
  if (outcome.kind !== "ok" || !response) throw new UploadRefused("failed");
  const data = (await response.json()) as { id: string; content_type: string; size: number };
  const name = file.name.replace(/[[\]\\\r\n]/g, "_") || "file";
  const image = ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(data.content_type);
  return { ...data, reference: `${image ? "!" : ""}[${name}](/api/v1/attachments/${data.id})` };
}

type Props = {
  refused: Refused[];
  onDismiss: (index?: number) => void;
  onRetry: (item: Refused) => void;
};

/** Banner: one danger warning above the composer. One file: its name and
 * reason as the title, the limit and what to do under it. Several: how many,
 * each file with its short reason, and what to do once per reason. */
export function RefusalBanner({ refused, onDismiss, onRetry }: Props) {
  const t = useText(refusalText);
  useLanguage();
  if (!refused.length) return null;
  const one = refused.length === 1 ? refused[0] : null;
  const failed = refused.filter((r) => r.reason === "failed" && r.file);
  const actions = (
    <>
      {failed.length ? (
        <ControlButton data-testid="refusal-retry" size="row" variant="secondary" onPress={() => failed.forEach(onRetry)}>
          <Icon name="refresh" />
          {t.retry}
        </ControlButton>
      ) : null}
      <ControlButton
        data-testid="refusal-dismiss"
        size="inline"
        variant="quiet"
        presentation="icon"
        aria-label={t.dismiss}
        onPress={() => onDismiss()}
      >
        <Icon name="cross" />
      </ControlButton>
    </>
  );
  return (
    <WarningBanner
      data-testid="attachment-refusal"
      data-state="banner"
      tone="danger"
      title={one ? t.title[one.reason](one.name) : t.many(refused.length)}
      actions={actions}
    >
      {one ? (
        <p>
          {why(t, one)} {t.todo[one.reason]}
        </p>
      ) : (
        <>
          <ul className="lt-refused-list">
            {refused.map((r, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the same name may be dropped twice.
              <li key={`${r.name}:${i}`}>
                <span className="lt-name">{r.name}</span>
                <span className="lt-short">{r.reason === "large" ? `${t.short.large} (${mt(r.size, t.unit)})` : t.short[r.reason]}</span>
              </li>
            ))}
          </ul>
          <p>{reasons(refused).map((x) => t.todo[x]).filter((s, i, a) => a.indexOf(s) === i).join(" ")}</p>
        </>
      )}
    </WarningBanner>
  );
}

/** Chips: each refused file is a red chip in the attachment row, its short
 * reason on it. Pressing it opens the whole sentence under the row. */
export function RefusalChips({ refused, onDismiss, onRetry }: Props) {
  const t = useText(refusalText);
  useLanguage();
  const [open, setOpen] = useState<number | null>(null);
  if (!refused.length) return null;
  const shown = open !== null && open < refused.length ? refused[open] : null;
  return (
    <div className="lt-chips-wrap" data-testid="attachment-refusal" data-state="chips">
      <ul className="ah-attachment-chips ah-attachment-chips-draft lt-refused-chips" aria-label={t.refusedFiles}>
        {refused.map((r, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the same name may be dropped twice.
          <li key={`${r.name}:${i}`} className="ah-attachment-chip lt-refused-chip" data-reason={r.reason} data-testid="refused-chip">
            <ControlButton
              className="ah-attachment-open"
              variant="quiet"
              size="inline"
              aria-expanded={open === i}
              aria-label={sentence(t, r)}
              onPress={() => setOpen(open === i ? null : i)}
            >
              <Icon name="warning" />
              <span className="ah-attachment-name">{r.name}</span>
              <span className="lt-chip-reason">{t.short[r.reason]}</span>
            </ControlButton>
            {r.reason === "failed" && r.file ? (
              <ControlButton
                className="ah-attachment-remove"
                variant="quiet"
                size="inline"
                presentation="icon"
                aria-label={t.retryOne(r.name)}
                onPress={() => onRetry(r)}
              >
                <Icon name="refresh" />
              </ControlButton>
            ) : null}
            <ControlButton
              className="ah-attachment-remove"
              variant="quiet"
              size="inline"
              presentation="icon"
              aria-label={t.dismissOne(r.name)}
              onPress={() => {
                setOpen(null);
                onDismiss(i);
              }}
            >
              <Icon name="cross" />
            </ControlButton>
          </li>
        ))}
      </ul>
      {shown ? (
        <p className="lt-chip-detail" data-testid="refused-detail">
          {why(t, shown)} {t.todo[shown.reason]}
        </p>
      ) : null}
    </div>
  );
}

/** Line: the shared warning without a title, one line. One file: its name,
 * short reason and what to do. Several: how many, and a toggle that lists
 * each with its reason and what to do. */
export function RefusalLine({ refused, onDismiss, onRetry }: Props) {
  const t = useText(refusalText);
  useLanguage();
  const [open, setOpen] = useState(false);
  if (!refused.length) return null;
  const one = refused.length === 1 ? refused[0] : null;
  const failed = refused.filter((r) => r.reason === "failed" && r.file);
  return (
    <WarningBanner
      data-testid="attachment-refusal"
      data-state="line"
      tone="danger"
      short={one ? t.line(one.name, t.short[one.reason]) : undefined}
      actions={
        <>
          {failed.length ? (
            <ControlButton size="inline" variant="quiet" onPress={() => failed.forEach(onRetry)}>
              <Icon name="refresh" />
              {t.retry}
            </ControlButton>
          ) : null}
          {one ? null : (
            <ControlButton data-testid="refusal-toggle" size="inline" variant="quiet" aria-expanded={open} onPress={() => setOpen(!open)}>
              {open ? t.hide : t.show}
              <Icon name={open ? "up" : "down"} />
            </ControlButton>
          )}
          <ControlButton size="inline" variant="quiet" presentation="icon" aria-label={t.dismiss} onPress={() => onDismiss()}>
            <Icon name="cross" />
          </ControlButton>
        </>
      }
    >
      {one ? (
        <>
          {t.line(one.name, one.reason === "large" ? `${t.short.large} (${mt(one.size, t.unit)})` : t.short[one.reason])} {t.todo[one.reason]}
        </>
      ) : (
        <>
          <span>
            {t.many(refused.length)}: {reasons(refused).map((x) => t.short[x]).join(", ")}.
          </span>
          {open ? (
            <ul className="lt-refused-list lt-refused-detail" data-testid="refusal-details">
              {refused.map((r, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the same name may be dropped twice.
                <li key={`${r.name}:${i}`}>
                  <span className="lt-name">{r.name}</span>
                  <span className="lt-short">
                    {why(t, r)} {t.todo[r.reason]}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </WarningBanner>
  );
}
