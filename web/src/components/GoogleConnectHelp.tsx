import { useState } from "react";
import {
  type Account,
  authorizationClient,
  type ServiceId,
} from "../app/integrations";
import { liveText } from "../i18n";
import { googleConnectText } from "../text/googleConnect";
import { ControlButton } from "./ControlElements";
import { GoogleShot } from "./GoogleGuide";
import { Icon, type IconName } from "./Icon";
import "./GoogleConnectHelp.css";

// The person's help for Google's own screens while connecting a Google
// account (google-personal-accounts, round 2 direction A "Muistutus", made
// shorter, Jari 21.11.2026): one short note before Google, and the help
// behind a link there and while waiting for the return address. Habitat
// cannot see Google's tab and does not know whether the server's app warns,
// so every answer is conditional and none is shown as a state.

const txt = liveText(googleConnectText);

type HelpId =
  | "warning"
  | "unfamiliar"
  | "org"
  | "internal"
  | "testing"
  | "cap"
  | "rate";
type Who = "self" | "server" | "org" | "wait";
/** Who acts on each case. */
const who: Record<HelpId, Who> = {
  warning: "self",
  unfamiliar: "server",
  org: "org",
  internal: "server",
  testing: "server",
  cap: "server",
  rate: "wait",
};
const whoIcon: Record<Who, IconName> = {
  self: "check",
  server: "server",
  org: "users",
  wait: "clock",
};
const stops: HelpId[] = ["org", "internal", "testing", "cap", "rate"];

function CopyClient({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="gc-client" data-testid="gc-client-id">
      <span className="ig-meta">{txt.clientId}</span>
      <code title={id}>{id}</code>
      <ControlButton
        size="row"
        variant="secondary"
        aria-label={txt.clientId}
        onPress={() => {
          void navigator.clipboard?.writeText(id).then(
            () => setDone(true),
            () => {},
          );
        }}
      >
        <Icon name={done ? "check" : "copy"} />
      </ControlButton>
    </div>
  );
}

function Answer({ id, client }: { id: HelpId; client: string }) {
  const code = (c: string) => (
    <p className="ig-meta">
      {txt.code} <code>{c}</code>. {txt.retryNoHelp}
    </p>
  );
  return (
    <div className="gc-answer" data-testid="gc-answer" data-help={id}>
      <span className="gc-who" data-who={who[id]}>
        <Icon name={whoIcon[who[id]]} />
        {txt.who[who[id]]}
      </span>
      {id === "warning" && (
        <>
          <p>{txt.warningBody}</p>
          <p>
            <b>
              {txt.warningCheck} <code>https://accounts.google.com</code>.
            </b>
          </p>
          <p>
            {txt.pathLead} <kbd>Advanced</kbd> → <kbd>Go to … (unsafe)</kbd>
          </p>
          <GoogleShot
            name="warning"
            t="advanced"
            alt={txt.alt.warning}
            caption={txt.placeholder}
          />
          <GoogleShot
            name="warningOpen"
            t="goto"
            alt={txt.alt.warningOpen}
            caption={txt.placeholder}
          />
          <p className="ig-meta">{txt.pathNote}</p>
          <p className="ig-meta">{txt.noWarning}</p>
        </>
      )}
      {id === "unfamiliar" && (
        <>
          <p>
            <b>{txt.unfamiliarBody}</b>
          </p>
          <p className="ig-meta">{txt.noShare}</p>
        </>
      )}
      {id === "org" && (
        <>
          <p>{txt.orgBody}</p>
          {client && <CopyClient id={client} />}
        </>
      )}
      {id === "internal" && (
        <>
          <p>{txt.internalBody}</p>
          {code("org_internal")}
        </>
      )}
      {id === "testing" && <p>{txt.testingBody}</p>}
      {id === "cap" && <p>{txt.capBody}</p>}
      {id === "rate" && (
        <>
          <p>{txt.rateBody}</p>
          <p className="ig-meta">
            {txt.code} <code>rate_limit_exceeded</code>.
          </p>
        </>
      )}
    </div>
  );
}

function Panel({ client }: { client: string }) {
  const [open, setOpen] = useState<HelpId | null>(null);
  const row = (id: HelpId) => (
    <li key={id} className="gc-case" data-open={open === id || undefined}>
      <button
        type="button"
        className="gc-case-head"
        data-testid={`gc-help-${id}`}
        aria-expanded={open === id}
        onClick={() => setOpen(open === id ? null : id)}
      >
        <Icon name={open === id ? "down" : "forward"} />
        <span>{txt.help[id]}</span>
      </button>
      {open === id && <Answer id={id} client={client} />}
    </li>
  );
  return (
    <div className="gc-panel" data-testid="gc-panel">
      <ul className="gc-cases">
        {(["warning", "unfamiliar"] as const).map(row)}
      </ul>
      <p className="ig-meta gc-group">{txt.stoppedGroup}</p>
      <ul className="gc-cases">{stops.map(row)}</ul>
    </div>
  );
}

/** Before Google opens: the one note, and the help behind its link. */
export function GoogleNote({
  authorizationUrl,
  host,
}: {
  authorizationUrl: string;
  host: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="ig-notice gc-note" role="note" data-testid="gc-note">
        <Icon name="info" />
        <div>
          {txt.note} {txt.noteCheck(host)}{" "}
          <button
            type="button"
            className="ig-link gc-linkbtn"
            data-testid="gc-more"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? txt.less : txt.more}
          </button>
        </div>
      </div>
      {open && <Panel client={authorizationClient(authorizationUrl)} />}
    </>
  );
}

/** While the return address is awaited: the same help behind a link. */
export function GoogleWaitHelp({
  authorizationUrl,
}: {
  authorizationUrl: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="gc-wait" data-testid="gc-wait">
      <button
        type="button"
        className="ig-link gc-linkbtn"
        data-testid="gc-more"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? txt.less : txt.waitLink}
      </button>
      {open && <Panel client={authorizationClient(authorizationUrl)} />}
    </div>
  );
}

/** What a pasted return address with Google's own error means. */
export const googleStopText = (error: string) =>
  error === "access_denied" ? txt.stoppedAtGoogle : txt.googleError(error);

/** The services the grant reaches, in the connected dialog, so a person
 * who left a service out at Google sees it at once, not only on the card. */
export function GrantSummary({
  account,
  name,
}: {
  account: Account;
  name: (id: ServiceId) => string;
}) {
  const shown = account.services.filter((s) => s.access);
  if (!shown.length) return null;
  const partial = shown.some((s) => s.access === "none");
  return (
    <div
      className="gc-granted"
      data-testid="gc-grant-summary"
      data-partial={partial || undefined}
    >
      <p className="ig-meta">{txt.grantLead}</p>
      <ul>
        {shown.map((s) => (
          <li key={s.id} data-access={s.access}>
            <Icon name={s.access === "none" ? "slash" : "check"} />
            <span>{name(s.id)}</span>
            {s.access === "none" && (
              <span className="ig-meta">{txt.grantNo}</span>
            )}
          </li>
        ))}
      </ul>
      {partial && <p className="ig-meta">{txt.grantPartial}</p>}
    </div>
  );
}
