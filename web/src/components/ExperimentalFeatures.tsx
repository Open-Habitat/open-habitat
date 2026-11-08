import type { ReactNode } from "react";
import { ControlButton, Segmented } from "./ControlElements";
import "./ExperimentalFeatures.css";
import { liveText } from "../i18n";
import { experimentalFeaturesText } from "../text/experimentalFeatures";

const txt = liveText(experimentalFeaturesText);

/** What a feature's card says. `landed` is false until the feature itself
 * is in the product; its issue sets it when it lands, and until then the
 * card says the choice waits for it. */
export type ExperimentalFeature = {
  id: string;
  name: string;
  desc: string;
  where: string;
  shows: string;
  needs: string;
  caption: string;
  landed: boolean;
};

const featureIds = [
  { id: "markdown-block-preview", landed: true },
  { id: "worker-row-sentence", landed: true },
  { id: "raise-to-your-turn", landed: true },
  { id: "composer-lists-in-field", landed: true },
  { id: "rewind-conversation", landed: true },
  { id: "explain-mode", landed: true },
  { id: "agent-resources-view", landed: true },
  { id: "conversation-context-view", landed: true },
  { id: "named-workers", landed: true },
  { id: "remote-browser", landed: true },
] as const satisfies readonly {
  id: keyof typeof txt.features;
  landed: boolean;
}[];

/** Every feature's card in the current language. */
export function experimentalFeatureCards(): readonly ExperimentalFeature[] {
  return featureIds.map(({ id, landed }) => ({
    id,
    landed,
    ...txt.features[id],
  }));
}

/** A small drawing of what the feature adds, grey while it is off. It is
 * decoration: the facts beside it say the same in words. */
function Picture({ id, on }: { id: string; on: boolean }) {
  let body: ReactNode;
  if (
    id === "markdown-block-preview" ||
    id === "rewind-conversation" ||
    id === "explain-mode" ||
    id === "agent-resources-view" ||
    id === "conversation-context-view" ||
    id === "named-workers"
  )
    body = (
      <>
        <span className="ex-ghost" />
        <b>{txt.features[id].caption}</b>
        <span className="ex-ghost" />
        <span className="ex-ghost" style={{ width: "70%" }} />
      </>
    );
  else if (id === "remote-browser")
    body = (
      <>
        <span className="ex-ghost" style={{ width: "80%" }} />
        <span className="ex-browser">
          <span className="ex-browser-pic" data-ask="" />
          <span className="ex-browser-pic" />
          <span className="ex-browser-pic" />
        </span>
        <span className="ex-composer ex-crow">
          <span className="ex-turn">◍ {txt.picture.browser}</span>
          <span>{txt.picture.browserWaits}</span>
        </span>
      </>
    );
  else if (id === "raise-to-your-turn")
    body = (
      <>
        <span className="ex-ghost ex-ghost-own" />
        <span className="ex-ghost" style={{ width: "80%" }} />
        <span className="ex-ghost" style={{ width: "55%" }} />
        <span className="ex-composer ex-crow">
          <span>{txt.picture.composer}</span>
          <span className="ex-turn">⤒ {txt.picture.raise}</span>
          <span className="ex-send" />
        </span>
      </>
    );
  else if (id === "composer-lists-in-field")
    body = (
      <span className="ex-composer ex-field">
        <span className="ex-ghost" style={{ width: "75%" }} />
        <span className="ex-field-list">
          {[
            ["›", "src/", "2"],
            ["", "shadow.py", "M"],
            ["", "README.md", ""],
          ].map(([twist, name, mark]) => (
            <span
              key={name}
              className="ex-irow"
              data-open={!!twist || undefined}
            >
              <span className="ex-check" />
              <span>{twist}</span>
              <b>{name}</b>
              <span>{mark}</span>
            </span>
          ))}
        </span>
        <span>{txt.picture.composer}</span>
      </span>
    );
  else
    body = (
      <>
        <span className="ex-wrow">
          <span className="ex-dot" />
          <span className="ex-lines">
            <span className="ex-l1">
              <b>{txt.picture.weather}</b>
              <span>{txt.picture.minutes(18)}</span>
            </span>
            <span className="ex-l2">
              <span className="ex-state">{txt.picture.agentWaits}</span> ·{" "}
              <span className="ex-hl">{txt.picture.commits}</span>
            </span>
          </span>
        </span>
        <span className="ex-wrow">
          <span className="ex-ring" />
          <span className="ex-lines">
            <span className="ex-l1">
              <b>{txt.picture.oldApi}</b>
              <span>{txt.picture.minutes(2)}</span>
            </span>
            <span className="ex-l2">
              {txt.picture.agentNotWaiting} ·{" "}
              <span className="ex-hl">{txt.picture.noChanges}</span>
            </span>
          </span>
        </span>
      </>
    );
  return (
    <div className="ex-pic" data-off={on ? undefined : ""} aria-hidden="true">
      {body}
    </div>
  );
}

/** Kokeelliset ominaisuudet: one card per feature with a picture, where it
 * appears, what it shows and what it needs, and its switch. Off by default;
 * a choice shows only once the daemon has confirmed it. */
export function ExperimentalFeaturesControl({
  enabled,
  disabled,
  busy,
  error,
  onChange,
  onReload,
  features = experimentalFeatureCards(),
}: {
  enabled: (id: string) => boolean;
  /** No switch can be used: not yet read, or a write is in flight. */
  disabled: boolean;
  /** The feature whose write is in flight. */
  busy?: string;
  /** "read", or the feature whose write failed. */
  error?: string;
  onChange: (id: string, on: boolean) => void;
  onReload?: () => void;
  features?: readonly ExperimentalFeature[];
}) {
  const alert = (testId: string, text: string) => (
    <div className="s-row ex-alert">
      <p role="alert" data-testid={testId}>
        {text}
      </p>
      {onReload && (
        <ControlButton
          data-testid={`${testId}-reload`}
          size="row"
          onPress={onReload}
          isDisabled={!!busy}
        >
          {txt.reload}
        </ControlButton>
      )}
    </div>
  );
  return (
    <div className="s-stack" data-testid="experimental-features">
      <p className="s-intro">{txt.intro}</p>
      {error === "read" && (
        <div className="s-card">
          {alert("experimental-read-error", txt.readError)}
        </div>
      )}
      {features.map((f) => {
        const on = enabled(f.id);
        return (
          <section
            key={f.id}
            className="ex-card"
            data-settings-row={f.id}
            data-testid={`experimental-${f.id}`}
            tabIndex={-1}
            aria-label={f.name}
            aria-busy={busy === f.id || undefined}
          >
            <div className="s-row">
              <div className="s-lbl">
                <strong>{f.name}</strong>
                <span className="s-desc">{f.desc}</span>
              </div>
              <div className="s-val">
                <Segmented
                  size="row"
                  data-testid={`experimental-${f.id}-choice`}
                  label={f.name}
                  options={[
                    { id: "off", label: txt.off },
                    { id: "on", label: txt.on },
                  ]}
                  value={on ? "on" : "off"}
                  isDisabled={disabled}
                  onChange={(v) => {
                    if ((v === "on") !== on) onChange(f.id, v === "on");
                  }}
                />
              </div>
            </div>
            {error === f.id &&
              alert(`experimental-${f.id}-error`, txt.writeError)}
            <div className="ex-body">
              <figure className="ex-figure">
                <figcaption>{f.caption}</figcaption>
                <Picture id={f.id} on={on} />
              </figure>
              <dl className="ex-facts">
                <div>
                  <dt>{txt.where}</dt>
                  <dd>{f.where}</dd>
                </div>
                <div>
                  <dt>{txt.shows}</dt>
                  <dd>{f.shows}</dd>
                </div>
                <div>
                  <dt>{txt.needs}</dt>
                  <dd>{f.needs}</dd>
                </div>
              </dl>
            </div>
            {!f.landed && (
              <p
                className="ex-coming"
                data-testid={`experimental-${f.id}-coming`}
              >
                {txt.coming}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
