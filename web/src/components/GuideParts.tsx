import type { ReactNode } from "react";
import { useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { liveText } from "../i18n";
import { serverIntegrationsText } from "../text/serverIntegrations";
import { ControlButton, ExternalLink } from "./ControlElements";
import { Icon } from "./Icon";

// The pieces every server-integration console guide is built from
// (ServerIntegrations.tsx, GoogleGuide.tsx): a value to type with its copy
// button, the console's path with a link, the dialog frame and the step
// progress. Their .si-* rules are in ServerIntegrations.css.
const txt = liveText(serverIntegrationsText);

export function Copy({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <ControlButton
      data-testid="si-copy"
      size="row"
      variant="quiet"
      aria-label={txt.copy(label)}
      onPress={() => {
        void navigator.clipboard?.writeText(value).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      <Icon name={done ? "check" : "copy"} />
    </ControlButton>
  );
}

/** A value the administrator types into the provider's console. */
export const Val = ({
  k,
  v,
  copy = true,
}: {
  k: string;
  v: string;
  copy?: boolean;
}) => (
  <div className="si-val">
    <span className="si-k">{k}</span>
    <code>{v}</code>
    {copy && <Copy value={v} label={k} />}
  </div>
);
/** Where in the console, in the console's own (English) words, and a
 * direct link to that page. `pick` says what to choose when the link can
 * only open the list the page is under. */
export const Path = ({
  p,
  href,
  pick,
}: {
  p: string;
  href?: string;
  pick?: ReactNode;
}) => (
  <div className="si-where">
    <p className="si-path">
      <Icon name="forward" />
      <span>{p}</span>
    </p>
    {href && (
      <p className="si-open">
        <ExternalLink
          href={href}
          target="_blank"
          rel="noreferrer"
          data-testid="si-console-link"
        >
          {txt.openPage} <Icon name="external" />
        </ExternalLink>
        {pick && <span className="si-quiet">{pick}</span>}
      </p>
    )}
  </div>
);

export function Modalish({
  testId,
  title,
  size,
  dismissable = true,
  onClose,
  children,
}: {
  testId: string;
  title: string;
  /** wide: a guide; split: a guide step beside its values. */
  size?: "wide" | "split";
  dismissable?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen
      isDismissable={dismissable}
      onOpenChange={(open) => !open && onClose()}
    >
      <Modal className={`ah-modal si-modal${size ? ` si-${size}` : ""}`}>
        <Dialog
          className="ah-dialog si-dialog"
          data-testid={testId}
          aria-label={title}
        >
          <Heading slot="title">{title}</Heading>
          {children}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Who can do a step: the Entra role it needs, or whose account owns it. */
export const Role = ({ children }: { children: ReactNode }) => (
  <p className="si-quiet si-role" data-testid="si-role">
    <Icon name="user" />
    <span>{children}</span>
  </p>
);

/** A guide step. The last one is also where the console's values are
 * typed: `console` names the side done there, `values` says where the
 * console shows them. */
export type Step = {
  id: string;
  title: string;
  body: ReactNode;
  console?: string;
  values?: ReactNode;
};

/** The guide's progress bar and the current step's name. */
export function Progress({
  ids,
  at,
  title,
}: {
  ids: string[];
  at: number;
  title: ReactNode;
}) {
  return (
    <>
      <div
        className="si-progress"
        data-testid="si-progress"
        role="img"
        aria-label={txt.stepOf(at + 1, ids.length)}
      >
        {ids.map((id, j) => (
          <span
            key={id}
            data-done={j < at || undefined}
            data-current={j === at || undefined}
          />
        ))}
      </div>
      <p className="si-stepname" data-testid="si-stepname" data-step={ids[at]}>
        <span className="si-muted">
          {at + 1}/{ids.length}
        </span>{" "}
        {title}
      </p>
    </>
  );
}
