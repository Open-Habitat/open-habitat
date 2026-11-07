import type { CSSProperties, ReactNode } from "react";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { NumberStepper } from "./NumberStepper";
import "./ServerSection.css";

// The parts every Palvelimen ylläpito section is written from (Jari
// 7.11.2026, proto-server-sections-norm round 1, C Yhdistelmä): a lead above
// the card, cards of label–description–value rows, a thick meter with its
// figures beside the label, bounded numbers as steppers, and a list of
// people or services under a subheading in its own card, with column headers
// and each row's reading in its own column. A new server section, such as
// Levyt, is assembled from these rather than drawing its own.

type DataAttributes = { [key: `data-${string}`]: string | undefined };

/** The section: its parts stacked with the norm's spacing. */
export function ServerSection({
  testId,
  children,
}: {
  testId?: string;
  children: ReactNode;
}) {
  return (
    <div className="s-stack ah-server-section" data-testid={testId}>
      {children}
    </div>
  );
}

/** What the section is about, above its first card. */
export function SectionLead({
  testId,
  children,
}: {
  testId?: string;
  children: ReactNode;
}) {
  return (
    <p className="s-intro" data-testid={testId}>
      {children}
    </p>
  );
}

/** A group below the card, such as the people; `aside` holds a control
 * that acts on the whole group, such as a filter. */
export function SectionSubhead({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  if (!aside) return <h3 className="s-h3 ah-section-subhead">{children}</h3>;
  return (
    <div className="ah-section-subhead">
      <h3 className="s-h3">{children}</h3>
      {aside}
    </div>
  );
}

/** A card of rows. */
export function SectionCard({
  testId,
  row,
  children,
}: {
  testId?: string;
  /** The settings search target, when the whole card is one setting. */
  row?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="s-card ah-administration"
      data-testid={testId}
      data-settings-row={row}
      tabIndex={row ? -1 : undefined}
    >
      {children}
    </div>
  );
}

/** One setting: its name and description, its value or control on the right. */
export function SectionRow({
  label,
  description,
  row,
  testId,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  row?: string;
  testId?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="s-row"
      data-settings-row={row}
      data-testid={testId}
      tabIndex={row ? -1 : undefined}
    >
      <div className="s-lbl">
        <strong>{label}</strong>
        {description ? <span className="s-desc">{description}</span> : null}
      </div>
      {children ? <div className="s-val">{children}</div> : null}
    </div>
  );
}

/** A bounded whole number as a stepper row. */
export function SectionNumber({
  label,
  description,
  row,
  testId,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  onChange,
}: {
  label: string;
  description?: ReactNode;
  row?: string;
  testId?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <SectionRow label={label} description={description} row={row}>
      <NumberStepper
        label={label}
        testId={testId}
        value={value}
        min={min}
        max={max}
        step={step}
        unit={unit}
        disabled={disabled}
        onChange={onChange}
      />
    </SectionRow>
  );
}

type MeterPart = { label: string; value: ReactNode; testId?: string };

/** A measured whole: its figures beside the label, a thick bar of what is
 * used now over what the limits could take, and the legend below. Without
 * a known whole there is no bar, only the legend. */
export function SectionMeter({
  label,
  description,
  figure,
  total,
  meterLabel,
  now,
  worst,
  over,
  overTestId,
  row,
  testId,
  ...data
}: {
  label: string;
  description?: ReactNode;
  /** The whole in words, such as 32 GiB in total · 21 GiB free. */
  figure?: string;
  total?: number;
  meterLabel?: string;
  now?: MeterPart & { amount: number };
  worst?: MeterPart & { amount?: number };
  /** Said with a warning when the limits together exceed the whole. */
  over?: ReactNode;
  overTestId?: string;
  row?: string;
  testId?: string;
} & DataAttributes) {
  const share = (n: number) =>
    total ? `${Math.min(100, (100 * n) / total)}%` : "0%";
  const exceeded = over ? "" : undefined;
  return (
    <div
      className="s-row ah-meter-row"
      data-settings-row={row}
      data-testid={testId}
      tabIndex={row ? -1 : undefined}
      {...data}
    >
      <div className="ah-meter-head">
        <div className="s-lbl">
          <strong>{label}</strong>
          {description ? <span className="s-desc">{description}</span> : null}
        </div>
        {figure ? <span className="ah-meter-figure">{figure}</span> : null}
      </div>
      {total ? (
        <div className="ah-meter" role="img" aria-label={meterLabel}>
          {worst?.amount !== undefined ? (
            <span
              className="ah-meter-worst"
              data-over={exceeded}
              style={{ width: share(worst.amount) }}
            />
          ) : null}
          {now ? (
            <span
              className="ah-meter-now"
              style={{ width: share(now.amount) }}
            />
          ) : null}
        </div>
      ) : null}
      {now || worst ? (
        <dl className="ah-meter-legend">
          {now ? (
            <div data-testid={now.testId}>
              <dt>
                <span className="ah-meter-key ah-meter-key-now" />
                {now.label}
              </dt>
              <dd>{now.value}</dd>
            </div>
          ) : null}
          {worst ? (
            <div data-testid={worst.testId}>
              <dt>
                <span
                  className="ah-meter-key ah-meter-key-worst"
                  data-over={exceeded}
                />
                {worst.label}
              </dt>
              <dd>{worst.value}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {over ? (
        <p className="ah-meter-over" data-testid={overTestId}>
          <Icon name="warning" />
          {over}
        </p>
      ) : null}
    </div>
  );
}

/** A list of people or services under column headers: the name first, then
 * each row's readings and controls in their own columns, and the row's
 * actions at the end. Narrow, the last column stays beside the name and the
 * rest go below it. */
export function PeopleList({
  columns,
  compact,
  actions,
  row,
  testId,
  children,
}: {
  /** The name column's header, then one per reading column. */
  columns: [string, string, ...string[]];
  /** One short reading and at most a short action: one line fits a
   * narrower pane. */
  compact?: boolean;
  /** The rows end in actions, which stay beside the name longer than the
   * readings do. */
  actions?: boolean;
  row?: string;
  testId?: string;
  children: ReactNode;
}) {
  const [name, ...cells] = columns;
  return (
    <ul
      className="ah-people"
      data-compact={compact ? "" : undefined}
      data-actions={actions ? "" : undefined}
      data-testid={testId}
      data-settings-row={row}
      tabIndex={row ? -1 : undefined}
      style={{ "--ah-people-cells": cells.length } as CSSProperties}
    >
      {/* The headers are for the eye; every control names its person. */}
      <li className="ah-people-head" aria-hidden="true">
        <span>{name}</span>
        {cells.map((c) => (
          <span key={c}>{c}</span>
        ))}
        <span />
      </li>
      {children}
    </ul>
  );
}

/** One row of a PeopleList. `cells` must match the list's reading columns. */
export function PeopleRow({
  name,
  detail,
  mark,
  cells,
  end,
  indent,
  row,
  testId,
  className,
  ...data
}: {
  name: ReactNode;
  detail?: ReactNode;
  /** A tile before the name, such as a service's letter. */
  mark?: ReactNode;
  cells: ReactNode[];
  end?: ReactNode;
  /** A row that belongs to the one above it. */
  indent?: boolean;
  /** The settings search target, when the row is one setting. */
  row?: string;
  testId?: string;
  className?: string;
} & DataAttributes) {
  return (
    <li
      className={className ? `ah-people-row ${className}` : "ah-people-row"}
      data-testid={testId}
      data-indent={indent ? "" : undefined}
      data-mark={mark ? "" : undefined}
      data-settings-row={row}
      tabIndex={row ? -1 : undefined}
      {...data}
    >
      <span className="ah-people-who">
        {mark ? <span className="ah-people-mark">{mark}</span> : null}
        <span className="ah-people-person">
          <span className="ah-people-name">{name}</span>
          {detail}
        </span>
      </span>
      {cells.map((cell, i) => (
        <span
          // The columns are fixed by the list, so their order is the key.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above.
          key={i}
          className="ah-people-cell"
          data-beside={i === cells.length - 1 ? "" : undefined}
        >
          {cell}
        </span>
      ))}
      {end ? <span className="ah-people-end">{end}</span> : null}
    </li>
  );
}

/** A person's use of their limit: the figure and a thin bar under it. */
export function UsageFigure({
  used,
  limit,
  text,
  testId,
}: {
  used: number;
  limit: number;
  /** The use in words, such as 14,2 GiB / 40 GiB. */
  text: string;
  testId?: string;
}) {
  return (
    <span className="ah-usage" data-testid={testId}>
      <span className="ah-usage-value">{text}</span>
      <span className="s-bar" role="img" aria-label={text}>
        <span
          style={{
            width: `${limit ? Math.min(100, (100 * used) / limit) : 0}%`,
          }}
        />
      </span>
    </span>
  );
}

/** A person's limit control with its reset beside it (Jari 7.11.2026,
 * proto-limit-reset-placement round 1, A Säädin): a small restore icon right
 * of the stepper while the person has an own limit, and the same empty space
 * when they do not, so the steppers stay in one column and every row keeps
 * the same height. The icon names the default it restores to. */
export function LimitReset({
  own,
  label,
  name,
  disabled,
  testId,
  onPress,
  children,
}: {
  own: boolean;
  /** What the reset does, with the default value: the tooltip. */
  label: string;
  /** The same for this person: the accessible name. */
  name: string;
  disabled?: boolean;
  testId?: string;
  onPress: () => void;
  /** The limit's own control, normally a NumberStepper. */
  children?: ReactNode;
}) {
  return (
    <span className="ah-limit">
      {children}
      {own ? (
        <ControlButton
          data-testid={testId}
          size="row"
          variant="quiet"
          title={label}
          aria-label={name}
          isDisabled={disabled}
          onPress={onPress}
        >
          <Icon name="restore" />
        </ControlButton>
      ) : (
        <span className="ah-limit-gap" aria-hidden="true" />
      )}
    </span>
  );
}

/** What the section's writes are doing: saving, or why the last one failed. */
export function SectionStatus({
  testId,
  children,
}: {
  testId?: string;
  children?: ReactNode;
}) {
  return (
    <p className="ah-section-status" role="status" data-testid={testId}>
      {children}
    </p>
  );
}
