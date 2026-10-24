import React, {type ReactNode, useEffect, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import pickerSource from '../../../lib/picker.js?raw';
import '../../../lib/picker.css';
import {ControlButton as Button, Segmented} from '../../../../../web/src/components/ControlElements';
import {Icon} from '../../../../../web/src/components/Icon';
import {IntegrationsOverview, ProviderMark} from '../../../../../web/src/components/Integrations';
import {AssistantMessage, UserMessage} from '../../../../../web/src/components/Conversation';
import {Markdown} from '../../../../../web/src/components/Markdown';
import type {Account, IntegrationList, Provider} from '../../../../../web/src/app/integrations';
import {OnboardingFrame, type RouteStep, type StepId} from './frame';
import {type Cloud, HowTo, cloudGen, cloudName, folder, person} from '../bridge';
import '../../../../../design-system/styles.css';
import '../../../../../web/src/components/components.css';
import '../../../../../web/src/components/Settings.css';
import '../../../../../web/src/components/Integrations.css';
import '../../../../../web/src/components/OnboardingSettings.css';
import '../round.css';
import './round.css';

// Round 2: the onboarding step that asks "Onko sinulla henkilökohtainen
// Dropbox tai OneDrive?" (Jari 2026-10-24). Three directions differ in how
// the answers flow, where the step sits, whether the site configures it and
// what the route shows when the person already connected OneDrive in the
// site's Microsoft 365 step. Production components, synthetic data.
const directions = ['Kolme vastausta','Kyllä / Ei','Lopuksi'];
const axes = [
 'Yksi kortti ennen AI-tiliä. Vastaukset Dropbox, OneDrive ja Ei ole; yhdistäminen, kansio koneelle ja kokeilu samalla kortilla. Kysytään aina, kun palvelimella on Dropbox tai OneDrive. Jo yhdistetylle vaihetta ei ole.',
 'Sivuston lisäämä vaihe kuten integraatiot. Kyllä kasvattaa reitin kolmeksi alavaiheeksi (Yhdistä, Koneellesi, Kokeile). Jo yhdistetyllä vaihe näkyy reitillä valmiina, eikä siinä pysähdytä.',
 'Viimeinen, valinnainen vaihe AI-tilin jälkeen: silta kokeillaan agentin kanssa. Sivusto voi kytkeä kysymyksen pois. Jo yhdistetyltä ei kysytä, mutta kansio koneelle ja kokeilu tarjotaan.',
];
const noop = () => {};
const host = 'habitat.example.test';
let reviewTheme = 'light', reviewPhone = false, reviewScenario: Scenario = 'none', reviewView: View = 'person';
type Scenario = 'none'|'onedrive';
type View = 'person'|'admin';

const checked = '2026-10-24T07:43:00Z';
const providers: Record<Cloud,Provider> = {
 dropbox:{id:'dropbox',available:true,login:'pasted_redirect',services:['dropbox']},
 microsoft:{id:'microsoft',available:true,login:'device_code',services:['mail','calendar','contacts','onedrive']},
};
const account = (c: Cloud): Account => c==='dropbox'
 ? {provider:'dropbox',address:person,checked_at:checked,services:[{id:'dropbox',state:'ok',directory:`~/cloud/dropbox/${person}`}]}
 : {provider:'microsoft',address:person,checked_at:checked,services:[{id:'mail',state:'ok'},{id:'calendar',state:'ok'},{id:'contacts',state:'ok'},{id:'onedrive',state:'ok',directory:`~/cloud/onedrive/${person}`}]};
const newest = 'Näyttökuva 2026-10-24 10.41.png';

type Review = {scenario: Scenario; leave: (where: string) => void};

// ---------- Pieces every direction uses ----------

/** The existing integration onboarding for one provider: production's compact
 * Integraatiot list. Connecting is simulated; the real step opens the
 * production sign-in dialog here. */
function Connect({cloud,connected,onConnected}:{cloud:Cloud;connected:boolean;onConnected:()=>void}){
 const [busy,setBusy] = useState(false);
 const list: IntegrationList = {schema_version:1,skill:'current',providers:[providers[cloud]],accounts:connected?[account(cloud)]:[]};
 return <div className="hb-connect-step" data-testid="connect" data-connected={connected}>
  {busy?<p className="hb-wait" role="status" data-testid="connecting"><span className="ig-spin" aria-hidden="true"/>Kirjaudutaan {cloud==='dropbox'?'Dropboxiin':'Microsoftiin'}…</p>
   :<IntegrationsOverview list={list} compact checking={new Set()} onCheck={noop} onConnect={()=>{setBusy(true);setTimeout(()=>{setBusy(false);onConnected();},600);}} onSignInAgain={noop} onRemove={noop}/>}
 </div>;
}

/** Waits for a file to appear in the folder; the button stands in for it. */
function Try({cloud,arrived,onArrived,children}:{cloud:Cloud;arrived:boolean;onArrived:()=>void;children?:ReactNode}){
 return <div className="hb-try" data-testid="try" data-arrived={arrived}>
  {arrived?<p className="hb-ok" role="status" data-testid="arrived"><Icon name="check"/><span><b>{newest}</b> tuli kansioon.</span></p>
   :<>
    <p>Tallenna koneellasi jokin tiedosto kansioon <b>{cloudName[cloud]} › {folder}</b>.</p>
    <p className="hb-wait" role="status"><span className="ig-spin" aria-hidden="true"/>Odotetaan tiedostoa…</p>
    <div className="proto-sim"><span>Prototyyppi</span><Button size="row" variant="quiet" data-testid="simulate-arrival" onPress={onArrived}>Tiedosto saapuu</Button></div>
   </>}
  {arrived&&children}
 </div>;
}

const Answer = ({id,cloud,children,onPress,current}:{id:string;cloud?:Cloud;children:ReactNode;onPress:()=>void;current?:boolean}) =>
 <Button data-testid={`answer-${id}`} size="row" variant={current?'primary':'secondary'} aria-pressed={current} onPress={onPress}>{cloud&&<ProviderMark provider={cloud} small/>}{children}</Button>;

function Header({title,lede}:{title:string;lede?:ReactNode}){
 return <header><p className="ah-eyebrow">Käyttöönotto</p><h1 id="step-title" data-testid="step-title" tabIndex={-1}>{title}</h1>{lede&&<p>{lede}</p>}</header>;
}

/** Where a step this round does not cover would be: the route stays visible. */
function Elsewhere({title,children,onBack}:{title:string;children?:ReactNode;onBack:()=>void}){
 return <section className="ah-onboarding-step hb-step" data-testid="elsewhere" aria-labelledby="step-title">
  <Header title={title}/>
  {children}
  <p className="proto-note">Ei tämän kierroksen aihe.</p>
  <div className="ah-onboarding-actions"><Button data-testid="elsewhere-back" size="page" variant="quiet" onPress={onBack}>Takaisin</Button></div>
 </section>;
}

const github: RouteStep = {id:'github',note:'Kirjautunut'};
const repos: RouteStep = {id:'repositories',note:'3 repoa'};
const ms = (s: Scenario): RouteStep => ({id:'microsoft',skipped:s==='none',note:s==='none'?'Ohitettu':'Yhdistetty'});

// ---------- Direction 1: Kolme vastausta ----------

type Answer1 = Cloud|'no'|null;
function Three({r}:{r:Review}){
 const asked = r.scenario==='none';
 const [answer,setAnswer] = useState<Answer1>(null);
 const [connected,setConnected] = useState(false);
 const [arrived,setArrived] = useState(false);
 const [at,setAt] = useState<StepId>(asked?'cloud':'ai');
 const cloudNote = answer==='no'?'Ei pilveä':answer&&connected?`${cloudName[answer]}${arrived?' · kokeiltu':''}`:undefined;
 const route: RouteStep[] = [github,repos,ms(r.scenario),...(asked?[{id:'cloud' as const,skipped:answer!=='dropbox'&&answer!=='microsoft'||!connected,note:cloudNote}]:[]),{id:'ai'}];
 const pick = (a: Answer1) => {setAnswer(a);setConnected(false);setArrived(false);};
 const ready = answer==='no'||(answer!==null&&connected);
 return <OnboardingFrame route={route} step={at} host={host}>
  {at==='ai'?<Elsewhere title="AI-tili" onBack={()=>asked?setAt('cloud'):r.leave('Takaisin Microsoft 365 -vaiheeseen.')}>
   {!asked&&<p className="proto-note" data-testid="not-asked">Oma kone -vaihetta ei ole: OneDrive yhdistettiin Microsoft 365 -vaiheessa.</p>}
  </Elsewhere>
  :<section className="ah-onboarding-step hb-step" data-testid="cloud-step" aria-labelledby="step-title">
   <Header title="Onko sinulla henkilökohtainen Dropbox tai OneDrive?" lede="Sen kansio on silta koneesi ja agentin välillä."/>
   <div className="hb-answers" role="group" aria-label="Vastaus">
    <Answer id="dropbox" cloud="dropbox" current={answer==='dropbox'} onPress={()=>pick('dropbox')}>Dropbox</Answer>
    <Answer id="microsoft" cloud="microsoft" current={answer==='microsoft'} onPress={()=>pick('microsoft')}>OneDrive</Answer>
    <Answer id="no" current={answer==='no'} onPress={()=>pick('no')}>Ei ole</Answer>
   </div>
   {answer==='no'&&<p className="hb-later" data-testid="later">Voit yhdistää sen myöhemmin: Asetukset › Integraatiot.</p>}
   {(answer==='dropbox'||answer==='microsoft')&&<>
    <Connect key={answer} cloud={answer} connected={connected} onConnected={()=>setConnected(true)}/>
    {connected&&<>
     <div className="hb-block"><h2>Avaa kansio koneellasi</h2><HowTo cloud={answer}/></div>
     <div className="hb-block"><h2>Kokeile</h2><Try cloud={answer} arrived={arrived} onArrived={()=>setArrived(true)}/></div>
    </>}
   </>}
   <div className="ah-onboarding-actions">
    <Button data-testid="step-back" size="page" variant="quiet" onPress={()=>r.leave('Takaisin Microsoft 365 -vaiheeseen.')}>Takaisin</Button>
    {ready&&<Button data-testid="step-continue" size="page" variant={answer==='no'||arrived?'primary':'secondary'} onPress={()=>setAt('ai')}>{answer!=='no'&&!arrived?'Jatka kokeilematta':'Jatka'}</Button>}
   </div>
  </section>}
 </OnboardingFrame>;
}

// ---------- Direction 2: Kyllä / Ei ----------

type Sub = 'connect'|'computer'|'try';
const subs: {id:Sub;label:(c:Cloud)=>string}[] = [
 {id:'connect',label:c=>`Yhdistä ${cloudName[c]}`},
 {id:'computer',label:()=>'Koneellesi'},
 {id:'try',label:()=>'Kokeile'},
];
function SubRoute({cloud,at,done}:{cloud:Cloud;at:Sub|null;done:Set<Sub>}){
 const i = at?subs.findIndex(s=>s.id===at):subs.length;
 return <ol className="hb-sub" data-testid="sub-route">{subs.map((s,n)=><li key={s.id} data-testid={`sub-route-${s.id}`} data-state={n===i?'current':done.has(s.id)?'done':n<i?'skipped':'next'}>
  <span aria-hidden="true">{done.has(s.id)?<Icon name="check"/>:'·'}</span>{s.label(cloud)}
 </li>)}</ol>;
}
function YesNo({r}:{r:Review}){
 const already = r.scenario==='onedrive';
 const [phase,setPhase] = useState<'ask'|'which'|Sub|'ai'>(already?'ai':'ask');
 const [answer,setAnswer] = useState<Cloud|'no'|null>(null);
 const [connected,setConnected] = useState(false);
 const [arrived,setArrived] = useState(false);
 const cloud: Cloud = answer==='microsoft'?'microsoft':'dropbox';
 const yes = answer==='dropbox'||answer==='microsoft';
 const done = new Set<Sub>([...(connected?['connect' as Sub]:[]),...(yes&&(phase==='try'||phase==='ai')?['computer' as Sub]:[]),...(arrived?['try' as Sub]:[])]);
 const inSub = phase==='connect'||phase==='computer'||phase==='try';
 const cloudStep: RouteStep = already
  ?{id:'cloud',note:'OneDrive · yhdistetty'}
  :{id:'cloud',skipped:!(yes&&connected),note:answer==='no'?'Ei nyt':yes?cloudName[cloud]:undefined,next:'Voi ohittaa',
    detail:yes&&(inSub||phase==='ai')?<SubRoute cloud={cloud} at={inSub?phase as Sub:null} done={done}/>:undefined};
 const route: RouteStep[] = [github,repos,ms(r.scenario),cloudStep,{id:'ai'}];
 const step: StepId = phase==='ai'?'ai':'cloud';
 const back = () => phase==='which'?setPhase('ask'):phase==='connect'?setPhase('which'):phase==='computer'?setPhase('connect'):phase==='try'?setPhase('computer'):r.leave('Takaisin Microsoft 365 -vaiheeseen.');
 const actions = (next: ReactNode) => <div className="ah-onboarding-actions"><Button data-testid="step-back" size="page" variant="quiet" onPress={back}>Takaisin</Button>{next}</div>;
 return <OnboardingFrame route={route} step={step} host={host}>
  {phase==='ai'?<Elsewhere title="AI-tili" onBack={()=>already?r.leave('Takaisin Microsoft 365 -vaiheeseen.'):setPhase(answer==='no'?'ask':'try')}>
   {already&&<p className="proto-note" data-testid="not-asked">Oma kone on reitillä valmiina: OneDrive yhdistettiin Microsoft 365 -vaiheessa.</p>}
  </Elsewhere>
  :phase==='ask'||phase==='which'?<section className="ah-onboarding-step hb-step" data-testid="cloud-step" aria-labelledby="step-title">
   <Header title="Onko sinulla henkilökohtainen Dropbox tai OneDrive?" lede="Sen kansion kautta agentti saa tiedostot koneeltasi ja tuo niitä sinne."/>
   {phase==='ask'?<>
    <div className="hb-answers" role="group" aria-label="Vastaus">
     <Answer id="yes" onPress={()=>setPhase('which')}>Kyllä</Answer>
     <Answer id="no" onPress={()=>{setAnswer('no');setPhase('ai');}}>Ei</Answer>
    </div>
    <p className="hb-later">Jos ei, löydät tämän myöhemmin: Asetukset › Integraatiot.</p>
    {actions(null)}
   </>:<>
    <div className="hb-answers" role="group" aria-label="Kumpi">
     <Answer id="dropbox" cloud="dropbox" onPress={()=>{setAnswer('dropbox');setConnected(false);setArrived(false);setPhase('connect');}}>Dropbox</Answer>
     <Answer id="microsoft" cloud="microsoft" onPress={()=>{setAnswer('microsoft');setConnected(false);setArrived(false);setPhase('connect');}}>OneDrive</Answer>
    </div>
    {actions(null)}
   </>}
  </section>
  :phase==='connect'?<section className="ah-onboarding-step hb-step" data-testid="sub-connect" aria-labelledby="step-title">
   <Header title={`Yhdistä ${cloudName[cloud]}`} lede={cloud==='microsoft'?'OneDrive tulee Microsoft 365 -tilin mukana.':undefined}/>
   <Connect cloud={cloud} connected={connected} onConnected={()=>setConnected(true)}/>
   {actions(connected&&<Button data-testid="step-continue" size="page" variant="primary" onPress={()=>setPhase('computer')}>Jatka</Button>)}
  </section>
  :phase==='computer'?<section className="ah-onboarding-step hb-step" data-testid="sub-computer" aria-labelledby="step-title">
   <Header title="Sama kansio koneellesi"/>
   <HowTo cloud={cloud}/>
   {actions(<Button data-testid="step-continue" size="page" variant="primary" onPress={()=>setPhase('try')}>Jatka</Button>)}
  </section>
  :<section className="ah-onboarding-step hb-step" data-testid="sub-try" aria-labelledby="step-title">
   <Header title="Kokeile yhdellä tiedostolla"/>
   <Try cloud={cloud} arrived={arrived} onArrived={()=>setArrived(true)}/>
   {actions(<Button data-testid="step-continue" size="page" variant={arrived?'primary':'secondary'} onPress={()=>setPhase('ai')}>{arrived?'Jatka AI-tiliin':'Ohita kokeilu'}</Button>)}
  </section>}
 </OnboardingFrame>;
}

// ---------- Direction 3: Lopuksi ----------

function AgentTry({cloud}:{cloud:Cloud}){
 return <div className="hb-agent-try" data-testid="agent-try">
  <UserMessage sourceText={`Mitä ${cloudGen[cloud]} kansiossa on?`} time="10.42" onCopy={noop}/>
  <AssistantMessage streamState="complete" time="10.42" onCopy={noop}><Markdown text={`Kansiossa on \`${newest}\`. Siinä on kirjautumisvirhe \`401 invalid_client\`. Haluatko, että selvitän sen?`}/></AssistantMessage>
 </div>;
}
function Last({r}:{r:Review}){
 const already = r.scenario==='onedrive';
 const [answer,setAnswer] = useState<Cloud|'no'|null>(already?'microsoft':null);
 const [connected,setConnected] = useState(already);
 const [arrived,setArrived] = useState(false);
 const [finished,setFinished] = useState(false);
 const yes = answer==='dropbox'||answer==='microsoft';
 const cloud: Cloud = answer==='microsoft'?'microsoft':'dropbox';
 const route: RouteStep[] = [github,repos,ms(r.scenario),{id:'ai',note:'ChatGPT'},{id:'cloud',skipped:!(yes&&connected),next:'Valinnainen',
  note:answer==='no'?'Ei nyt':yes&&arrived?`${cloudName[cloud]} · kokeiltu`:yes&&connected?cloudName[cloud]:'Ohitettu'}];
 const pick = (c: Cloud|'no') => {setAnswer(c);setConnected(false);setArrived(false);};
 if(finished)return <OnboardingFrame route={route} step="done" host={host}>
  <Elsewhere title="Työtilat" onBack={()=>setFinished(false)}>
   {!(yes&&connected)&&<p className="hb-later" data-testid="later">Oman koneen kansio löytyy myöhemmin Liitä-valikosta ja Asetukset › Integraatiot.</p>}
  </Elsewhere>
 </OnboardingFrame>;
 return <OnboardingFrame route={route} step="cloud" host={host}>
  <section className="ah-onboarding-step hb-step" data-testid="cloud-step" aria-labelledby="step-title">
   {already
    ?<Header title="Kokeile OneDrive-kansiota" lede="OneDrive yhdistettiin Microsoft 365 -vaiheessa. Avaa sama kansio koneellasi ja kokeile agentin kanssa."/>
    :<Header title="Onko sinulla henkilökohtainen Dropbox tai OneDrive?" lede="Agentti on valmis. Sen kansiosta agentti näkee tiedostot koneeltasi."/>}
   {!already&&<div className="hb-answers" role="group" aria-label="Vastaus">
    <Answer id="dropbox" cloud="dropbox" current={answer==='dropbox'} onPress={()=>pick('dropbox')}>Dropbox</Answer>
    <Answer id="microsoft" cloud="microsoft" current={answer==='microsoft'} onPress={()=>pick('microsoft')}>OneDrive</Answer>
   </div>}
   {yes&&!already&&<Connect key={cloud} cloud={cloud} connected={connected} onConnected={()=>setConnected(true)}/>}
   {yes&&connected&&<>
    <details className="hb-how" data-testid="how"><summary>Kansio koneellesi</summary><HowTo cloud={cloud} compact/></details>
    <Try cloud={cloud} arrived={arrived} onArrived={()=>setArrived(true)}><AgentTry cloud={cloud}/></Try>
   </>}
   <div className="ah-onboarding-actions">
    <Button data-testid="step-back" size="page" variant="quiet" onPress={()=>r.leave('Takaisin AI-tiliin.')}>Takaisin</Button>
    <Button data-testid="step-continue" size="page" variant={arrived?'primary':'secondary'} onPress={()=>{if(!yes)setAnswer('no');setFinished(true);}}>{arrived?'Aloita työ':'Ei nyt, aloita työ'}</Button>
   </div>
  </section>
 </OnboardingFrame>;
}

// ---------- The administrator's Käyttöönotto tab, per direction ----------

function AdminRow({id,n,name,hint,current,cls}:{id:string;n:ReactNode;name:string;hint:string;current?:boolean;cls?:string}){
 return <li className={cls}><button type="button" data-testid={`admin-route-${id}`} aria-current={current?'step':undefined}><span className="ob-num" aria-hidden="true">{n}</span><span className="ob-txt"><strong>{name}</strong><small>{hint}</small></span></button></li>;
}
function Admin({direction}:{direction:number}){
 const [ask,setAsk] = useState<'on'|'off'>('on');
 const [added,setAdded] = useState(true);
 const cloudRow = direction===0
  ?<AdminRow id="cloud" n={4} name="Oma kone" hint="Automaattinen" current/>
  :direction===1?(added?<AdminRow id="cloud" n={4} name="Oma kone" hint="Voi ohittaa" current/>:null)
  :null;
 const lastRow = direction===2?<AdminRow id="cloud" n={ask==='on'?5:'–'} name="Oma kone" hint={ask==='on'?'Kysytään lopuksi':'Ei kysytä'} current cls={ask==='on'?undefined:'ob-skipped'}/>:null;
 return <div className="hb-admin" data-testid="admin">
  <div className="hostbar"><strong>Open Habitat</strong><span>{host}</span><Icon name="user"/></div>
  <div className="hb-admin-body">
   <h2>Käyttöönotto</h2>
   <div className="ob-layout">
    <div className="s-card ob-listcol"><p className="ob-eyebrow">Uuden henkilön reitti</p>
     <ol className="ob-steplist" aria-label="Käyttöönoton vaiheet, kiinteä järjestys">
      <AdminRow id="github" n={1} name="GitHub" hint="Kirjautuminen"/>
      <AdminRow id="repositories" n={2} name="Repot" hint="Esivalitse · 3 oletusrepoa"/>
      <AdminRow id="microsoft" n={3} name="Microsoft 365" hint="Voi ohittaa"/>
      {cloudRow}
      {direction===1&&!added&&<AdminRow id="add-cloud" n={<Icon name="plus" width={14} height={14}/>} name="Lisää vaihe" hint="Integraatio tai Oma kone" cls="ob-add"/>}
      <AdminRow id="ai" n={direction===1&&!added?4:direction===2?4:5} name="AI-tili" hint="Henkilö valitsee"/>
      {lastRow}
     </ol>
    </div>
    <div className="s-card ob-cfg-card"><section className="ob-config" data-testid="admin-config">
     <p className="ob-eyebrow">Sinun asetuksesi</p><h3>Oma kone</h3>
     {direction===0?<>
      <p className="ob-muted">Kysymystä ei aseteta. Se kysytään, kun Dropbox tai Microsoft 365 on käytössä palvelimella.</p>
      <p className="ob-effect" data-testid="admin-effect"><strong>Henkilö näkee:</strong> "Onko sinulla henkilökohtainen Dropbox tai OneDrive?" ennen AI-tiliä. Ei kysytä, jos hän yhdisti jommankumman jo aiemmin.</p>
     </>:direction===1?(added?<>
      <p className="ob-muted">Kysyy henkilön omaa Dropboxia tai OneDrivea. Ei voi olla pakollinen.</p>
      <div className="ob-row"><Button data-testid="admin-remove" size="row" variant="quiet" onPress={()=>setAdded(false)}><Icon name="cross" width={14} height={14}/>Poista</Button></div>
      <p className="ob-effect" data-testid="admin-effect"><strong>Henkilö näkee:</strong> kysymyksen integraatioiden jälkeen. Jos hän yhdisti jo Dropboxin tai OneDriven, vaihe näkyy valmiina.</p>
     </>:<>
      <p className="ob-muted">Oma kone ei ole reitillä.</p>
      <Button data-testid="admin-add" size="row" variant="secondary" onPress={()=>setAdded(true)}>Lisää Oma kone</Button>
     </>):<>
      <Segmented data-testid="admin-ask" label="Oma kone" size="row" value={ask} onChange={setAsk} options={[{id:'on',label:'Kysy'},{id:'off',label:'Älä kysy'}]}/>
      <p className="ob-effect" data-testid="admin-effect"><strong>Henkilö näkee:</strong> {ask==='on'?'kysymyksen viimeisenä, kun agentti on valmis. Jo yhdistäneelle vain kansio koneelle ja kokeilu.':'Ei mitään. Liitä-valikko ja Integraatiot kertovat kansiosta myöhemmin.'}</p>
     </>}
    </section></div>
   </div>
  </div>
 </div>;
}

// ---------- Review page ----------

function App({direction}:{direction:number}){
 const [theme,setTheme] = useState(reviewTheme),[phone,setPhone] = useState(reviewPhone);
 const [scenario,setScenario] = useState<Scenario>(reviewScenario);
 const [view,setView] = useState<View>(reviewView);
 const [left,setLeft] = useState('');
 const [epoch,setEpoch] = useState(0);
 useEffect(()=>{document.documentElement.dataset.theme=theme;},[theme]);
 const r: Review = {scenario,leave:setLeft};
 const person = direction===0?<Three r={r}/>:direction===1?<YesNo r={r}/>:<Last r={r}/>;
 return <div className={phone?'review phone':'review'}>
  <header className="reviewbar"><strong>Pilvikansio siltana · kierros 2</strong>
   <label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
   <label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);}}/> 390 px</label>
   <p>Synteettiset tiedot. Ei yhteyttä palvelimeen, Dropboxiin eikä OneDriveen.</p>
  </header>
  <div className="scenario">
   <Segmented data-testid="view" label="Näkymä" size="row" value={view} onChange={v=>{reviewView=v;setView(v);}} options={[{id:'person',label:'Henkilö'},{id:'admin',label:'Ylläpitäjä'}]}/>
   {view==='person'&&<Segmented data-testid="scenario" label="Lähtötilanne" size="row" value={scenario} onChange={v=>{reviewScenario=v;setScenario(v);setLeft('');setEpoch(e=>e+1);}} options={[{id:'none',label:'Ei pilveä'},{id:'onedrive',label:'OneDrive jo yhdistetty'}]}/>}
   {view==='person'&&<Button size="row" variant="quiet" data-testid="restart" onPress={()=>{setLeft('');setEpoch(e=>e+1);}}>Alusta</Button>}
   {left&&<span className="hb-left" role="status" data-testid="left">{left}</span>}
  </div>
  <p className="axis" data-testid="axis">{axes[direction]}</p>
  <div className={`shell variant-${direction}`} key={`${epoch}-${view}`}>{view==='person'?person:<Admin direction={direction}/>}</div>
 </div>;
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: React.ReactNode){flushSync(()=>root.render(view===''?null:view));}};
const variants = directions.map((_,direction)=>()=> <App direction={direction}/>);
const picker = document.createElement('nav');
picker.className = 'proto-picker';picker.setAttribute('aria-label','Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n,i)=>{const button=document.createElement('button');button.className='proto-picker-item';button.textContent=n.replaceAll(' ',' ');if(i===0){button.setAttribute('data-active','');button.setAttribute('aria-current','true');}picker.append(button);});
document.body.append(picker);
new Function('stage','variants',pickerSource)(stageSink,variants);
