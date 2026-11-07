import {isValidElement, type ComponentProps} from 'react';
import * as Real from '../../../../web/src/components/ServerSection';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {Menu} from '../../../../web/src/components/Overlays';
export * from '../../../../web/src/components/ServerSection';

// build.mjs points production ServerStorage and ServerConversations at this
// module instead of components/ServerSection, so both sections run
// unchanged against the host stand-in. Only PeopleRow differs: when its
// `end` is the LimitReset production hands it, the direction decides where
// that reset goes. Today passes the row through untouched.
export type Place = 'nyt' | 'a' | 'b' | 'c';
export const PLACE = {current: 'nyt' as Place};

type Row = ComponentProps<typeof Real.PeopleRow>;
type Reset = ComponentProps<typeof Real.LimitReset>;

export function PeopleRow(props: Row) {
  const end = props.end;
  const place = PLACE.current;
  if (place === 'nyt' || !isValidElement<Reset>(end) || end.type !== Real.LimitReset) return <Real.PeopleRow {...props} />;
  const r = end.props;
  const who = String(props.name);
  const cells = [...props.cells];
  const last = cells.length - 1;
  if (place === 'a') {
    // A: a small restore icon right after the stepper. Rows without an own
    // limit keep the same gap there, so the steppers stay in one column.
    if (cells[last] != null)
      cells[last] = (
        <span className="rq-a-limit">
          {cells[last]}
          {r.own ? (
            <ControlButton size="row" variant="quiet" aria-label={`${r.label}: ${who}`} data-testid={r.testId} isDisabled={r.disabled} onPress={r.onPress}>
              <Icon name="restore" />
            </ControlButton>
          ) : <span className="rq-a-gap" aria-hidden="true" />}
        </span>
      );
    return <Real.PeopleRow {...props} cells={cells} end={undefined} />;
  }
  if (place === 'b') {
    // B: the row's own line under the name, which every row already has,
    // says "oma raja · Oletukseen" with Oletukseen as a link.
    const said = isValidElement<{children?: unknown}>(props.detail) ? props.detail.props.children : null;
    const detail = r.own && said != null ? (
      <span className="s-desc rq-b-detail">
        {String(said)} · <button type="button" className="rq-b-link" aria-label={`${r.label}: ${who}`} data-testid={r.testId} disabled={r.disabled} onClick={r.onPress}>{r.label}</button>
      </span>
    ) : props.detail;
    return <Real.PeopleRow {...props} detail={detail} end={undefined} />;
  }
  // C: every row ends in the same … menu; resetting is its item, unavailable
  // while the person already follows the default.
  return (
    <Real.PeopleRow
      {...props}
      end={
        <Menu
          label={`Raja: ${who}`}
          triggerLabel={`Rajan toiminnot: ${who}`}
          triggerPresentation="icon"
          triggerClassName="rq-c-trigger"
          trigger={<Icon name="more" />}
          triggerTestId={`${r.testId}-menu`}
          placement="bottom end"
          items={[{
            id: 'reset',
            label: 'Palauta oletusrajaan',
            availability: r.own ? undefined : {state: 'disabled', reason: 'Käyttää jo oletusta'},
          }]}
          onAction={() => r.onPress()}
        />
      }
    />
  );
}
