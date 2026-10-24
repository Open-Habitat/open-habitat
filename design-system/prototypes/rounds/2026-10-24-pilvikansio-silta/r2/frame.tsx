import type {ReactNode} from 'react';
import type {ProviderId} from '../../../../../web/src/app/integrations';
import {Icon} from '../../../../../web/src/components/Icon';
import {providerCopy} from '../../../../../web/src/components/Integrations';
import styles from '../../../../../web/src/components/OnboardingFrame.module.css';

// The production Kartta frame (web/src/components/OnboardingFrame.tsx, with
// its required marks and route details) plus the step this round proposes,
// "cloud" (Oma kone). Production's label() reads providerCopy for every
// unknown id, so the frame is mirrored here rather than imported.
export type StepId = 'github'|'repositories'|ProviderId|'cloud'|'ai';
export type RouteStep = {id: StepId; skipped?: boolean; required?: boolean; note?: string; next?: string; detail?: ReactNode};
const label = (id: StepId) => id==='github'?'GitHub':id==='repositories'?'Repot':id==='ai'?'AI-tili':id==='cloud'?'Oma kone':providerCopy[id].name;

export function OnboardingFrame({route,step,host,children}:{route:RouteStep[];step:StepId|'done';host:string;children:ReactNode}){
 const at = step==='done'?route.length:route.findIndex(s=>s.id===step);
 return <div className={`ah-onboarding-frame ${styles.frame}`} data-step={step}>
  <div className={styles.identity}><strong>Open Habitat</strong><span aria-hidden="true" className={styles.divider}/><span className={styles.host}>{host}</span></div>
  <div className={styles.map}>
   <nav className={styles.route} aria-label="Käyttöönoton vaiheet"><p className={styles.kicker}>Oma reittisi</p>
    <ol data-testid="onboarding-steps">{route.map((s,i)=>{
     const state = i===at?'current':i<at?(s.skipped?'skipped':'done'):'next';
     return <li key={s.id} data-testid={`onboarding-step-${s.id}`} data-state={state} data-required={s.required?'true':undefined} aria-current={state==='current'?'step':undefined}>
      <span className={styles.dot} aria-hidden="true">{state==='done'?<Icon name="check"/>:i+1}</span>
      <span className={styles.label}><strong>{label(s.id)}</strong>
       <small data-testid={`onboarding-note-${s.id}`}>{state==='current'?'Nyt':state==='next'?(s.next??(s.required?'Pakollinen':'Seuraavaksi')):(s.note??(s.skipped?'Ohitettu':'Valmis'))}</small>
       {s.detail}
      </span>
     </li>;})}</ol>
   </nav>
   <div className={styles.step}><div className={styles.card} data-testid="onboarding-card">{children}</div></div>
  </div>
 </div>;
}
