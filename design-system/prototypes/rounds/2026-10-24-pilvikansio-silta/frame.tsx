import type {ReactNode} from 'react';
import {Icon} from '../../../../web/src/components/Icon';
import styles from '../../../../web/src/components/OnboardingFrame.module.css';

// The production Kartta frame (web/src/components/OnboardingFrame.tsx) with
// the one change direction Aloitus proposes: an "Oma kone" step a site can add
// to the route like Google. The host is given, so the preview can name a site.
export type StepId = 'github'|'repositories'|'google'|'cloud'|'ai';
export type RouteStep = {id: StepId; skipped?: boolean; note?: string};
const labels: Record<StepId,string> = {github:'GitHub',repositories:'Repot',google:'Google',cloud:'Oma kone',ai:'AI-tili'};

export function OnboardingFrame({route,step,host,children}:{route:RouteStep[];step:StepId;host:string;children:ReactNode}){
 const at = route.findIndex(s=>s.id===step);
 return <div className={`ah-onboarding-frame ${styles.frame}`} data-step={step}>
  <div className={styles.identity}><strong>Open Habitat</strong><span aria-hidden="true" className={styles.divider}/><span className={styles.host}>{host}</span></div>
  <div className={styles.map}>
   <nav className={styles.route} aria-label="Käyttöönoton vaiheet"><p className={styles.kicker}>Oma reittisi</p>
    <ol data-testid="onboarding-steps">{route.map((s,i)=>{
     const state = i===at?'current':i<at?(s.skipped?'skipped':'done'):'next';
     return <li key={s.id} data-testid={`onboarding-step-${s.id}`} data-state={state} aria-current={state==='current'?'step':undefined}>
      <span className={styles.dot} aria-hidden="true">{state==='done'?<Icon name="check"/>:i+1}</span>
      <span className={styles.label}><strong>{labels[s.id]}</strong><small>{state==='current'?'Nyt':state==='next'?'Seuraavaksi':(s.note??(s.skipped?'Ohitettu':'Valmis'))}</small></span>
     </li>;})}</ol>
   </nav>
   <div className={styles.step}><div className={styles.card} data-testid="onboarding-card">{children}</div></div>
  </div>
 </div>;
}
