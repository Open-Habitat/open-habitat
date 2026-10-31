import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import "./AppleIntegration.css";
import {
  type AppleService,
  appleServices,
  iCloudMail,
} from "../app/integrations";
import { liveText } from "../i18n";
import { appleText } from "../text/apple";
import { ControlButton, ExternalLink } from "./ControlElements";
import { Icon, type IconName } from "./Icon";
import { AgentWarning, ProviderMark, serviceName } from "./Integrations";
import { Checkbox, TextField } from "./Primitives";

const txt = liveText(appleText);

// The Apple (iCloud) guide, in the "Valitse palvelut" direction Jari chose
// (proto-apple-icloud-integration, 2026-10-24): the person chooses the
// services, creates one app-specific password with Apple's own steps
// (support.apple.com/102654) and enters it once. Services added later reuse
// the stored password; the daemon reads it, the page never sees it.

export type AppleMode =
  | { kind: "new" }
  | {
      kind: "add";
      appleId: string;
      missing: AppleService[];
      have: AppleService[];
    }
  | { kind: "renew"; appleId: string; services: AppleService[] };

export type AppleFailure = { service: AppleService; failure: string };
export type AppleStage =
  | {
      stage: "steps";
      busy?: boolean;
      error?: string;
      /** Adding services: the stored password did not work, so ask. */
      askPassword?: boolean;
    }
  | { stage: "done"; connected: AppleService[]; failed: AppleFailure[] }
  | { stage: "uncertain" };

export type AppleSubmit = {
  appleId: string;
  services: AppleService[];
  /** Absent: reuse the password stored in the Apple ID's accounts. */
  password?: string;
  mailAddress?: string;
};

const email = /^[a-z0-9._%+-]{1,64}@[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/;
// What Apple's page shows; a hint, never a blocking rule, since Apple's
// support article does not promise the format.
const appPassword = /^[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}$/;
const icons: Record<AppleService, IconName> = {
  mail: "mail",
  calendar: "calendar",
  contacts: "contacts",
};
const short = new Proxy({} as Record<AppleService, string>, {
  get: (_target, service: AppleService) => txt.short[service],
});
const front: Record<AppleService, string> = {
  mail: "imap.mail.me.com",
  calendar: "caldav.icloud.com",
  contacts: "contacts.icloud.com",
};
const failureText = new Proxy({} as Record<string, string>, {
  get: (_target, failure: string) => txt.failure[failure],
});
const and = (xs: string[]) =>
  xs.length < 2
    ? xs.join("")
    : `${xs.slice(0, -1).join(", ")}${txt.and}${xs.at(-1)}`;

type StepId = "choose" | "password" | "enter";
const stepTitle = new Proxy({} as Record<StepId, string>, {
  get: (_target, step: StepId) => txt.steps[step],
});

function CopyValue({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <ControlButton
      size="row"
      variant="quiet"
      presentation="icon"
      aria-label={txt.copy(value)}
      data-testid="apple-copy"
      onPress={() => {
        void navigator.clipboard?.writeText(value).catch(() => {});
        setDone(true);
        window.setTimeout(() => setDone(false), 1400);
      }}
    >
      <Icon name={done ? "check" : "copy"} width={14} height={14} />
    </ControlButton>
  );
}

/** Apple's documented steps for an app-specific password. */
function HowTo({ renew }: { renew?: AppleService[] }) {
  return (
    <>
      {renew ? (
        <p data-testid="apple-renew-why">
          {txt.renewWhy(
            renew.length > 1,
            renew.length > 1
              ? and(renew.map((s) => short[s]))
              : short[renew[0] ?? "contacts"],
          )}
        </p>
      ) : null}
      <ol className="ap-how" data-testid="apple-how">
        <li>
          {txt.signIn}{" "}
          <ExternalLink
            href="https://account.apple.com"
            target="_blank"
            rel="noreferrer"
            data-testid="apple-link"
          >
            account.apple.com <Icon name="external" width={12} height={12} />
          </ExternalLink>
        </li>
        <li>
          <span className="ap-path">
            Sign-In and Security › App-Specific Passwords
          </span>
        </li>
        <li>
          {txt.generate}{" "}
          <span className="ap-val">
            <code>Open Habitat</code>
            <CopyValue value="Open Habitat" />
          </span>
        </li>
        <li>
          {txt.copyLooks} <code>abcd-efgh-ijkl-mnop</code>
        </li>
      </ol>
      <p className="ap-warn" data-testid="apple-twofa">
        <Icon name="warning" width={16} height={16} />
        <span>{txt.twoFactor}</span>
      </p>
    </>
  );
}

export function AppleGuide({
  mode,
  stage,
  onSubmit,
  onClose,
}: {
  mode: AppleMode;
  stage: AppleStage;
  onSubmit: (submit: AppleSubmit) => void;
  onClose: () => void;
}) {
  const add = mode.kind === "add";
  const renew = mode.kind === "renew";
  const askPassword = stage.stage === "steps" && stage.askPassword;
  const steps: StepId[] = renew
    ? ["password", "enter"]
    : add && !askPassword
      ? ["choose", "enter"]
      : ["choose", "password", "enter"];
  const [at, setAt] = useState(0);
  const step = steps[Math.min(at, steps.length - 1)] ?? "enter";
  const [wanted, setWanted] = useState<AppleService[]>(
    add ? mode.missing : appleServices,
  );
  const [appleId, setAppleId] = useState(add || renew ? mode.appleId : "");
  const [mailAddress, setMailAddress] = useState("");
  const [password, setPassword] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  // A stored password that no longer works asks for a new one: show how.
  useEffect(() => {
    if (askPassword) setAt(1);
  }, [askPassword]);
  useEffect(() => {
    void step;
    void stage.stage;
    heading.current?.focus();
  }, [step, stage.stage]);
  const busy = stage.stage === "steps" && stage.busy;
  const id = appleId.trim().toLowerCase();
  const idOk = email.test(id);
  const needsMail =
    !renew && wanted.includes("mail") && idOk && !iCloudMail(id);
  const mail = mailAddress.trim().toLowerCase();
  const reuse = add && !askPassword;
  const ready =
    idOk &&
    wanted.length > 0 &&
    (!needsMail || iCloudMail(mail)) &&
    (reuse || password.trim() !== "");
  const looksWrong =
    password.trim() !== "" && !appPassword.test(password.trim().toLowerCase());
  const services = renew ? mode.services : wanted;
  const title = renew
    ? txt.titleRenew
    : add
      ? txt.titleAdd(and(wanted.map((s) => short[s])))
      : txt.titleConnect;
  const submit = () => {
    if (!ready || busy) return;
    onSubmit({
      appleId: id,
      services,
      password: reuse ? undefined : password.trim(),
      mailAddress: needsMail ? mail : undefined,
    });
  };
  const body: Record<StepId, () => ReactNode> = {
    choose: () => (
      <>
        <p>{txt.whatGet}</p>
        <div className="ap-choose" data-testid="apple-choose">
          {(add ? mode.missing : appleServices).map((s) => (
            <Checkbox
              key={s}
              data-testid={`apple-want-${s}`}
              label={serviceName("apple", s)}
              hint={s === "mail" ? txt.mailHint : txt.otherHint}
              checked={wanted.includes(s)}
              onChange={(on) =>
                setWanted((w) =>
                  appleServices.filter((x) => (x === s ? on : w.includes(x))),
                )
              }
            />
          ))}
        </div>
        {add ? null : <AgentWarning />}
      </>
    ),
    password: () => <HowTo renew={renew ? mode.services : undefined} />,
    enter: () => (
      <form
        className="ig-flow-form"
        data-testid="apple-enter"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {add || renew ? (
          <p className="ap-fixed" data-testid="apple-id-fixed">
            <span className="ap-k">Apple ID</span> {mode.appleId}
          </p>
        ) : (
          <TextField
            data-testid="apple-id"
            label="Apple ID"
            autoComplete="email"
            value={appleId}
            onChange={setAppleId}
            hint={txt.appleIdHint}
          />
        )}
        {needsMail ? (
          <TextField
            data-testid="apple-mail-address"
            label={txt.mailAddress}
            autoComplete="email"
            value={mailAddress}
            onChange={setMailAddress}
            hint={txt.mailAddressHint}
          />
        ) : null}
        {reuse ? (
          <p className="ap-quiet" data-testid="apple-reuse">
            {txt.reuse(and(mode.have.map((s) => short[s])))}
          </p>
        ) : (
          <label className="s-field ig-password">
            <span>{txt.appPassword}</span>
            <input
              type="password"
              data-testid="apple-password"
              autoComplete="new-password"
              value={password}
              maxLength={1024}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {looksWrong ? (
          <p className="ap-quiet ap-soft" data-testid="apple-looks-wrong">
            <Icon name="info" width={14} height={14} />
            {txt.looksWrong}
          </p>
        ) : null}
        <p className="ap-quiet" data-testid="apple-saved-where">
          {txt.savedWhere(
            and(services.map((s) => front[s])),
            services.includes("mail"),
          )}
        </p>
        {stage.stage === "steps" && stage.error ? (
          <p className="ig-err" role="alert" data-testid="apple-error">
            <Icon name="warning" />
            <span>{stage.error}</span>
          </p>
        ) : null}
        <button type="submit" hidden />
      </form>
    ),
  };
  let content: ReactNode;
  let foot: ReactNode;
  if (stage.stage === "uncertain") {
    content = (
      <p className="ig-result bad" role="alert">
        <Icon name="warning" />
        <span>{txt.uncertain}</span>
      </p>
    );
    foot = (
      <ControlButton
        data-testid="apple-finish"
        size="page"
        variant="primary"
        onPress={onClose}
      >
        {txt.close}
      </ControlButton>
    );
  } else if (stage.stage === "done") {
    content = (
      <ul className="ap-result" data-testid="apple-result">
        {appleServices
          .filter(
            (s) =>
              stage.connected.includes(s) ||
              stage.failed.some((f) => f.service === s),
          )
          .map((s) => {
            const ok = stage.connected.includes(s);
            const failure = stage.failed.find((f) => f.service === s)?.failure;
            return (
              <li
                key={s}
                data-testid={`apple-result-${s}`}
                data-ok={ok || undefined}
              >
                <span className="ig-ic sm">
                  <Icon name={icons[s]} />
                </span>
                <div>
                  <b>{serviceName("apple", s)}</b>
                  {ok ? null : (
                    <span className="ig-meta">
                      {failureText[failure ?? ""] ?? txt.notConnectedRetry}
                    </span>
                  )}
                </div>
                <span className={`ig-st ${ok ? "ok" : "warn"}`}>
                  <Icon name={ok ? "check" : "warning"} />
                  {ok ? txt.works : txt.notConnected}
                </span>
              </li>
            );
          })}
      </ul>
    );
    foot = (
      <ControlButton
        data-testid="apple-finish"
        size="page"
        variant="primary"
        onPress={onClose}
      >
        {txt.done}
      </ControlButton>
    );
  } else {
    const i = steps.indexOf(step);
    const last = step === "enter";
    content = (
      <>
        {steps.length > 1 ? (
          <div
            className="ap-progress"
            data-testid="apple-progress"
            role="img"
            aria-label={txt.stepOf(i + 1, steps.length)}
          >
            {steps.map((x, j) => (
              <span
                key={x}
                data-done={j < i || undefined}
                data-current={j === i || undefined}
              />
            ))}
          </div>
        ) : null}
        <p
          className="ap-stepname"
          data-testid="apple-stepname"
          data-step={step}
        >
          <span className="ap-muted">
            {i + 1}/{steps.length}
          </span>{" "}
          {stepTitle[step]}
        </p>
        <div className="ap-stepbody" data-testid={`apple-step-${step}`}>
          {body[step]()}
        </div>
      </>
    );
    foot = (
      <>
        {step === "password" && !renew ? (
          <ControlButton
            data-testid="apple-skip"
            size="row"
            variant="quiet"
            onPress={() => setAt(steps.indexOf("enter"))}
          >
            {txt.havePassword}
          </ControlButton>
        ) : null}
        <span className="ap-grow" />
        {i > 0 ? (
          <ControlButton
            data-testid="apple-back"
            size="row"
            variant="secondary"
            isDisabled={busy}
            onPress={() => setAt(i - 1)}
          >
            {txt.back}
          </ControlButton>
        ) : (
          <ControlButton
            data-testid="apple-cancel"
            size="row"
            variant="secondary"
            onPress={onClose}
          >
            {txt.cancel}
          </ControlButton>
        )}
        {last ? (
          <ControlButton
            data-testid="apple-connect"
            size="page"
            variant="primary"
            isDisabled={!ready || busy}
            onPress={submit}
          >
            {busy ? txt.connecting : renew ? txt.changePassword : txt.connect}
          </ControlButton>
        ) : (
          <ControlButton
            data-testid="apple-next"
            size="page"
            variant="primary"
            isDisabled={step === "choose" && wanted.length === 0}
            onPress={() => setAt(i + 1)}
          >
            {txt.next}
          </ControlButton>
        )}
      </>
    );
  }
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen
      isDismissable={!busy}
      onOpenChange={(open) => !open && onClose()}
    >
      <Modal className="ah-modal ig-dlg">
        <AriaDialog
          className="ah-dialog ap-dialog"
          data-testid="apple-guide"
          data-stage={stage.stage}
          aria-label={title}
        >
          <div className="ig-dh">
            <ProviderMark provider="apple" small />
            <Heading slot="title" ref={heading} tabIndex={-1}>
              {title}
            </Heading>
            <ControlButton
              data-testid="dialog-close"
              size="row"
              variant="quiet"
              presentation="icon"
              aria-label={txt.close}
              isDisabled={busy}
              onPress={onClose}
            >
              <Icon name="cross" />
            </ControlButton>
          </div>
          {content}
          <div className="ap-foot">{foot}</div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Removing the Apple ID removes its services' logins; the app-specific
 * password stays valid at Apple until the person revokes it there. */
export function AppleRemoveDialog({
  appleId,
  services,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  appleId: string;
  services: AppleService[];
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen
      isDismissable={!busy}
      onOpenChange={(open) => !open && onClose()}
    >
      <Modal className="ah-modal">
        <AriaDialog
          className="ah-dialog"
          role="alertdialog"
          data-testid="apple-remove-dialog"
          aria-label={txt.removeQuestion(appleId)}
        >
          <Heading slot="title">{txt.removeTitle(appleId)}</Heading>
          <p>
            {txt.removeBody(
              and(services.map((s) => serviceName("apple", s))),
              <span className="ap-path">
                account.apple.com › Sign-In and Security › App-Specific
                Passwords
              </span>,
            )}
          </p>
          {error ? <p role="alert">{error}</p> : null}
          <div className="ah-dialog-actions">
            <ControlButton
              data-testid="cancel"
              size="page"
              variant="secondary"
              autoFocus
              onPress={onClose}
            >
              {txt.cancel}
            </ControlButton>
            <ControlButton
              data-testid="integration-remove-confirm"
              size="page"
              variant="danger"
              isPending={busy}
              onPress={onConfirm}
            >
              {txt.remove}
            </ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
