import {createContext, useContext, type ComponentProps} from 'react';
import {AttachmentChips as ProductionChips} from '../../../../web/src/components/AttachmentChips';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
export * from '../../../../web/src/components/AttachmentChips';

// The goal chip the round proposes, in the composer's chip row above the
// field. The production composer imports this module in place of its own
// AttachmentChips (build.mjs), so the field, Send and lists stay production.
export type GoalChip = {title: string; skill: string; open: boolean; onOpen: () => void; onRemove: () => void};
export const GoalChipContext = createContext<GoalChip | null>(null);

export function AttachmentChips(props: ComponentProps<typeof ProductionChips>) {
 const goal = useContext(GoalChipContext);
 return <>
  {goal ? <div className="g-chip-row" data-testid="goal-chip-row">
   <span className="g-chip" data-testid="goal-chip">
    <ControlButton size="row" variant="secondary" className="g-chip-open" data-testid="goal-chip-open" aria-expanded={goal.open} aria-label={`Tavoite: ${goal.title}. Näytä pyyntö`} title="Näytä agentille annettava pyyntö" onPress={goal.onOpen}>
     <span className="g-chip-mark" aria-hidden="true"><Icon name="run"/></span>
     <span className="g-chip-title">{goal.title}</span>
     <Icon name={goal.open ? 'down' : 'forward'}/>
    </ControlButton>
    <ControlButton size="row" variant="quiet" presentation="icon" className="g-chip-remove" data-testid="goal-chip-remove" aria-label={`Poista tavoite ${goal.title}`} title="Poista tavoite luonnoksesta" onPress={goal.onRemove}><Icon name="cross"/></ControlButton>
   </span>
  </div> : null}
  <ProductionChips {...props}/>
 </>;
}
