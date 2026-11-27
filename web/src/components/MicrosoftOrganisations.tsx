import { type ReactNode, useEffect, useRef, useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import {
  type AdminOrganisation,
  adminOrganisations,
  guid,
  hasShared,
  type MsLevelId,
  validLabel,
} from "../app/microsoftOrganisations";
import type { AppChange, IntegrationApps } from "../app/serverIntegrations";
import { appRefusal } from "../app/serverIntegrations";
import { liveText } from "../i18n";
import { microsoftLevelsText } from "../text/microsoftLevels";
import { microsoftOrganisationsText } from "../text/microsoftOrganisations";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { TextField } from "./Primitives";
import { Badge } from "./Status";
import "./MicrosoftOrganisations.css";

const txt = liveText(microsoftOrganisationsText);
const levelsTxt = liveText(microsoftLevelsText);

// Palvelinintegraatiot › Microsoft 365 › Organisaatiot (prototype round 4,
// 2026-11-27-entra-organisaatiot-4, direction A2a). The dialog opens the way
// the Levels dialog does, one organisation per row, and adding, approval and
// removal are steps of the same dialog: a step returns to the list, and
// focus returns to the row it was opened from. The server cannot see whether
// an organisation approved, so a client's state says exactly that.

/** An organisation's name as the dialog shows it. */
export const organisationName = (o: AdminOrganisation) =>
  o.label ?? (o.own ? txt.ownUnnamed : o.tenant_id);

type Step =
  | { k: "list" }
  | { k: "add" }
  | { k: "consent"; tenant: string }
  | { k: "remove"; tenant: string };

/** What the last write said, shown where the administrator is. */
type Outcome =
  | { kind: "done"; text: string }
  | { kind: "refused"; text: string }
  | { kind: "uncertain" };

function CopyButton({
  value,
  label,
  name,
  testId,
  variant = "secondary",
}: {
  value: string;
  label: string;
  /** The accessible name, when the visible label alone is too short. */
  name?: string;
  testId: string;
  variant?: "secondary" | "quiet";
}) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(false), 1400);
    return () => window.clearTimeout(t);
  }, [done]);
  return (
    <ControlButton
      data-testid={testId}
      size="row"
      variant={variant}
      aria-label={name}
      onPress={() => {
        void navigator.clipboard?.writeText(value).then(
          () => setDone(true),
          () => {},
        );
      }}
    >
      <Icon name={done ? "check" : "copy"} />
      {label}
      {done ? <span className="ah-sr-only">{txt.copied}</span> : null}
    </ControlButton>
  );
}

/** The one "Lisätietoja" of a step: the explanations kept out of sight. */
function More({ lines, testId }: { lines: string[]; testId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mo-more" data-testid={testId}>
      <button
        type="button"
        className="ml-disclose"
        aria-expanded={open}
        data-testid={`${testId}-toggle`}
        onClick={() => setOpen(!open)}
      >
        <Icon name={open ? "up" : "info"} />
        {open ? txt.lessMore : txt.more}
      </button>
      {open && (
        <div className="mo-morebody" data-testid={`${testId}-body`}>
          {lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/** The step's own heading takes focus when the step opens, so a screen
 * reader hears where it is. */
function StepHead({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <h3
      ref={ref}
      tabIndex={-1}
      className="mo-h3 mo-stephead"
      data-testid="mo-step-head"
    >
      {children}
    </h3>
  );
}

function OutcomeLine({
  outcome,
  onReread,
}: {
  outcome?: Outcome;
  onReread: () => void;
}) {
  if (!outcome) return null;
  if (outcome.kind === "done")
    return (
      <p className="si-quiet" role="status" data-testid="mo-outcome">
        {outcome.text}
      </p>
    );
  return (
    <div className="mo-problem" role="alert" data-testid="mo-problem">
      <Icon name="warning" />
      <span>{outcome.kind === "refused" ? outcome.text : txt.uncertain}</span>
      {outcome.kind === "uncertain" ? (
        <ControlButton
          data-testid="mo-reread"
          size="row"
          variant="secondary"
          onPress={onReread}
        >
          <Icon name="refresh" />
          {txt.reread}
        </ControlButton>
      ) : null}
    </div>
  );
}

function OrgRows({
  orgs,
  locked,
  onStep,
}: {
  orgs: AdminOrganisation[];
  locked: boolean;
  onStep: (s: Step) => void;
}) {
  return (
    <ul className="mo-orgs" data-testid="mo-orgs">
      {orgs.map((o) => {
        const name = organisationName(o);
        return (
          <li
            key={o.tenant_id}
            data-testid={`mo-org-${o.tenant_id}`}
            data-own={o.own || undefined}
          >
            <span className="mo-orgmain">
              <span className="mo-orgname">
                <strong>{name}</strong>
                {o.own && o.label ? <Badge label={txt.own} /> : null}
              </span>
              <span
                className="mo-orgstate"
                data-testid={`mo-state-${o.tenant_id}`}
                data-known={o.own || undefined}
              >
                <Icon name={o.own ? "check" : "question"} />
                {o.own ? txt.stateOwn : txt.stateUnknown}
              </span>
            </span>
            <span className="mo-rowacts">
              <ControlButton
                data-testid={`mo-consent-open-${o.tenant_id}`}
                size="row"
                variant={o.own ? "quiet" : "secondary"}
                aria-label={txt.consentOf(name)}
                onPress={() => onStep({ k: "consent", tenant: o.tenant_id })}
              >
                {txt.consentOpen}
              </ControlButton>
              {o.listed ? (
                <ControlButton
                  data-testid={`mo-remove-open-${o.tenant_id}`}
                  className="mo-destructive"
                  size="row"
                  variant="danger-subtle"
                  presentation="icon"
                  aria-label={txt.removeOf(name)}
                  tooltip={txt.removeOf(name)}
                  isDisabled={locked}
                  onPress={() => onStep({ k: "remove", tenant: o.tenant_id })}
                >
                  <Icon name="trash" />
                </ControlButton>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function AddStep({
  orgs,
  busy,
  outcome,
  onAdd,
  onBack,
  onReread,
}: {
  orgs: AdminOrganisation[];
  busy: boolean;
  outcome?: Outcome;
  onAdd: (tenant: string, label: string) => void;
  onBack: () => void;
  onReread: () => void;
}) {
  const [label, setLabel] = useState("");
  const [tenant, setTenant] = useState("");
  const [tried, setTried] = useState(false);
  const l = label.trim();
  const t = tenant.trim().toLowerCase();
  const dup = orgs.find((o) => o.listed && o.tenant_id === t);
  const badLabel = !validLabel(l);
  const labelErr = tried && badLabel ? txt.errLabel : undefined;
  const tenantErr = tried
    ? !guid.test(t)
      ? txt.errTenant
      : dup
        ? txt.errDuplicate(organisationName(dup))
        : undefined
    : undefined;
  return (
    <>
      <div className="si-stepbody mo-add" data-testid="mo-add">
        <StepHead>{txt.addTitle}</StepHead>
        <TextField
          data-testid="mo-add-label"
          name="organisation-label"
          label={txt.labelField}
          value={label}
          onChange={setLabel}
          hint={txt.labelHint}
          error={labelErr}
        />
        <TextField
          data-testid="mo-add-tenant"
          name="organisation-tenant"
          label={txt.tenantField}
          value={tenant}
          onChange={setTenant}
          error={tenantErr}
          mono
        />
        <p className="si-quiet mo-note" data-testid="mo-limit">
          <Icon name="shield" />
          <span>{txt.limitShort}</span>
        </p>
        <More lines={txt.moreAdd} testId="mo-more-add" />
        <OutcomeLine outcome={outcome} onReread={onReread} />
      </div>
      <div className="si-foot">
        <ControlButton
          data-testid="mo-back"
          size="row"
          variant="secondary"
          onPress={onBack}
        >
          <Icon name="back" />
          {txt.back}
        </ControlButton>
        <span className="si-grow" />
        <ControlButton
          data-testid="mo-add-save"
          size="page"
          variant="primary"
          isPending={busy}
          onPress={() => {
            setTried(true);
            if (badLabel || !guid.test(t) || dup) return;
            onAdd(t, l);
          }}
        >
          {txt.addSave}
        </ControlButton>
      </div>
    </>
  );
}

function ConsentBody({
  org,
  publisher,
}: {
  org: AdminOrganisation;
  publisher: string;
}) {
  const level = (l: MsLevelId) => levelsTxt.short[l];
  const message = txt.message({
    org: organisationName(org),
    publisher,
    links: org.links.map((l) => ({ level: level(l.level), url: l.url })),
  });
  if (!org.links.length)
    return (
      <div className="mo-consent" data-testid="mo-consent">
        <p>{txt.consentNone}</p>
      </div>
    );
  return (
    <div className="mo-consent" data-testid="mo-consent">
      <p>{org.own ? txt.consentOwn : txt.consentLead}</p>
      {!org.own && (
        <>
          {/* It may scroll, so it takes focus to be read by keyboard. */}
          <section
            className="mo-message"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must be reachable by keyboard
            tabIndex={0}
            aria-label={txt.messageLabel}
          >
            <pre data-testid="mo-message">{message}</pre>
          </section>
          <div className="mo-acts">
            <CopyButton
              testId="mo-message-copy"
              value={message}
              label={txt.messageCopy}
            />
          </div>
        </>
      )}
      <div className="mo-links" data-testid="mo-links">
        <span className="mo-linkstitle">{txt.linksTitle}</span>
        {org.links.map((l) => (
          <CopyButton
            key={l.level}
            testId={`mo-link-${l.level}`}
            variant="quiet"
            value={l.url}
            label={level(l.level)}
            name={txt.linkCopy(level(l.level))}
          />
        ))}
      </div>
      <More lines={txt.moreConsent} testId="mo-more-consent" />
    </div>
  );
}

function ConsentStep({
  org,
  publisher,
  outcome,
  onReread,
  onBack,
}: {
  org: AdminOrganisation;
  publisher: string;
  outcome?: Outcome;
  onReread: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <div className="si-stepbody">
        <StepHead>{txt.consentTitle(organisationName(org))}</StepHead>
        <OutcomeLine outcome={outcome} onReread={onReread} />
        <ConsentBody org={org} publisher={publisher} />
      </div>
      <div className="si-foot">
        <span className="si-grow" />
        <ControlButton
          data-testid="mo-consent-done"
          size="page"
          variant="primary"
          onPress={onBack}
        >
          {txt.done}
        </ControlButton>
      </div>
    </>
  );
}

function RemoveStep({
  org,
  busy,
  outcome,
  onConfirm,
  onBack,
  onReread,
}: {
  org: AdminOrganisation;
  busy: boolean;
  outcome?: Outcome;
  onConfirm: () => void;
  onBack: () => void;
  onReread: () => void;
}) {
  return (
    <>
      <div className="si-stepbody" data-testid="mo-remove">
        <StepHead>{txt.removeTitle(organisationName(org))}</StepHead>
        <p>{txt.removeBody}</p>
        {org.own && (
          <p className="si-warn" data-testid="mo-remove-own">
            <Icon name="warning" />
            <span>{txt.removeOwn}</span>
          </p>
        )}
        <More lines={txt.moreRemove} testId="mo-more-remove" />
        <OutcomeLine outcome={outcome} onReread={onReread} />
      </div>
      <div className="si-foot">
        <span className="si-grow" />
        <ControlButton
          data-testid="mo-remove-cancel"
          size="row"
          variant="secondary"
          onPress={onBack}
        >
          {txt.cancel}
        </ControlButton>
        <ControlButton
          data-testid="mo-remove-confirm"
          className="si-destructive"
          size="page"
          variant="danger"
          isPending={busy}
          onPress={onConfirm}
        >
          {txt.removeConfirm}
        </ControlButton>
      </div>
    </>
  );
}

export function MicrosoftOrganisationsDialog({
  apps,
  locked,
  onSet,
  onRemove,
  onReread,
  onClose,
}: {
  apps: IntegrationApps;
  /** Browser setup is off or the administrator cannot write. */
  locked: boolean;
  onSet: (tenant: string, label: string) => Promise<AppChange>;
  onRemove: (tenant: string) => Promise<AppChange>;
  onReread: () => void;
  onClose: () => void;
}) {
  const orgs = adminOrganisations(apps);
  const [step, setStep] = useState<Step>({ k: "list" });
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>();
  // Returning to the list puts focus back on the row the step came from (or
  // on Add when that row is gone), so focus stays inside the dialog.
  const from = useRef<string | null>(null);
  const box = useRef<HTMLElement>(null);
  const toList = (keep?: Outcome) => {
    from.current =
      step.k === "list" ? null : step.k === "add" ? "add" : step.tenant;
    setOutcome(keep);
    setStep({ k: "list" });
  };
  useEffect(() => {
    if (step.k !== "list" || !from.current) return;
    const root = box.current;
    const target =
      root?.querySelector<HTMLElement>(
        `[data-testid="mo-consent-open-${from.current}"]`,
      ) ?? root?.querySelector<HTMLElement>('[data-testid="mo-add-open"]');
    target?.focus();
    from.current = null;
  }, [step]);
  const open = (s: Step) => {
    setOutcome(undefined);
    setStep(s);
  };
  const settle = (r: AppChange): Outcome | undefined =>
    r.kind === "uncertain"
      ? { kind: "uncertain" }
      : r.kind === "refused"
        ? { kind: "refused", text: appRefusal(r.code) }
        : r.kind === "login"
          ? { kind: "refused", text: appRefusal("login") }
          : undefined;
  const ownOrg = orgs.find((o) => o.own && o.label);
  const publisher = ownOrg?.label ?? txt.publisherUnknown;
  const invalid = apps.tenants_invalid === true;
  const writable = !locked && !invalid;
  const current =
    step.k === "consent" || step.k === "remove"
      ? orgs.find((o) => o.tenant_id === step.tenant)
      : undefined;
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen
      isDismissable={false}
      onOpenChange={(o) => !o && onClose()}
    >
      <Modal className="ah-modal mo-modal">
        <Dialog
          ref={box}
          className="ah-dialog si-dialog mo-dialog"
          data-testid="mo-dialog"
          data-step={step.k}
          aria-label={txt.dialogTitle}
        >
          <Heading slot="title">{txt.dialogTitle}</Heading>
          {step.k === "list" || (!current && step.k !== "add") ? (
            <>
              <div className="si-stepbody mo-orglist" data-testid="mo-list">
                {invalid ? (
                  <p className="si-warn" data-testid="mo-list-invalid">
                    <Icon name="warning" />
                    <span>{txt.listInvalid}</span>
                  </p>
                ) : locked ? (
                  <p className="si-quiet mo-note" data-testid="mo-locked">
                    <Icon name="info" />
                    <span>{txt.setupOff}</span>
                  </p>
                ) : null}
                <OrgRows orgs={orgs} locked={!writable} onStep={open} />
                {!hasShared(apps) && orgs.some((o) => !o.own) ? (
                  <p className="si-quiet mo-note" data-testid="mo-no-shared">
                    <Icon name="info" />
                    <span>{txt.noShared}</span>
                  </p>
                ) : null}
                <div>
                  <ControlButton
                    data-testid="mo-add-open"
                    size="row"
                    variant="secondary"
                    isDisabled={!writable}
                    onPress={() => open({ k: "add" })}
                  >
                    <Icon name="plus" />
                    {txt.addOrg}
                  </ControlButton>
                </div>
                <OutcomeLine outcome={outcome} onReread={onReread} />
                <More lines={txt.moreList} testId="mo-more-list" />
              </div>
              <div className="si-foot">
                <span className="si-grow" />
                <ControlButton
                  data-testid="mo-close"
                  size="page"
                  variant="secondary"
                  onPress={onClose}
                >
                  {txt.done}
                </ControlButton>
              </div>
            </>
          ) : step.k === "add" ? (
            <AddStep
              orgs={orgs}
              busy={busy}
              outcome={outcome}
              onReread={onReread}
              onBack={() => toList()}
              onAdd={(tenant, label) => {
                setBusy(true);
                setOutcome(undefined);
                void onSet(tenant, label).then((r) => {
                  setBusy(false);
                  const problem = settle(r);
                  if (problem) setOutcome(problem);
                  else {
                    setOutcome({ kind: "done", text: txt.added(label) });
                    setStep({ k: "consent", tenant });
                  }
                });
              }}
            />
          ) : step.k === "consent" && current ? (
            <ConsentStep
              org={current}
              publisher={publisher}
              outcome={outcome}
              onReread={onReread}
              onBack={() => toList()}
            />
          ) : current ? (
            <RemoveStep
              org={current}
              busy={busy}
              outcome={outcome}
              onReread={onReread}
              onBack={() => toList()}
              onConfirm={() => {
                setBusy(true);
                setOutcome(undefined);
                const name = organisationName(current);
                void onRemove(current.tenant_id).then((r) => {
                  setBusy(false);
                  const problem = settle(r);
                  if (problem) setOutcome(problem);
                  else toList({ kind: "done", text: txt.removed(name) });
                });
              }}
            />
          ) : null}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
