import React, {type ReactNode, useEffect, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import pickerSource from '../../../lib/picker.js?raw';
import '../../../lib/picker.css';
import {ControlButton as Button, Segmented} from '../../../../../web/src/components/ControlElements';
import {Icon} from '../../../../../web/src/components/Icon';
import {IntegrationsOverview, ProviderMark} from '../../../../../web/src/components/Integrations';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../../web/src/components/Conversation';
import {Composer} from '../../../../../web/src/components/composer/Composer';
import {Markdown} from '../../../../../web/src/components/Markdown';
import type {Account, IntegrationList, Provider} from '../../../../../web/src/app/integrations';
import {OnboardingFrame, type RouteStep, type StepId} from '../r2/frame';
import {type Cloud, cloudGen, cloudIn, person} from '../bridge';
import {type Dir, HowTo, RoundProvider, bridged, cloudName, delivery, folderName, sample, serverDir, tryFolder, useRound} from './bridge';
import '../../../../../design-system/styles.css';
import '../../../../../web/src/components/components.css';
import '../../../../../web/src/components/Settings.css';
import '../../../../../web/src/components/Integrations.css';
import '../../../../../web/src/components/OnboardingSettings.css';
import '../round.css';
import '../r2/round.css';
import './round.css';

// Round 3: round 2's recommended step (Kolme vastausta, added by the site)
// reworked around the person's own backed-up folders (Jari 2026-10-24), and
// the same folders in the conversation: the Liitä menu, the agent reading a
// fresh download or screenshot and the agent's delivery note. Two directions,
// because the services differ: OneDrive cannot back up Downloads, and Dropbox
// Backup is one-way. Production components, synthetic data.
const directions = ['Lataukset','Työpöytä'];
const dirs: Dir[] = ['downloads','desktop'];
const axes = [
 'Sinun ehdotuksesi sellaisenaan: koneella varmuuskopioidaan Lataukset ja Dokumentit. Dropbox Backup tekee molemmat; OneDrive ei varmuuskopioi Latauksia, joten siellä silta on Dokumentit. Macin kuvakaappaukset ohjataan Latauksiin tai Dokumentteihin.',
 'Työpöytä ja Dokumentit, jotka kumpikin palvelu varmuuskopioi Macilla ja Windowsilla. Mac tallentaa kuvakaappaukset Työpöydälle valmiiksi, joten asetusta ei muuteta. Kokeilu on kuvakaappaus.',
];
const noop = () => {};
const host = 'habitat.example.test';
type View = 'step'|'convo';
let reviewTheme = 'light', reviewPhone = false, reviewView: View = 'step', reviewCloud: Cloud = 'dropbox', reviewFound = true;

const checked = '2026-10-24T07:43:00Z';
const providers: Record<Cloud,Provider> = {
 dropbox:{id:'dropbox',available:true,login:'pasted_redirect',services:['dropbox']},
 microsoft:{id:'microsoft',available:true,login:'device_code',services:['mail','calendar','contacts','onedrive']},
};
const account = (c: Cloud): Account => c==='dropbox'
 ? {provider:'dropbox',address:person,checked_at:checked,services:[{id:'dropbox',state:'ok',directory:`~/cloud/dropbox/${person}`}]}
 : {provider:'microsoft',address:person,checked_at:checked,services:[{id:'mail',state:'ok'},{id:'calendar',state:'ok'},{id:'contacts',state:'ok'},{id:'onedrive',state:'ok',directory:`~/cloud/onedrive/${person}`}]};
const join = (n: string[]) => n.length<2?n[0]:`${n.slice(0,-1).join(', ')} ja ${n.at(-1)}`;
const names = (d: Dir, c: Cloud) => join(bridged(d,c).map(f=>folderName(f)));
const illative: Record<string,string> = {Lataukset:'Latauksiin',Dokumentit:'Dokumentteihin',Työpöytä:'Työpöydälle'};

// ---------- The onboarding step ----------

function Connect({cloud,connected,onConnected}:{cloud:Cloud;connected:boolean;onConnected:()=>void}){
 const [busy,setBusy] = useState(false);
 const list: IntegrationList = {schema_version:1,skill:'current',providers:[providers[cloud]],accounts:connected?[account(cloud)]:[]};
 return <div className="hb-connect-step" data-testid="connect" data-connected={connected}>
  {busy?<p className="hb-wait" role="status" data-testid="connecting"><span className="ig-spin" aria-hidden="true"/>Kirjaudutaan {cloud==='dropbox'?'Dropboxiin':'Microsoftiin'}…</p>
   :<IntegrationsOverview list={list} compact checking={new Set()} onCheck={noop} onConnect={()=>{setBusy(true);setTimeout(()=>{setBusy(false);onConnected();},600);}} onSignInAgain={noop} onRemove={noop}/>}
 </div>;
}

/** The try-it moment: a fresh file in the backed-up folder reaches the agent. */
function Try({cloud,dir,arrived,onArrived}:{cloud:Cloud;dir:Dir;arrived:boolean;onArrived:()=>void}){
 const f = tryFolder(dir,cloud), name = folderName(f);
 return <div className="hb-try" data-testid="try" data-arrived={arrived}>
  {arrived?<>
   <p className="hb-ok" role="status" data-testid="arrived"><Icon name="check"/><span><b>{sample(dir)}</b> näkyy agentille: {name}.</span></p>
   <p className="proto-note" data-testid="server-dir">Palvelimella <code>{serverDir(cloud,f)}</code></p>
  </>:<>
   <p data-testid="try-ask">{dir==='desktop'?<>Ota kuvakaappaus: <kbd>⇧⌘3</kbd> tai <kbd>Win</kbd> + <kbd>PrtScn</kbd>.</>:cloud==='dropbox'?'Lataa tai tallenna jokin tiedosto Latauksiin.':'Tallenna jokin tiedosto Dokumentteihin.'}</p>
   <p className="hb-wait" role="status"><span className="ig-spin" aria-hidden="true"/>Odotetaan, että se näkyy {cloudIn[cloud]}. Voi kestää muutaman minuutin.</p>
   <div className="proto-sim"><span>Prototyyppi</span><Button size="row" variant="quiet" data-testid="simulate-arrival" onPress={onArrived}>Tiedosto saapuu</Button></div>
  </>}
 </div>;
}

const Answer = ({id,cloud,children,onPress,current}:{id:string;cloud?:Cloud;children:ReactNode;onPress:()=>void;current?:boolean}) =>
 <Button data-testid={`answer-${id}`} size="row" variant={current?'primary':'secondary'} aria-pressed={current} onPress={onPress}>{cloud&&<ProviderMark provider={cloud} small/>}{children}</Button>;

function Step({dir,leave}:{dir:Dir;leave:(s:string)=>void}){
 const [answer,setAnswer] = useState<Cloud|'no'|null>(null);
 const [connected,setConnected] = useState(false);
 const [arrived,setArrived] = useState(false);
 const [at,setAt] = useState<StepId>('cloud');
 const yes = answer==='dropbox'||answer==='microsoft';
 const note = answer==='no'?'Ei pilveä':yes&&connected?`${cloudName[answer]}${arrived?' · kokeiltu':''}`:undefined;
 const route: RouteStep[] = [{id:'github',note:'Kirjautunut'},{id:'repositories',note:'3 repoa'},{id:'microsoft',skipped:true,note:'Ohitettu'},{id:'cloud',skipped:!(yes&&connected),note},{id:'ai'}];
 const pick = (a: Cloud|'no') => {setAnswer(a);setConnected(false);setArrived(false);};
 const ready = answer==='no'||(yes&&connected);
 return <OnboardingFrame route={route} step={at} host={host}>
  {at==='ai'?<section className="ah-onboarding-step hb-step" data-testid="elsewhere" aria-labelledby="step-title">
   <header><p className="ah-eyebrow">Käyttöönotto</p><h1 id="step-title" data-testid="step-title" tabIndex={-1}>AI-tili</h1></header>
   <p className="proto-note">Ei tämän kierroksen aihe.</p>
   <div className="ah-onboarding-actions"><Button data-testid="elsewhere-back" size="page" variant="quiet" onPress={()=>setAt('cloud')}>Takaisin</Button></div>
  </section>
  :<section className="ah-onboarding-step hb-step" data-testid="cloud-step" aria-labelledby="step-title">
   <header><p className="ah-eyebrow">Käyttöönotto</p>
    <h1 id="step-title" data-testid="step-title" tabIndex={-1}>Onko sinulla henkilökohtainen Dropbox tai OneDrive?</h1>
    <p data-testid="step-lede">{dir==='downloads'?'Sen varmuuskopion kautta agentti näkee Lataukset ja Dokumentit koneeltasi.':'Sen varmuuskopion kautta agentti näkee Työpöydän ja Dokumentit koneeltasi.'}</p>
   </header>
   <div className="hb-answers" role="group" aria-label="Vastaus">
    <Answer id="dropbox" cloud="dropbox" current={answer==='dropbox'} onPress={()=>pick('dropbox')}>Dropbox</Answer>
    <Answer id="microsoft" cloud="microsoft" current={answer==='microsoft'} onPress={()=>pick('microsoft')}>OneDrive</Answer>
    <Answer id="no" current={answer==='no'} onPress={()=>pick('no')}>Ei ole</Answer>
   </div>
   {answer==='no'&&<p className="hb-later" data-testid="later">Voit yhdistää sen myöhemmin: Asetukset › Integraatiot.</p>}
   {yes&&<>
    <Connect key={answer} cloud={answer} connected={connected} onConnected={()=>setConnected(true)}/>
    {connected&&<>
     <div className="hb-block"><h2 data-testid="howto-title">Varmuuskopioi {names(dir,answer)} koneellasi</h2><HowTo cloud={answer} dir={dir}/></div>
     <div className="hb-block"><h2>Kokeile</h2><Try cloud={answer} dir={dir} arrived={arrived} onArrived={()=>setArrived(true)}/></div>
    </>}
   </>}
   <div className="ah-onboarding-actions">
    <Button data-testid="step-back" size="page" variant="quiet" onPress={()=>leave('Takaisin Microsoft 365 -vaiheeseen.')}>Takaisin</Button>
    {ready&&<Button data-testid="step-continue" size="page" variant={answer==='no'||arrived?'primary':'secondary'} onPress={()=>setAt('ai')}>{answer!=='no'&&!arrived?'Jatka kokeilematta':'Jatka'}</Button>}
   </div>
  </section>}
 </OnboardingFrame>;
}

// ---------- The conversation: Liitä, reading and delivering ----------

const bills = [['Lasku-1043-Sähkö.pdf','182 kt'],['Lasku-1044-Vakuutus.pdf','96 kt'],['Lasku-1047-Puhelin.pdf','64 kt']];
const user = (id: string, text: string) => ({id,content:<UserMessage sourceText={text} time="10.42" onCopy={noop}/>});
const agent = (id: string, body: ReactNode) => ({id,content:<AssistantMessage streamState="complete" time="10.43" onCopy={noop}>{body}</AssistantMessage>});

/** Above a reply that read the person's folder: derived from the agent's
 * read path, not the agent's claim. */
function Inbound(){
 const r = useRound();
 return <p className="hb-inbound" data-testid="inbound"><ProviderMark provider={r.cloud} small/><span>Koneeltasi · {folderName(tryFolder(r.dir,r.cloud))} › <b>{sample(r.dir)}</b> · 10.41</span></p>;
}
/** Below a reply that wrote files for the person: where they are on the computer. */
function Delivery(){
 const r = useRound();
 const d = delivery(r.cloud);
 return <aside className="hb-delivery" data-testid="delivery" aria-label="Koneellasi">
  <header><Icon name="laptop"/><b data-testid="delivery-where">Koneellasi: {d.label} › Laskut 10-2026</b></header>
  <ul>{bills.map(([n,s])=><li key={n}><Icon name="file"/><span>{n}</span><small>{s}</small></li>)}</ul>
  <p className="hb-meta" data-testid="delivery-state"><Icon name="check"/>{r.cloud==='dropbox'
   ?'Dropboxissa klo 10.43. Varmuuskopio kulkee vain koneelta pilveen, joten tuodut tiedostot ovat Dropbox-kansiossa.'
   :'OneDrivessa klo 10.43. OneDrive tuo ne Dokumentteihisi.'}</p>
 </aside>;
}
function Missing(){
 const r = useRound();
 const [how,setHow] = useState(false);
 return <aside className="hb-delivery off" data-testid="missing">
  <p>{cloudName[r.cloud]} on yhdistetty, mutta siellä ei ole vielä varmuuskopiota: {names(r.dir,r.cloud)}.</p>
  <Button size="row" variant="quiet" data-testid="missing-how" aria-expanded={how} onPress={()=>setHow(v=>!v)}>{how?'Piilota ohje':'Laita varmuuskopio päälle'}</Button>
  {how&&<HowTo cloud={r.cloud} dir={r.dir} compact/>}
 </aside>;
}

function Convo(){
 const r = useRound();
 const [value,setValue] = useState('');
 const f = folderName(tryFolder(r.dir,r.cloud));
 const ask = r.dir==='desktop'?'Katso kuvakaappaus, jonka otin äsken. Mikä virhe tuo on?':`Laitoin myyntitiedoston ${illative[f]}. Miksi raportti on tyhjä?`;
 const answer = r.dir==='desktop'
  ?'Kuvassa on kirjautumisen virhe `401 invalid_client`: sovelluksen tunnus on väärä. Korjaan sen `config/auth.toml`-tiedostoon, jos haluat.'
  :'Tiedostossa on sarake `Myynti €`, mutta raportti hakee saraketta `myynti`. Korjaan nimen `report.py`:hin, jos haluat.';
 const items = r.found?[
  user('u1',ask),
  agent('a1',<><Inbound/><Markdown text={answer}/></>),
  user('u2','Laita tämän kuun laskut koneelleni.'),
  agent('a2',<><Markdown text={`Laitoin kolme laskua ${cloudGen[r.cloud]} kautta koneellesi.`}/><Delivery/></>),
 ]:[
  user('u1',ask),
  agent('a1',<><Markdown text={`En näe koneesi kansioita. ${cloudName[r.cloud]} on yhdistetty, mutta varmuuskopio ei ole päällä.`}/><Missing/></>),
 ];
 return <RoundProvider value={{...r,mention:t=>setValue(v=>v?`${v} ${t}`:t)}}>
  <main className="ah-conversation-frame hb-convo" data-testid="convo">
   <div className="ah-conversation-stream"><ConversationTimeline state="ready" items={items} historyMode="virtualized" onJumpToLatest={noop}/></div>
   <Composer value={value} onChange={setValue} csrf="prototype" activity="idle" selectedWorkingMode="steer" onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop}/>
  </main>
 </RoundProvider>;
}

// ---------- Review page ----------

function App({direction}:{direction:number}){
 const [theme,setTheme] = useState(reviewTheme),[phone,setPhone] = useState(reviewPhone);
 const [view,setView] = useState<View>(reviewView);
 const [cloud,setCloud] = useState<Cloud>(reviewCloud);
 const [found,setFound] = useState(reviewFound);
 const [left,setLeft] = useState('');
 const [epoch,setEpoch] = useState(0);
 useEffect(()=>{document.documentElement.dataset.theme=theme;},[theme]);
 const dir = dirs[direction];
 return <div className={phone?'review phone':'review'}>
  <header className="reviewbar"><strong>Pilvikansio siltana · kierros 3</strong>
   <label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
   <label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);}}/> 390 px</label>
   <p>Synteettiset tiedot. Ei yhteyttä palvelimeen, Dropboxiin eikä OneDriveen.</p>
  </header>
  <div className="scenario">
   <Segmented data-testid="view" label="Näkymä" size="row" value={view} onChange={v=>{reviewView=v;setView(v);setLeft('');}} options={[{id:'step',label:'Käyttöönotto'},{id:'convo',label:'Keskustelu'}]}/>
   {view==='convo'&&<Segmented data-testid="cloud" label="Pilvi" size="row" value={cloud} onChange={v=>{reviewCloud=v;setCloud(v);}} options={[{id:'dropbox',label:'Dropbox'},{id:'microsoft',label:'OneDrive'}]}/>}
   {view==='convo'&&<Segmented data-testid="found" label="Varmuuskopio" size="row" value={found?'on':'off'} onChange={v=>{reviewFound=v==='on';setFound(reviewFound);}} options={[{id:'on',label:'Päällä'},{id:'off',label:'Ei vielä'}]}/>}
   {view==='step'&&<Button size="row" variant="quiet" data-testid="restart" onPress={()=>{setLeft('');setEpoch(e=>e+1);}}>Alusta</Button>}
   {left&&<span className="hb-left" role="status" data-testid="left">{left}</span>}
  </div>
  <p className="axis" data-testid="axis">{axes[direction]}</p>
  <div className={`shell variant-${direction}`} key={`${epoch}-${view}`}>
   <RoundProvider value={{cloud,dir,found}}>{view==='step'?<Step dir={dir} leave={setLeft}/>:<Convo/>}</RoundProvider>
  </div>
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
