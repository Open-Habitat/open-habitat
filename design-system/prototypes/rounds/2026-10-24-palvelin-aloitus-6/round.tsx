import React, {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, useLocation, useNavigate} from 'react-router';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusMark} from '../../../../web/src/components/Status';
import {ProviderMark} from '../../../../web/src/components/Integrations';
import {GitHubRepoChooser} from './chooser';
import {UsersTab, initialPeople, type Direction, type Person} from './access';
import {RepoFinder, type CloneRowView, type RepoChoice} from '../../../../web/src/components/ClonePage';
import {arrange, exactName, type CatalogRepo, type Since} from '../../../../web/src/components/repoCatalog';
import device from '../../../../web/src/components/PiDeviceSignIn.module.css';
import {OnboardingFrame, OnboardingRoute, cloneSummary, type Cue, type ProtoRouteStep} from './frame';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/Integrations.css';
import './round.css';

// Round 6 of Settings › Palvelimen ylläpito: the Käyttäjät ja pääsy tab, with
// round 5's settled Käyttöönotto tab (Tapa ja lista, names on the route) kept
// for the one carry-over: in automatic checkout the defaults already being
// fetched stay in the person's chooser as locked forced selections. The open
// choice is how allowed-but-not-joined and joined people are shown and edited.
// Everything is synthetic and in memory; nothing leaves the page.
const directions=['Yksi lista','Kaksi listaa','Henkilö auki'];

type Mode='preselected'|'auto'|'skip';
type Persona='all'|'missing';
type Draft={mode:Mode;repos:string[]};
const modeNames:Record<Mode,string>={preselected:'Esivalitse',auto:'Hae automaattisesti',skip:'Ohita vaihe'};
const modeLong:Record<Mode,string>={preselected:'Esivalitse oletusrepot',auto:'Hae oletusrepot automaattisesti',skip:'Ohita repovaihe'};

// ---------- Synthetic GitHub ----------

const day=86400000,now=Date.parse('2026-10-23T12:00:00Z');
const ago=(d:number|null)=>d===null?null:new Date(now-d*day).toISOString();
const repo=(full_name:string,description:string,age:number|null,size_kib=4200,priv=true,owner_type:'User'|'Organization'='Organization'):CatalogRepo=>({full_name,description,pushed_at:ago(age),size_kib,private:priv,default_branch:'main',owner_type});
// The administrator's own GitHub view, used only to choose defaults.
const adminCatalog:CatalogRepo[]=[
 repo('northstar-demo/product','Synteettinen tuotekehitysrepo',0.2),
 repo('northstar-demo/design-system','Komponentit ja tokenit',1),
 repo('northstar-demo/infra','Palvelinten asetukset',2),
 repo('northstar-demo/docs','Käyttöohjeet',6,1800,false),
 repo('northstar-demo/mobile-app','Mobiilisovellus',12,96000),
 repo('northstar-demo/handbook','Perehdytysmateriaali',95,900,false),
 repo('kaisa-admin/dotfiles','Omat asetukset',3,120,false,'User'),
];
const lookupOnly=[repo('northstar-labs/research','Tutkimusmuistiinpanot',20)];
const known=(n:string)=>[...adminCatalog,...lookupOnly].find(r=>r.full_name===n);
// The person's view is read with their own GitHub account. "missing" is a
// person who cannot read northstar-demo/infra.
const restricted='northstar-demo/infra';
const personCatalog=(p:Persona)=>[...adminCatalog.filter(r=>r.owner_type==='Organization'&&(p==='all'||r.full_name!==restricted)),...lookupOnly,repo('aino-demo/muistiinpanot','Omat muistiinpanot',4,80,true,'User')];
const readable=(names:string[],p:Persona)=>names.filter(n=>personCatalog(p).some(r=>r.full_name===n));
const rowsOf=(names:string[]):CloneRowView[]=>names.map((n,i)=>({full_name:n,state:i===0?'running':'waiting',stage:'receiving',percent:42,retryable:false}));
const repoWord=(n:number)=>n===1?'repo':'repoa';

// ---------- The person's AI step: round 4's "Ehdotus ja lista", unchanged ----------

type Opt='openai'|'claude'|'openai-key'|'anthropic-key'|'deepseek-key';
type KeyProvider='openai'|'anthropic'|'deepseek';
type Option={id:Opt;name:string;mark:string;how:string;key?:KeyProvider;missing?:boolean};
const opts:Option[]=[
 {id:'openai',name:'ChatGPT-tilaus',mark:'Ch',how:'Kirjaudu OpenAI-tililläsi. Käyttö kuuluu tilaukseesi.'},
 {id:'claude',name:'Claude-tilaus',mark:'Cl',how:'Kirjaudu Claude-tililläsi. Käyttö kuuluu tilaukseesi.'},
 {id:'openai-key',name:'OpenAI API-avain',mark:'OA',how:'OpenAI laskuttaa käytöstä.',key:'openai'},
 {id:'anthropic-key',name:'Anthropic API-avain',mark:'An',how:'Anthropic laskuttaa käytöstä.',key:'anthropic'},
 {id:'deepseek-key',name:'DeepSeek API-avain',mark:'DS',how:'DeepSeek laskuttaa käytöstä.',key:'deepseek'},
];
const opt=(id:Opt)=>opts.find(o=>o.id===id)!;
const keyNames:Record<KeyProvider,string>={openai:'OpenAI',anthropic:'Anthropic',deepseek:'DeepSeek'};
const keyShape:Record<KeyProvider,RegExp>={openai:/^sk-(?!ant-)[A-Za-z0-9_-]{20,200}$/,anthropic:/^sk-ant-[A-Za-z0-9_-]{20,200}$/,deepseek:/^sk-[A-Za-z0-9]{20,200}$/};
const keyPrefix=(p:KeyProvider)=>p==='anthropic'?'sk-ant-…':'sk-…';
const Mark=({o}:{o:Option})=><span className={`mk${o.key?' mk-key':''}`} aria-hidden="true">{o.mark}</span>;

function SubFlow({id}:{id:'openai'|'claude'}){
 const [phase,setPhase]=useState<'start'|'pending'|'done'>('start');
 const o=opt(id),service=id==='openai'?'OpenAI':'Claude';
 if(phase==='done')return <div className="st-flow" data-testid={`flow-${id}`} data-phase="done"><StatusMark label={`${o.name} yhdistetty`} tone="success"/><div className="st-actions"><Button data-testid="pv-continue" size="page" variant="primary">Avaa työtilat</Button></div></div>;
 if(phase==='start')return <div className="st-flow" data-testid={`flow-${id}`} data-phase="start"><div className="st-actions"><Button data-testid="pv-start" size="page" variant="primary" onPress={()=>setPhase('pending')}>Kirjaudu {service}-tilillä</Button></div><p className="st-quiet">Kirjautuminen tehdään {service}n omalla sivulla. Salasanaa ei syötetä tänne.</p></div>;
 return <div className="st-flow" data-testid={`flow-${id}`} data-phase="pending"><div className={device.steps}>
  <div className={device.instruction}><span className={device.number}>1</span><div><strong>Kopioi koodi</strong><div className={device.code}><code>ABCD-1234</code></div></div></div>
  <div className={device.instruction}><span className={device.number}>2</span><div><strong>Syötä koodi {service}n sivulla</strong><a href="#" onClick={e=>e.preventDefault()}>Avaa vahvistussivu (uusi välilehti)</a></div></div>
  <div className={device.instruction} role="status"><span className={device.number}>3</span><div><strong>Palaa tänne ja odota</strong><StatusMark label="Odotetaan vahvistusta" tone="info" animated="running"/></div></div>
 </div><div className="st-actions"><Button size="row" variant="quiet" onPress={()=>setPhase('start')}>Peruuta</Button><Button data-testid="pv-simulate" size="row" variant="quiet" onPress={()=>setPhase('done')}>Simuloi hyväksyntä</Button></div></div>;
}
function KeyFlow({provider}:{provider:KeyProvider}){
 const [suffix,setSuffix]=useState<string|null>(null),[key,setKey]=useState('');
 const ok=keyShape[provider].test(key);
 if(suffix)return <div className="st-flow" data-phase="done"><StatusMark label={`${keyNames[provider]}-avain tallennettu · ${keyPrefix(provider)}${suffix}`} tone="success"/></div>;
 return <div className="st-flow"><label className="st-field"><strong>{keyNames[provider]} API-avain</strong><span className="st-inline"><input type="password" autoComplete="off" value={key} placeholder={keyPrefix(provider)} onChange={e=>setKey(e.target.value)}/><Button size="row" variant="primary" isDisabled={!ok} onPress={()=>{setSuffix(key.slice(-4));setKey('');}}>Tallenna</Button></span></label><p className="st-quiet">Avain tallentuu vain omalle käyttäjällesi. {keyNames[provider]} laskuttaa käytöstä.</p></div>;
}
const Flow=({o}:{o:Option})=>o.key?<KeyFlow provider={o.key}/>:<SubFlow id={o.id as 'openai'|'claude'}/>;
function AiStep({offer}:{offer:Opt}){
 const [open,setOpen]=useState(false),[sel,setSel]=useState<Opt>(offer);
 const row=(o:Option,suggested=false)=>{const on=sel===o.id;return <li key={o.id} className={`st-opt${on?' on':''}${o.key?' key':''}`} data-testid={`opt-${o.id}`}>
  <button type="button" className="st-opt-head" aria-expanded={on} onClick={()=>setSel(o.id)}><Mark o={o}/><span className="st-opt-txt"><strong>{o.name}</strong><small>{o.how}</small></span>{suggested?<span className="st-badge">Ehdotus</span>:<span className="st-radio" aria-hidden="true"/>}</button>
  {on&&<div className="st-opt-body"><Flow o={o}/></div>}</li>;};
 const others=opts.filter(x=>x.id!==offer);
 return <div className="st" data-layout="cards"><header className="st-head"><h1>Kirjaudu AI-palveluun</h1><p>Sivusto ehdottaa: {opt(offer).name}. Voit lisätä muita tilejä myöhemmin asetuksissa.</p></header><ul className="st-opts">{row(opt(offer),true)}</ul>
  <button type="button" className="st-more" data-testid="pv-other" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span className="st-chev" aria-hidden="true">›</span>Käytä muuta AI-palvelua</button>
  {open&&<div className="st-groups" data-testid="pv-others"><p className="st-group">Tilaus</p><ul className="st-opts">{others.filter(o=>!o.key).map(o=>row(o))}</ul><p className="st-group">API-avain · maksu käytön mukaan</p><ul className="st-opts">{others.filter(o=>o.key).map(o=>row(o))}</ul></div>}</div>;
}

// ---------- The person's screen ----------

type At='repositories'|'google'|'ai';
function PersonScreen({draft,persona}:{draft:Draft;persona:Persona}){
 const cue:Cue='names';
 const defaults=readable(draft.repos,persona);
 const autoNames=draft.mode==='preselected'?[]:defaults;
 const [at,setAt]=useState<At>(draft.mode==='skip'?'google':'repositories');
 const [selected,setSelected]=useState<string[]>(draft.mode==='preselected'?defaults:[]);
 const [chosen,setChosen]=useState<string[]|null>(null);
 // Auto defaults start right after the GitHub sign-in; a choice starts when the person goes on.
 const fetching=[...autoNames,...(chosen??[])];
 const rows=rowsOf(fetching);
 const repoStep:ProtoRouteStep|null=draft.mode==='skip'
  ?(defaults.length?{id:'repositories',auto:true,note:`Sivusto hakee ${defaults.length} ${repoWord(defaults.length)}`,clones:rows}:null)
  :{id:'repositories',skipped:chosen!==null&&!fetching.length,note:at==='repositories'?(autoNames.length?`Nyt · ${autoNames.length} haussa`:undefined):fetching.length?`Haetaan ${fetching.length} ${repoWord(fetching.length)}`:'Ei repoja',clones:rows};
 const steps:ProtoRouteStep[]=[{id:'github',note:'Kirjautunut'},...(repoStep?[repoStep]:[]),{id:'google',skipped:at==='ai'},{id:'ai'}];
 const view={phase:'catalog' as const,repositories:personCatalog(persona).map(({full_name,private:p,description,pushed_at})=>({full_name,private:p,description,pushed_at}))};
// The forced selections: what the site already fetches, with its state.
 const locked=draft.mode==='auto'?rows.filter(r=>autoNames.includes(r.full_name)).map(r=>({full_name:r.full_name,status:`Sivusto hakee · ${r.state==='running'?`${r.percent} %`:'jonossa'}`})):[];
 const preNote=draft.mode==='preselected'&&defaults.length?<p className="pv-note" data-testid="pv-pre-note"><Icon name="info" width={14} height={14}/><span>Sivusto on valinnut valmiiksi {defaults.length} {repoWord(defaults.length)}. Voit poistaa valinnan.</span></p>:null;
 let body:ReactNode;
 if(at==='repositories')body=<GitHubRepoChooser view={view} locked={locked} selectedNames={selected} onToggle={(n,yes)=>setSelected(s=>yes?[...s,n]:s.filter(x=>x!==n))} onProceed={names=>{setChosen(names);setAt('google');}} notice={preNote}/>;
 else if(at==='google')body=<OnboardingFrame step="google"><div className="st"><header className="st-head"><h1>Google</h1><p>Yhdistä oma Google-tilisi, jos agentin pitää lukea sähköpostia, kalenteria tai Drivea. Voit tehdä tämän myöhemmin asetuksissa.</p></header><div className="ig-tile"><ProviderMark provider="google"/><div><span className="ig-rn">Google</span><span className="ig-meta">Gmail · Kalenteri · Yhteystiedot · Drive</span></div><Button size="row" variant="secondary">Yhdistä…</Button></div><div className="st-actions"><Button data-testid="pv-skip-google" size="page" variant="secondary" onPress={()=>setAt('ai')}>Jatka ilman Googlea</Button></div></div></OnboardingFrame>;
 else body=<OnboardingFrame step="ai"><AiStep offer="openai"/></OnboardingFrame>;
 return <div className="person" data-testid="person-view" data-at={at} data-fetching={fetching.length}><OnboardingRoute steps={steps} cue={cue}>{body}</OnboardingRoute></div>;
}

// ---------- Device frames (round 4) ----------

type Device='desktop'|'phone';
const DESKTOP=760;
function DeviceStage({device,children}:{device:Device;children:ReactNode}){
 const outer=useRef<HTMLDivElement>(null),inner=useRef<HTMLDivElement>(null);
 const [box,setBox]=useState({w:DESKTOP,h:0});
 useLayoutEffect(()=>{const o=outer.current,i=inner.current;if(!o||!i)return;const ro=new ResizeObserver(()=>setBox({w:o.clientWidth,h:i.offsetHeight}));ro.observe(o);ro.observe(i);return()=>ro.disconnect();},[device]);
 const width=device==='phone'?Math.min(390,box.w):Math.max(box.w,DESKTOP),scale=device==='phone'?1:Math.min(1,box.w/DESKTOP);
 return <div className={`dev dev-${device}`} ref={outer} data-testid="device" data-device={device}>
  <div className="dev-box" style={{width:device==='phone'?width:'100%',height:scale<1?box.h*scale:undefined}}>
   <div ref={inner} className="dev-inner" style={{width:device==='phone'?'100%':width,transform:scale<1?`scale(${scale})`:undefined}}>
    {device==='desktop'?<div className="dev-chrome"><span className="dev-dots" aria-hidden="true"><i/><i/><i/></span><span className="dev-url">habitat.example.test/aloitus</span></div>:<div className="dev-notch" aria-hidden="true"/>}
    <div className="dev-screen">{children}</div>
   </div>
  </div>
  {scale<1&&<p className="dev-scale">Tietokoneen näkymä pienennettynä ({Math.round(scale*100)} %).</p>}
 </div>;
}

// ---------- The administrator's default-repository picker: production RepoFinder ----------

function FinderRoutes({added,onAdd}:{added:string[];onAdd:(n:string)=>void}){
 const location=useLocation(),navigate=useNavigate();
 const [query,setQuery]=useState(''),[since,setSince]=useState<Since>('0');
 useEffect(()=>{const m=location.pathname.match(/^\/add\/(.+)$/);if(m){onAdd(decodeURIComponent(m[1]));navigate('/',{replace:true});}},[location.pathname]);
 const mark=(r:CatalogRepo):RepoChoice=>({...r,href:'/add/'+encodeURIComponent(r.full_name),selected:added.includes(r.full_name),mark:added.includes(r.full_name)?{label:'oletus',tone:'ok'}:undefined});
 const exact=exactName(query),found=exact&&[...adminCatalog,...lookupOnly].find(r=>r.full_name.toLowerCase()===exact.toLowerCase());
 const lookup=exact&&!adminCatalog.some(r=>r.full_name.toLowerCase()===exact.toLowerCase())?found?{state:'found' as const,name:exact,repo:mark(found)}:{state:'not_found' as const,name:exact}:undefined;
 return <RepoFinder arrangement={arrange(adminCatalog.map(mark),{login:'kaisa-admin',query,since,now,taken:r=>added.includes(r.full_name)})} query={query} onQuery={setQuery} since={since} onSince={setSince} now={now} lookup={lookup} state="ready"/>;
}
function RepoPicker({added,onAdd,onClose,theme}:{added:string[];onAdd:(n:string)=>void;onClose:()=>void;theme:string}){
 return <ModalOverlay className="ah-overlay rp-overlay" isOpen isDismissable onOpenChange={o=>!o&&onClose()}><Modal className="ah-modal rp-modal" data-theme={theme}><Dialog className="ah-dialog rp-dialog" aria-label="Lisää oletusrepo"><Heading slot="title">Lisää oletusrepo</Heading><p className="muted">Näet omat GitHub-repojesi. Uuden henkilön pääsy tarkistetaan hänen omalla tilillään.</p><MemoryRouter><FinderRoutes added={added} onAdd={onAdd}/></MemoryRouter><div className="rp-foot"><span role="status" className="muted" data-testid="picker-count">{added.length} oletusrepoa</span><Button data-testid="picker-done" size="page" onPress={onClose}>Valmis</Button></div></Dialog></Modal></ModalOverlay>;
}

// ---------- The administrator: start mode and default repositories ----------

const listLabel:Record<Mode,string>={preselected:'Esivalitut repot',auto:'Automaattisesti haettavat repot',skip:'Taustalla tuotavat repot'};
const listHint:Record<Mode,string>={
 preselected:'Valmiiksi valittuina henkilön repovalitsimessa.',
 auto:'Haetaan heti GitHub-kirjautumisen jälkeen. Henkilö voi valita lisää.',
 skip:'Valinnaisia. Tuodaan taustalla ilman repovaihetta.',
};
const accessRule='Repo haetaan vain, jos henkilöllä on siihen pääsy omalla GitHub-tilillään. Muuten se jätetään pois näyttämättä nimeä henkilölle. Näet tuloksen Käyttäjät ja pääsy -välilehdellä.';
function DefaultList({draft,set,onAdd}:{draft:Draft;set:(p:Partial<Draft>)=>void;onAdd:()=>void}){
 return <div className="defaults" data-testid="defaults">
  {draft.repos.length?<ul className="repo-list" data-testid="default-repos">{draft.repos.map(n=>{const r=known(n);const [o,name]=n.split('/');return <li key={n} data-testid={`default-${n}`}><span className="repo-id"><span className="ah-mono"><span className="ah-clone-owner">{o}/</span><b>{name}</b></span>{r?.private&&<Icon name="lock" width={12} height={12}/>}{r?.description&&<span className="muted repo-desc">{r.description}</span>}</span><Button data-testid={`remove-${n}`} size="row" variant="quiet" aria-label={`Poista ${n} oletusrepoista`} onPress={()=>set({repos:draft.repos.filter(x=>x!==n)})}><Icon name="cross" width={14} height={14}/>Poista</Button></li>;})}</ul>:<p className="muted empty" data-testid="no-defaults">Ei oletusrepoja.</p>}
  <div><Button data-testid="add-repo" size="row" variant="secondary" onPress={onAdd}><Icon name="plus" width={14} height={14}/>Lisää oletusrepo…</Button></div>
 </div>;
}
const effect=(d:Draft)=>{const n=d.repos.length,w=`${n} ${n===1?'oletusrepo':'oletusrepoa'}`;
 if(d.mode==='preselected')return n?`Repovalitsin avautuu, ja ${w} on valmiiksi valittuna. Henkilö voi poistaa valinnan ja valita muita.`:'Repovalitsin avautuu ilman esivalintoja.';
 if(d.mode==='auto')return n?`${w} haetaan heti GitHub-kirjautumisen jälkeen. Repovalitsimessa henkilö voi valita lisää.`:'Mitään ei haeta automaattisesti. Lisää ainakin yksi repo, tai repovalitsin avautuu tyhjänä.';
 return n?`Repovaihetta ei näytetä. ${w} tuodaan taustalla, ja reitin Repot-rivi kertoo sen.`:'Repovaihetta ei näytetä eikä mitään haeta. Repoja voi hakea myöhemmin työtilanäkymästä.';};
const routeHint=(d:Draft)=>{const n=d.repos.length;return d.mode==='preselected'?(n?`${n} esivalittuna`:'Henkilö valitsee'):d.mode==='auto'?(n?`${n} haetaan automaattisesti`:'Ei mitään haettavaa'):n?`Ohitetaan · ${n} tuodaan`:'Ohitetaan';};

function RepoSettings({draft,set,onAdd}:{draft:Draft;set:(p:Partial<Draft>)=>void;onAdd:()=>void}){
 return <section className="config" data-step="repos" aria-label="Repojen asetus"><p className="eyebrow">Sinun asetuksesi</p><h3>Repot</h3>
  <p className="cfg-lbl">Repojen aloitustapa</p><Segmented data-testid="repo-mode" label="Repojen aloitustapa" size="row" options={(Object.keys(modeNames) as Mode[]).map(m=>({id:m,label:modeNames[m]}))} value={draft.mode} onChange={m=>set({mode:m})}/>
  <p className="cfg-lbl list-lbl">Oletusrepot:&nbsp;<span data-testid="list-label">{listLabel[draft.mode]}</span></p><p className="muted">{listHint[draft.mode]}</p><DefaultList draft={draft} set={set} onAdd={onAdd}/>
  <p className="muted access" data-testid="access-rule">{accessRule}</p><p className="effect" data-testid="effect"><strong>Henkilö näkee:</strong> {effect(draft)}</p></section>;
}

// ---------- Settings tabs (round 4, as settled) ----------

type Tab='server'|'onboarding'|'users';
const tabs:[Tab,string][]=[['server','Palvelin'],['onboarding','Käyttöönotto'],['users','Käyttäjät ja pääsy']];
function ServerTab({people}:{people:Person[]}){return <><h2>Palvelin</h2><div className="facts s-card"><div className="s-row"><strong>Northstar</strong><code>habitat.example.test</code></div><div className="s-row"><strong>Versio</strong><code>v0.0.0-prototype</code></div><div className="s-row"><strong>Käyttäjiä</strong><span>{people.filter(p=>p.state==='joined').length}</span></div></div></>;}

let reviewTheme='light',reviewPhone=false;
const initial:Draft={mode:'auto',repos:['northstar-demo/product','northstar-demo/design-system',restricted]};
function App({direction}:{direction:number}){
 const [theme,setTheme]=useState(reviewTheme),[phone,setPhone]=useState(reviewPhone);
 const [tab,setTab]=useState<Tab>('users');
 const [people,setPeople]=useState<Person[]>(initialPeople);
 const [draft,setDraft]=useState<Draft>(initial),[saved,setSaved]=useState<Draft>(initial);
 const [persona,setPersona]=useState<Persona>('all');
 const [dev,setDev]=useState<Device>(reviewPhone?'phone':'desktop');
 const [mode,setMode]=useState(false),[picker,setPicker]=useState(false),[notice,setNotice]=useState(''),[run,setRun]=useState(0);
 const set=(patch:Partial<Draft>)=>{setNotice('');setDraft(x=>({...x,...patch}));};
 const dirty=JSON.stringify(draft)!==JSON.stringify(saved);
 const settings=(inDrawer:boolean)=><div className="s-card cfg-card"><RepoSettings draft={draft} set={set} onAdd={()=>setPicker(true)}/></div>;
 const personaPick=<div className="persona"><p className="cfg-lbl">Esikatsele henkilönä</p><Segmented data-testid="persona" label="Esikatseltava henkilö" size="row" options={[{id:'all',label:'Pääsy kaikkiin'},{id:'missing',label:'Ei pääsyä: infra'}]} value={persona} onChange={setPersona}/><p className="muted">{persona==='missing'?<>Henkilöllä ei ole GitHub-pääsyä repoon <code>{restricted}</code>. Se ei näy hänelle missään.</>:'Henkilöllä on pääsy kaikkiin oletusrepoihin.'}</p></div>;
 const screen=<PersonScreen key={`${JSON.stringify(draft)}|${persona}|${run}`} draft={draft} persona={persona}/>;
 const rows:[string,string,string][]=[['github','GitHub','Kirjautuminen'],['google','Google','Voi ohittaa'],['add','Lisää integraatio','Uusi vaihe ennen AI-tiliä'],['ai','AI-tili','Oletus: ChatGPT-tilaus']];
 const row=([k,name,hint]:[string,string,string],n:string)=><li key={k} className={k==='add'?'add':undefined}><button type="button" disabled title="Kierros 6 näyttää vain repot"><span className="num">{k==='add'?<Icon name="plus" width={14} height={14}/>:n}</span><span className="txt"><strong>{name}</strong><small>{hint}</small></span></button></li>;
 const skipped=draft.mode==='skip';
 const stepList=<div className="s-card listcol"><p className="eyebrow">Uuden henkilön reitti</p><ol className="steplist route-like" aria-label="Käyttöönoton vaiheet, kiinteä järjestys">{row(rows[0],'1')}
  <li className={skipped?'skipped':undefined}><button type="button" data-testid="step-repos" aria-current="step"><span className="num">{skipped?'–':'2'}</span><span className="txt"><strong>Repot</strong><small data-testid="step-repos-hint">{routeHint(draft)}</small></span></button></li>
  {row(rows[1],skipped?'2':'3')}{row(rows[2],'')}{row(rows[3],skipped?'3':'4')}</ol></div>;
 const onboarding=<>
  <div className="tab-head"><div><h2>Käyttöönotto</h2><p className="lede">Mitä uusi henkilö käy läpi ensimmäisellä kirjautumisella. Vaiheiden järjestys on kiinteä.</p></div>
   <Button data-testid="pv-open" size="page" variant="secondary" onPress={()=>setMode(true)}><Icon name="eye" width={16} height={16}/>Näytä henkilön näkymä</Button></div>
  {notice&&<p role="status" className="notice">{notice}</p>}
  <div className="settled"><div className="layout l-mode">{stepList}<div className="stepcol">{mode?<div className="s-card cfg-card cfg-away"><p className="muted">Asetukset ovat esikatselun sivupaneelissa.</p></div>:settings(false)}</div></div></div>
  <div className="save"><span>{dirty?'Tallentamattomia muutoksia':'Ei tallentamattomia muutoksia'}</span><Button data-testid="discard" size="row" variant="secondary" isDisabled={!dirty} onPress={()=>{setDraft(saved);setNotice('Luonnos peruttu.');}}>Peru muutokset</Button><Button data-testid="save" size="page" variant="primary" isDisabled={!dirty} onPress={()=>{setSaved(draft);setNotice('Prototyypin malli tallennettu. Oikea palvelin ei muuttunut.');}}>Tallenna käyttöönotto</Button></div>
  <details><summary>Yhteinen käsitteistö suunnittelua varten</summary><pre>{JSON.stringify({onboarding:{repositories:{mode:draft.mode,defaults:draft.repos}}},null,2)}</pre></details>
  <ModalOverlay className="pm-overlay" isOpen={mode} onOpenChange={setMode} isDismissable={false}><Modal className="pm-modal" data-theme={theme}><Dialog className="pm" aria-label="Esikatselu: uuden henkilön näkymä">
   <header className="pm-bar"><span className="pm-title"><Icon name="eye" width={16} height={16}/><strong>Esikatselu</strong><span>Näin uusi henkilö näkee käyttöönoton. Mitään ei tallenneta.</span></span>
    <Segmented data-testid="pv-device" label="Esikatselun laite" size="row" options={[{id:'desktop',label:'Tietokone'},{id:'phone',label:'Puhelin'}]} value={dev} onChange={setDev}/>
    <Button data-testid="pv-restart" size="row" variant="quiet" onPress={()=>setRun(r=>r+1)}>Aloita alusta</Button>
    <Button data-testid="pv-close" size="row" variant="secondary" onPress={()=>setMode(false)}>Sulje esikatselu</Button></header>
   <div className="pm-body"><div className="pm-stage"><DeviceStage device={dev}>{screen}</DeviceStage></div><aside className="pm-drawer" aria-label="Asetuksesi">{settings(true)}{personaPick}<p className="muted">Muutos näkyy esikatselussa heti ja aloittaa sen alusta. Tallenna käyttöönotto -painike on asetussivulla.</p></aside></div>
  </Dialog></Modal></ModalOverlay>
  {picker&&<RepoPicker theme={theme} added={draft.repos} onAdd={n=>{setDraft(d=>d.repos.includes(n)?d:{...d,repos:[...d.repos,n]});setNotice('');}} onClose={()=>setPicker(false)}/>}
 </>;
 return <div data-theme={theme} className={phone?'review phone':'review'}><header className="reviewbar"><strong>Käyttäjät ja pääsy · kierros 6</strong><label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label><label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);setDev(reviewPhone?'phone':'desktop');}}/> 390 px</label><p>Synteettiset tiedot. Ei yhteyttä palvelimeen tai GitHubiin.</p></header>
 <p className="axis">Kolme tapaa näyttää sallitut GitHub-tunnukset ja liittyneet henkilöt: yksi lista tiloineen, kaksi listaa tai lista ja avattava henkilö. Suositus: Yksi lista. Käyttöönotto-välilehden esikatselussa automaattisen haun repot ovat valitsimessa lukittuina.</p>
 <div className="shell"><div className="hostbar"><strong>Open Habitat</strong><span>Northstar · esimerkkisivusto</span><Icon name="user"/></div><section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>{['Tili','Agentit','Integraatiot','Ulkoasu','Editori'].map(n=><span className="s-nav-i" key={n}>{n}</span>)}<span className="s-nav-h">Palvelimen ylläpito</span>{tabs.map(([id,label])=><button type="button" key={id} className="s-nav-i" data-testid={`tab-${id}`} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{label}</button>)}<span className="s-nav-i">Levytila</span></nav><main className="s-main">
 <nav className="mobiletabs" aria-label="Palvelimen ylläpito"><span className="muted">Asetukset › Palvelimen ylläpito</span><div>{tabs.map(([id,label])=><button type="button" key={id} data-testid={`mtab-${id}`} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{label}</button>)}</div></nav>
 {tab==='onboarding'?onboarding:tab==='users'?<UsersTab direction={direction as Direction} people={people} setPeople={setPeople} theme={theme}/>:<ServerTab people={people}/>}
 </main></section></div></div>;
}
const root=createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
// Flush the empty commit so switching (and R) really unmounts the old fixture.
const stageSink={set innerHTML(view:React.ReactNode){flushSync(()=>root.render(view===''?null:view));}};
const variants=directions.map((_,direction)=>()=> <App direction={direction}/>);
const picker=document.createElement('nav');
picker.className='proto-picker';picker.setAttribute('aria-label','Prototype variants');
picker.innerHTML='<span class="proto-picker-highlight" aria-hidden="true"></span>';
// Non-breaking label spaces keep the fixed reference pill single-line at 390 px.
directions.forEach((name,i)=>{const button=document.createElement('button');button.className='proto-picker-item';button.textContent=name.replaceAll(' ',' ');if(i===0){button.setAttribute('data-active','');button.setAttribute('aria-current','true');}picker.append(button);});
document.body.append(picker);
new Function('stage','variants',pickerSource)(stageSink,variants);
