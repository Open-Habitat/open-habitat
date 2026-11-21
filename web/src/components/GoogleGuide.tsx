import { useState } from "react";
import audienceImg from "../assets/google/audience.svg";
import { googleCrops, googlePlaceholders } from "../assets/google/crops";
import warningImg from "../assets/google/warning.svg";
import warningOpenImg from "../assets/google/warning-open.svg";
import { liveText } from "../i18n";
import { googleGuideText } from "../text/googleGuide";
import { serverIntegrationsText } from "../text/serverIntegrations";
import { ControlButton, Segmented } from "./ControlElements";
import { Copy, Modalish, Path, Progress, type Step, Val } from "./GuideParts";
import { Icon } from "./Icon";
import { ShotBand, useNarrow } from "./ShotBand";
import { Badge } from "./Status";
import "./GoogleGuide.css";

// The administrator's Google guide when personal Gmail accounts may connect
// too (google-personal-accounts, round 1 direction A "Kysymys ensin", Jari
// 21.11.2026). The first step asks whose accounts may connect, in terms of
// who is left out, before Google's words Internal and External; the path
// follows the answer. Habitat neither stores the answer nor reads Google's
// audience, publishing status or user cap: GoogleApp is a client id and a
// secret, and a stored claim about Google would drift from Google. So the
// guide asks the administrator what Google shows. An existing client's
// audience is changed from the row's own menu item (GoogleAudienceDialog),
// which asks for no new secret.

const txt = liveText(googleGuideText);
const siTxt = liveText(serverIntegrationsText);

export type Audience = "org" | "personal";
type Publish = "testing" | "production";

/** Google Auth platform's pages. Each opens in the project last selected in
 * the console. */
export const googleAuth = "https://console.cloud.google.com/auth";

/* ---------- Google's screens ---------- */

type ShotName = keyof typeof googleCrops;
const shots: Record<ShotName, string> = {
  warning: warningImg,
  warningOpen: warningOpenImg,
  audience: audienceImg,
};

/** A band of one of Google's screens with the control to press lit. Until
 * real captures replace the placeholders (assets/google/crops.ts), the
 * band says it is an illustration. */
export function GoogleShot({
  name,
  t,
  alt,
  caption,
}: {
  name: ShotName;
  t: string;
  alt: string;
  caption: string;
}) {
  const narrow = useNarrow();
  return (
    <ShotBand
      testId="google-shot"
      name={name}
      src={shots[name]}
      alt={alt}
      crop={googleCrops[name]}
      t={t}
      aspect={narrow ? 2.3 : 3.7}
      narrow={narrow}
    >
      {googlePlaceholders && (
        <figcaption
          className="shot-caption"
          data-testid="google-shot-placeholder"
        >
          <Icon name="image" />
          <span>{caption}</span>
        </figcaption>
      )}
    </ShotBand>
  );
}

const Unconfirmed = () => (
  <span className="gg-unconfirmed" data-testid="gg-unconfirmed">
    <Badge label={txt.unconfirmed} tone="warning" />
  </span>
);

/* ---------- step bodies ---------- */

/** Whose accounts may connect: two cards, each saying who is left out and
 * what follows. Nothing is preselected; the choice has consequences. */
export function AudienceChoice({
  value,
  onChange,
  existing,
}: {
  value: Audience | null;
  onChange: (a: Audience) => void;
  existing?: boolean;
}) {
  return (
    <>
      {existing && (
        <div className="gg-existing" data-testid="gg-existing">
          <p>{txt.existingNote}</p>
          <Path
            p="Google Auth platform › Audience"
            href={`${googleAuth}/audience`}
          />
          <p className="si-quiet">{txt.keepConnections}</p>
        </div>
      )}
      <fieldset className="gg-choice" data-testid="gg-choice">
        <legend className="gg-question">{txt.question}</legend>
        {(["org", "personal"] as const).map((a) => (
          <label
            key={a}
            className="gg-option"
            data-checked={value === a || undefined}
          >
            <span className="gg-option-head">
              <input
                type="radio"
                name="google-audience"
                value={a}
                checked={value === a}
                onChange={() => onChange(a)}
                data-testid={`gg-choose-${a}`}
              />
              <strong>{txt[a].name}</strong>
            </span>
            <span className="gg-option-body">{txt[a].body}</span>
            <ul className="gg-facts">
              {txt[a].facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <span className="gg-google">
              Google:{" "}
              <code>
                {a === "org" ? "Internal" : "External · In production"}
              </code>
            </span>
          </label>
        ))}
      </fieldset>
      {value === "personal" && <p className="si-quiet">{txt.smallGroup}</p>}
      {existing && value === "org" && (
        <p className="si-effect" data-testid="gg-org-already">
          {txt.orgAlready}
        </p>
      )}
      <p className="si-quiet" data-testid="gg-not-stored">
        {txt.notStored}
      </p>
    </>
  );
}

/** Branding: the app name and Internal, or External with the contacts,
 * links and domain an External production app needs, and what the person
 * will see before the permissions. */
export function brandStep(audience: Audience | null): Step {
  if (audience === "org")
    return {
      id: "brand",
      title: txt.stepBrandOrg,
      body: (
        <>
          <Path
            p="Google Auth platform › Branding › Get started"
            href={`${googleAuth}/branding`}
          />
          <Val k="App name" v="Open Habitat" />
          <Val k="Audience" v="Internal" copy={false} />
          <p className="si-effect" data-testid="si-audience">
            {siTxt.internal}
          </p>
        </>
      ),
    };
  return {
    id: "brand",
    title: txt.stepBrand,
    body: (
      <>
        <Path
          p="Google Auth platform › Branding"
          href={`${googleAuth}/branding`}
        />
        <Val k="App name" v="Open Habitat" />
        <Val k="User support email" v={txt.supportEmail} copy={false} />
        <p className="si-quiet">{txt.supportNote}</p>
        <Val k="Audience" v="External" copy={false} />
        <p className="si-effect" data-testid="si-audience">
          {txt.external}
        </p>
        <Val
          k="Developer contact information"
          v={txt.supportEmail}
          copy={false}
        />
        <Val k="Application home page" v={txt.homepage} copy={false} />
        <Val k="Application privacy policy link" v={txt.privacy} copy={false} />
        <p className="si-warn" data-testid="gg-privacy">
          <Icon name="shield" />
          <span>{txt.privacyNote}</span>
        </p>
        <Val k="Application terms of service link" v={txt.terms} copy={false} />
        <p className="si-quiet">{txt.termsNote}</p>
        <Val k="Authorized domains" v={txt.domain} copy={false} />
        <p className="si-quiet">{txt.domainNote}</p>
        <div className="gg-preview" data-testid="gg-preview">
          <p className="gg-inline">
            <strong>{txt.previewTitle}</strong> <Unconfirmed />
          </p>
          <GoogleShot
            name="warning"
            t="advanced"
            alt={txt.alt.warning}
            caption={txt.placeholder}
          />
          <p className="si-quiet">{txt.previewNote}</p>
        </div>
      </>
    ),
  };
}

/** Publishing: what Google's Publishing status says decides the answer;
 * Habitat cannot read it, so the administrator tells. */
function Publishing({ existing }: { existing?: boolean }) {
  const [publish, setPublish] = useState<Publish>("testing");
  return (
    <>
      <Path
        p="Google Auth platform › Audience"
        href={`${googleAuth}/audience`}
      />
      {existing && (
        <>
          <GoogleShot
            name="audience"
            t="external"
            alt={txt.alt.audience}
            caption={txt.placeholder}
          />
          <p className="si-quiet" data-testid="gg-make-external">
            {txt.makeExternal("Make external")}
          </p>
        </>
      )}
      <Segmented
        data-testid="gg-publish"
        label={txt.publishWhere}
        value={publish}
        onChange={setPublish}
        options={[
          { id: "testing", label: "Testing" },
          { id: "production", label: "In production" },
        ]}
      />
      {publish === "testing" ? (
        <div className="gg-state" data-testid="gg-testing">
          <p className="si-warn">
            <Icon name="warning" />
            <span>{txt.testingWarn}</span>
          </p>
          <GoogleShot
            name="audience"
            t="publish"
            alt={txt.alt.audience}
            caption={txt.placeholder}
          />
          <p className="si-quiet">{txt.publishNow("Publish app")}</p>
        </div>
      ) : (
        <p className="gg-ok" data-testid="gg-production">
          <Icon name="check" />
          <span>{txt.productionOk}</span>
        </p>
      )}
      <div className="gg-cap" data-testid="gg-cap">
        <p>
          <strong>{txt.capTitle}</strong>
        </p>
        <p>{txt.cap}</p>
        <Path p="Google Auth platform › Audience › OAuth user cap" />
        <p className="si-quiet">{txt.capWhere}</p>
      </div>
      <p className="si-quiet">
        {txt.noVerification} {txt.smallGroup}
      </p>
      <p className="si-effect">{txt.publishInGoogle}</p>
    </>
  );
}

export const publishStep = (existing?: boolean): Step => ({
  id: "publish",
  title: txt.stepPublish,
  body: <Publishing existing={existing} />,
});

/** The note under the scopes on the personal path. */
export const restrictedNote = () => (
  <p className="si-effect" data-testid="gg-restricted">
    {txt.restricted}
  </p>
);

export const apisPersonal = () => txt.apisPersonal;
export const ownProjectNote = () => (
  <p className="si-quiet" data-testid="gg-own-project">
    {txt.ownProject}
  </p>
);

/** What to send another organisation's administrator who blocks the app.
 * It needs the exact client id, so it comes after saving. */
export const workspaceStep = (clientID: string): Step => ({
  id: "workspace",
  title: txt.stepWorkspace,
  body: (
    <>
      <p>{txt.workspaceLead}</p>
      <div className="si-handoff" data-testid="gg-handoff">
        <p className="si-side">{txt.workspaceMsgTitle}</p>
        <div className="si-block">
          <pre className="si-cmd" data-testid="gg-handoff-msg">
            {txt.workspaceMsg(clientID)}
          </pre>
          <Copy
            value={txt.workspaceMsg(clientID)}
            label={txt.workspaceMsgTitle}
          />
        </div>
        <Val k="Client ID" v={clientID} />
      </div>
      <p className="si-quiet si-role">
        <Icon name="user" />
        <span>{txt.workspaceRole}</span>
      </p>
      <p className="si-effect">{txt.trustedNote}</p>
      <p className="si-quiet gg-inline">
        {txt.trustedWarning} <Unconfirmed />
      </p>
      <p className="si-quiet">{txt.workspaceLater}</p>
    </>
  ),
});

/** Saved is not tested: what to try, and on an existing client what to
 * check after the audience changed. */
export function readyStep(audience: Audience, existing?: boolean): Step {
  const list = existing
    ? audience === "personal"
      ? txt.readyExisting
      : []
    : audience === "personal"
      ? txt.readyPersonal
      : txt.readyOrg;
  return {
    id: "ready",
    title: txt.stepReady,
    body: (
      <>
        {!existing && (
          <p className="gg-ok" data-testid="gg-saved">
            <Icon name="info" />
            <span>{txt.savedNote}</span>
          </p>
        )}
        {existing && audience === "personal" && (
          <p className="si-warn gg-inline" data-testid="gg-migration">
            <Icon name="warning" />
            <span>{txt.migrationNote}</span> <Unconfirmed />
          </p>
        )}
        {existing && audience === "org" && (
          <p className="si-effect" data-testid="gg-org-already">
            {txt.orgAlready}
          </p>
        )}
        {list.length > 0 && (
          <ol className="gg-try" data-testid="gg-try">
            {list.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ol>
        )}
      </>
    ),
  };
}

/** The steps after Save in a new setup: the client id is certain only now. */
export const afterSaveSteps = (audience: Audience, clientID: string): Step[] =>
  audience === "personal"
    ? [workspaceStep(clientID), readyStep("personal")]
    : [readyStep("org")];

/** A guide whose steps are only read, with Back, Next and Done. */
export function ReadSteps({
  steps,
  at,
  onAt,
  onDone,
  canNext = true,
}: {
  steps: Step[];
  at: number;
  onAt: (n: number) => void;
  onDone: () => void;
  canNext?: boolean;
}) {
  const i = Math.min(at, steps.length - 1);
  const step = steps[i];
  const last = i === steps.length - 1;
  return (
    <>
      {steps.length > 1 && (
        <Progress ids={steps.map((s) => s.id)} at={i} title={step.title} />
      )}
      <div className="si-stepbody" data-testid={`si-step-${step.id}`}>
        {step.body}
      </div>
      <div className="si-foot">
        <span className="si-grow" />
        {i > 0 && (
          <ControlButton
            data-testid="si-back"
            size="row"
            variant="secondary"
            onPress={() => onAt(i - 1)}
          >
            {siTxt.back}
          </ControlButton>
        )}
        {last ? (
          <ControlButton
            data-testid="gg-done"
            size="page"
            variant="primary"
            onPress={onDone}
          >
            {txt.done}
          </ControlButton>
        ) : (
          <ControlButton
            data-testid="si-next"
            size="page"
            variant="primary"
            isDisabled={!canNext}
            onPress={() => onAt(i + 1)}
          >
            {siTxt.next}
          </ControlButton>
        )}
      </div>
    </>
  );
}

/** Kenen tilit…: an existing client's audience, from the row's menu. It
 * changes nothing in Habitat and asks for no new secret; the client and
 * every connection stay. */
export function GoogleAudienceDialog({
  clientID,
  onClose,
}: {
  clientID: string;
  onClose: () => void;
}) {
  const [audience, setAudience] = useState<Audience | null>(null);
  const [at, setAt] = useState(0);
  const choose: Step = {
    id: "audience",
    title: txt.stepAudience,
    body: <AudienceChoice value={audience} onChange={setAudience} existing />,
  };
  const steps: Step[] =
    audience === "org"
      ? [choose]
      : [
          choose,
          brandStep("personal"),
          publishStep(true),
          workspaceStep(clientID),
          readyStep("personal", true),
        ];
  return (
    <Modalish
      testId="gg-audience-dialog"
      title={txt.audienceTitle}
      size="wide"
      onClose={onClose}
    >
      <ReadSteps
        steps={steps}
        at={at}
        onAt={setAt}
        onDone={onClose}
        canNext={audience !== null}
      />
    </Modalish>
  );
}

export const audienceMenuLabel = () => txt.audienceMenu;
export const audienceStepTitle = () => txt.stepAudience;
export const chooseFirst = () => txt.chooseFirst;
