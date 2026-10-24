import {createContext, type ReactNode, useContext, useState} from 'react';
import {Icon} from '../../../../web/src/components/Icon';
import type {CloneRowView} from '../../../../web/src/components/ClonePage';
import styles from '../../../../web/src/components/OnboardingFrame.module.css';

// The production Kartta frame with the two changes this round proposes for it:
// a route row can carry background clones (the settled place for their
// progress, Jari r4), and the host comes from the owner instead of
// window.location, so a preview can name the site it previews. build.mjs points
// the production GitHubRepoChooser's own frame import here, so the chooser
// itself runs unchanged inside it.

export type OnboardingStepId = 'github'|'repositories'|'google'|'ai';
export type Cue = 'names'|'count'|'toggle';
export type ProtoRouteStep = {
 id: OnboardingStepId;
 skipped?: boolean;
 note?: string;
 /** A step the site does for the person; it is never the current step. */
 auto?: boolean;
 clones?: CloneRowView[];
};
type Route = {steps: ProtoRouteStep[]; cue: Cue; host: string};
const labels: Record<OnboardingStepId,string> = {github:'GitHub',repositories:'Repot',google:'Google',ai:'AI-tili'};
const RouteContext = createContext<Route>({steps:[{id:'github'},{id:'repositories'},{id:'ai'}],cue:'count',host:'habitat.example.test'});

export function OnboardingRoute({steps,cue='count',host='habitat.example.test',children}:{steps:ProtoRouteStep[];cue?:Cue;host?:string;children:ReactNode}){
 return <RouteContext.Provider value={{steps,cue,host}}>{children}</RouteContext.Provider>;
}

const stateText = (c: CloneRowView) => c.state==='running'?`${c.percent??0} %`:c.state==='waiting'?'jonossa':c.state==='failed'?'epäonnistui':'valmis';
export const cloneSummary = (clones: CloneRowView[]) => {
 const n = clones.length, done = clones.filter(c=>c.state==='confirmed'||c.state==='present').length;
 return {n, done, percent: Math.round(clones.reduce((s,c)=>s+(c.state==='running'?c.percent??0:c.state==='waiting'?0:100),0)/Math.max(1,n))};
};

function RouteClones({clones,cue}:{clones:CloneRowView[];cue:Cue}){
 const [open,setOpen] = useState(false);
 const s = cloneSummary(clones);
 // Spans, not a nested list: the production route styles every li under it as a step.
 const list = <span className="rt-clones" role="list" data-testid="route-clones">{clones.map(c=>{const [owner,name]=c.full_name.split('/');return <span role="listitem" key={c.full_name} data-testid="route-clone" data-state={c.state} title={c.full_name}><span className="rt-name"><span className="rt-owner">{owner}/</span>{name}</span><small>{stateText(c)}</small></span>;})}</span>;
 return <>
  <span className="rt-bar" role="progressbar" aria-label={`Repojen haku, ${s.done}/${s.n} valmiina`} aria-valuenow={s.percent} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${s.percent}%`}}/></span>
  {cue==='names'&&list}
  {cue==='toggle'&&<button type="button" className="rt-more" data-testid="route-clones-toggle" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?'Piilota repot':`Näytä ${s.n} ${s.n===1?'repo':'repoa'}`}</button>}
  {cue==='toggle'&&open&&list}
 </>;
}

export function OnboardingFrame({step,children,notice}:{step:OnboardingStepId;children:ReactNode;notice?:ReactNode}){
 const {steps,cue,host} = useContext(RouteContext);
 const at = steps.findIndex(s=>s.id===step);
 return <div className={`ah-onboarding-frame ${styles.frame}`} data-step={step}>
  <div className={styles.identity}><strong>Open Habitat</strong><span aria-hidden="true" className={styles.divider}/><span className={styles.host}>{host}</span></div>
  <div className={styles.map}>
   <nav className={styles.route} aria-label="Käyttöönoton vaiheet"><p className={styles.kicker}>Oma reittisi</p>
    <ol data-testid="onboarding-steps">{steps.map((s,i)=>{
     const state = s.auto?'auto':i===at?'current':i<at?(s.skipped?'skipped':'done'):'next';
     return <li key={s.id} className={s.clones?.length?'rt-has-clones':undefined} data-testid={`onboarding-step-${s.id}`} data-state={state} aria-current={state==='current'?'step':undefined}>
      <span className={styles.dot} aria-hidden="true">{state==='done'?<Icon name="check"/>:state==='auto'?<Icon name="refresh"/>:i+1}</span>
      <span className={styles.label}><strong>{labels[s.id]}</strong>
       <small data-testid={`route-note-${s.id}`}>{s.note??(state==='current'?'Nyt':state==='next'?'Seuraavaksi':s.skipped?'Ohitettu':'Valmis')}</small>
       {s.clones&&s.clones.length>0&&<RouteClones clones={s.clones} cue={cue}/>}
      </span>
     </li>;})}</ol>
   </nav>
   <div className={styles.step}><div className={styles.card} data-testid="onboarding-card">{children}</div>{notice}</div>
  </div>
 </div>;
}
