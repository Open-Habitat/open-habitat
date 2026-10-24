import React, {type ReactNode, useEffect, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusMark} from '../../../../web/src/components/Status';
import {IntegrationsOverview, ProviderMark, providerCopy, serviceName} from '../../../../web/src/components/Integrations';
import type {IntegrationList, ProviderId, ServiceId, LoginKind} from '../../../../web/src/app/integrations';
import type {Tone} from '../../../../web/src/components/types';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/Integrations.css';
import './round.css';

// Round 1 of the server administrator's integrations setup: the overview only.
// It shows, for the six catalog entries (internal/daemon/integrations), what is
// ready out of the box, what still needs the site's app credentials, and what
// each state means for people (Settings › Integraatiot) and for the onboarding
// integration steps (Käyttöönotto). The open choice is where the overview lives
// and how it is organised. The guided credential setup is round 2 onwards; here
// the setup button only names what it will ask. Everything is synthetic.
const directions=['Oma välilehti','Tilan mukaan','Osana Palvelinta'];

// ---------- The catalog, as internal/daemon/integrations defines it ----------

type Status='ready'|'needs_app'|'tool_missing'|'saving';
type Entry={id:ProviderId;login:LoginKind;services:ServiceId[];tools:string[];app?:{what:string;where:string;fields:[string,string][]};person:string};
// Order and services as catalog_linux.go's providerOrder and each entry's Services().
const catalog:Entry[]=[
 {id:'google',login:'pasted_redirect',services:['drive','mail','calendar','contacts'],tools:['gog','rclone'],
  app:{what:'OAuth-asiakas, tyyppi työpöytäsovellus',where:'Google Cloud Console',fields:[['Client ID','…apps.googleusercontent.com'],['Client secret','GOCSPX-…']]},
  person:'Kirjautuu Googleen ja liittää paluuosoitteen takaisin.'},
 {id:'microsoft',login:'device_code',services:['onedrive','sharepoint','mail','calendar','contacts'],tools:['rclone','ms-365-mcp-server','pi','microsoft-native'],
  app:{what:'Sovellusrekisteröinti, julkinen asiakas',where:'Microsoft Entra',fields:[['Sovelluksen (client) id','00000000-0000-…'],['Kirjautujat','common, organizations, consumers tai oma tenant-id']]},
  person:'Kirjautuu Microsoftiin lyhyellä laitekoodilla.'},
 {id:'imap',login:'app_password',services:['mail'],tools:['himalaya'],person:'Syöttää postipalvelimen osoitteen ja sovellussalasanan.'},
 {id:'caldav',login:'app_password',services:['calendar'],tools:['curl'],person:'Syöttää HTTPS-DAV-osoitteen ja sovellussalasanan.'},
 {id:'carddav',login:'app_password',services:['contacts'],tools:['curl'],person:'Syöttää HTTPS-DAV-osoitteen ja sovellussalasanan.'},
 {id:'dropbox',login:'pasted_redirect',services:['dropbox'],tools:['rclone'],
  app:{what:'Dropbox-sovellus, Scoped access, koko Dropbox',where:'Dropbox App Console',fields:[['App key','…'],['App secret','…']]},
  person:'Kirjautuu Dropboxiin ja liittää paluuosoitteen takaisin.'},
];
const entry=(id:ProviderId)=>catalog.find(e=>e.id===id)!;
const name=(id:ProviderId)=>providerCopy[id].name;
const services=(e:Entry)=>e.services.map(s=>serviceName(e.id,s)).join(' · ');

// ---------- Synthetic server states ----------

type Server='fresh'|'google'|'partial';
const servers:Record<Server,{label:string;hint:string;apps:ProviderId[];missing:string[]}>={
 fresh:{label:'Uusi asennus',hint:'Työkalut tulivat julkaisun mukana. Sovellustunnuksia ei ole vielä asetettu.',apps:[],missing:[]},
 google:{label:'Google asetettu',hint:'Ylläpitäjä on asettanut Googlen tunnukset. Microsoft ja Dropbox puuttuvat.',apps:['google'],missing:[]},
 partial:{label:'Vajaa asennus',hint:'Vanha asennus, josta rclone puuttuu. Integration-tools-always-installed poistaa tämän tilan.',apps:['google'],missing:['rclone']},
};
type App={suffix:string;at:string};
type Site={apps:Partial<Record<ProviderId,App>>;missing:string[];saving:ProviderId[];steps:ProviderId[]};
const siteOf=(s:Server):Site=>({apps:Object.fromEntries(servers[s].apps.map(p=>[p,{suffix:'3f9a',at:'24.10. Kaisa Admin'}])),missing:servers[s].missing,saving:[],steps:['google']});
const statusOf=(site:Site,e:Entry):Status=>site.saving.includes(e.id)?'saving':e.tools.some(t=>site.missing.includes(t))?'tool_missing':e.app&&!site.apps[e.id]?'needs_app':'ready';
const statusText:Record<Status,[string,Tone]>={ready:['Valmiina käyttöön','success'],needs_app:['Tarvitsee sovellustunnukset','warning'],tool_missing:['Työkalu puuttuu','danger'],saving:['Tallennetaan · odottaa palvelinta','info']};
const Mark=({s}:{s:Status})=>{const [label,tone]=statusText[s];return <StatusMark data-testid="ig-status" label={label} tone={tone} animated={s==='saving'?'running':false} kind={s==='ready'?'success':s==='tool_missing'?'error':'neutral'}/>;};

/** What the status means for people, in Settings › Integraatiot. */
function forPeople(site:Site,e:Entry):string{
 const s=statusOf(site,e);
 if(s==='ready')return `Näkyy henkilöille Yhdistä…-painikkeella. ${e.person}`;
 if(s==='saving')return 'Muutos on voimassa, kun palvelin on vahvistanut sen.';
 if(s==='tool_missing')return `Henkilöt näkevät "Ei käytettävissä tällä palvelimella". Puuttuu: ${e.tools.filter(t=>site.missing.includes(t)).map(t=>t).join(', ')}.`;
 return 'Henkilöt näkevät "Ei käytettävissä tällä palvelimella". Yhdistää ei voi, ennen kuin tunnukset on asetettu.';
}
/** What it means for the onboarding integration steps. */
function forOnboarding(site:Site,e:Entry):string{
 const s=statusOf(site,e),step=site.steps.includes(e.id);
 if(step&&s==='ready')return 'Käyttöönoton vaihe. Uusi henkilö voi yhdistää tai ohittaa.';
 if(step)return 'Käyttöönoton vaihe, mutta piilossa uusilta henkilöiltä, kunnes integraatio on valmiina käyttöön.';
 if(s==='ready')return 'Ei käyttöönotossa. Voit lisätä sen vaiheeksi Käyttöönotto-välilehdellä.';
 return 'Ei käyttöönotossa. Vaiheeksi voi lisätä vasta, kun integraatio on valmiina käyttöön.';
}
const NoAdmin=()=><span className="muted">Ei ylläpitäjän asetuksia. Jokainen yhdistää oman tilinsä.</span>;

// ---------- Actions: the round-2 placeholder and removal ----------

type Act={kind:'setup'|'remove'|'tool';id:ProviderId}|null;
function ActDialog({act,site,theme,onClose,onSave,onRemove}:{act:NonNullable<Act>;site:Site;theme:string;onClose:()=>void;onSave:(id:ProviderId)=>void;onRemove:(id:ProviderId)=>void}){
 const e=entry(act.id),replace=!!site.apps[e.id];
 const body=act.kind==='tool'?<>
  <Heading slot="title">{name(e.id)}: työkalu puuttuu</Heading>
  <p>Integraation työkalut tulevat julkaisun mukana, ja <code>open-habitat host apply</code> kirjoittaa niiden polut. Tämä tila tarkoittaa, että asennus on vajaa tai sitä on muutettu käsin.</p>
  <p>Palvelimelta puuttuu: {e.tools.filter(t=>site.missing.includes(t)).map(t=><code key={t}>{t}</code>)}. Aja palvelimella pääkäyttäjänä:</p>
  <pre className="cmd">sudo open-habitat host apply --site /etc/open-habitat/site.json</pre>
  <p className="muted">Selain ei asenna ohjelmia eikä muuta asennusta.</p>
  <div className="dlg-foot"><Button size="page" variant="primary" onPress={onClose}>Sulje</Button></div></>
 :act.kind==='remove'?<>
  <Heading slot="title">Poistetaanko {name(e.id)} -tunnukset?</Heading>
  <ul className="consequences"><li>Henkilöt eivät voi yhdistää uusia {name(e.id)}-tilejä. Ruutu näyttää "Ei käytettävissä tällä palvelimella".</li><li>Jo yhdistetyt tilit näkyvät henkilöillä edelleen, mutta niihin ei voi kirjautua uudelleen.</li>{site.steps.includes(e.id)&&<li>Käyttöönoton {name(e.id)}-vaihe piilotetaan uusilta henkilöiltä.</li>}<li>Sovellus jää {e.app!.where}en. Poista se sieltä, jos et tarvitse sitä.</li></ul>
  <div className="dlg-foot"><Button size="row" variant="secondary" onPress={onClose}>Peruuta</Button><Button data-testid="confirm-remove" size="page" variant="danger" onPress={()=>onRemove(e.id)}>Poista tunnukset</Button></div></>
 :<>
  <Heading slot="title">{name(e.id)}: {replace?'vaihda sovellustunnukset':'aseta sovellustunnukset'}</Heading>
  <p>Ohjattu asetus tehdään seuraavalla kierroksella. Se neuvoo luomaan palvelussa {e.app!.where} sovelluksen ({e.app!.what}) ja kysyy:</p>
  <dl className="fields">{e.app!.fields.map(([k,v])=><div key={k}><dt>{k}</dt><dd><code>{v}</code></dd></div>)}</dl>
  {replace&&<p className="warn-line"><Icon name="warning" width={16} height={16}/><span>Uusi sovellus koskee uusia kirjautumisia. Jo yhdistettyjen tilien täytyy ehkä kirjautua uudelleen.</span></p>}
  <p className="proto-note">Prototyypissä painike tallentaa keksityt tunnukset 0,9 sekunnin viiveellä.</p>
  <div className="dlg-foot"><Button size="row" variant="secondary" onPress={onClose}>Peruuta</Button><Button data-testid="simulate-save" size="page" variant="primary" onPress={()=>onSave(e.id)}>Simuloi: tunnukset tallennettu</Button></div></>;
 return <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={o=>!o&&onClose()}><Modal className="ah-modal act-modal" data-theme={theme}><Dialog className="ah-dialog act-dialog" data-testid="act-dialog" data-kind={act.kind} aria-label={name(e.id)}>{body}</Dialog></Modal></ModalOverlay>;
}

function Actions({site,e,on}:{site:Site;e:Entry;on:(a:Act)=>void}){
 const s=statusOf(site,e);
 if(s==='saving')return null;
 if(s==='tool_missing')return <Button data-testid={`tool-${e.id}`} size="row" variant="secondary" onPress={()=>on({kind:'tool',id:e.id})}>Miten korjataan…</Button>;
 if(!e.app)return null;
 if(!site.apps[e.id])return <Button data-testid={`setup-${e.id}`} size="row" variant="primary" onPress={()=>on({kind:'setup',id:e.id})}>Aseta tunnukset…</Button>;
 return <span className="row-acts"><Button data-testid={`replace-${e.id}`} size="row" variant="quiet" onPress={()=>on({kind:'setup',id:e.id})}>Vaihda…</Button><Button data-testid={`remove-${e.id}`} size="row" variant="quiet" aria-label={`Poista ${name(e.id)} -tunnukset`} onPress={()=>on({kind:'remove',id:e.id})}><Icon name="trash" width={14} height={14}/>Poista</Button></span>;
}
const AppLine=({site,e}:{site:Site;e:Entry})=>e.app&&site.apps[e.id]?<span className="muted app-line" data-testid={`app-${e.id}`}>{e.app.where} · client id <code>…{site.apps[e.id]!.suffix}</code> · asetettu {site.apps[e.id]!.at}</span>:null;

// ---------- Direction 1: its own tab, one row per provider ----------

function ByProvider({site,on}:{site:Site;on:(a:Act)=>void}){
 return <ul className="ig-admin s-card" data-testid="ig-rows">{catalog.map(e=>{const s=statusOf(site,e);return <li key={e.id} className="ia-row" data-testid={`row-${e.id}`} data-status={s}>
  <ProviderMark provider={e.id}/>
  <div className="ia-main"><div className="ia-head"><span className="ig-rn">{name(e.id)}</span><Mark s={s}/></div>
   <span className="ig-meta">{services(e)}</span>
   <AppLine site={site} e={e}/>
   <dl className="ia-means"><div><dt>Henkilöille</dt><dd data-testid={`people-${e.id}`}>{forPeople(site,e)}</dd></div><div><dt>Käyttöönotossa</dt><dd data-testid={`onb-${e.id}`}>{forOnboarding(site,e)}</dd></div></dl>
   {!e.app&&s==='ready'&&<NoAdmin/>}
  </div>
  <div className="ia-act"><Actions site={site} e={e} on={on}/></div>
 </li>;})}</ul>;
}

// ---------- Direction 2: its own tab, grouped by what the admin must do ----------

function ByStatus({site,on}:{site:Site;on:(a:Act)=>void}){
 const group=(st:Status[])=>catalog.filter(e=>st.includes(statusOf(site,e)));
 const fix=group(['tool_missing']),todo=group(['needs_app','saving']),ready=group(['ready']);
 const readyNoAdmin=ready.filter(e=>!e.app),readyApp=ready.filter(e=>e.app);
 const card=(e:Entry)=>{const s=statusOf(site,e);return <li key={e.id} className="ib-card s-card" data-testid={`row-${e.id}`} data-status={s}>
  <div className="ib-top"><ProviderMark provider={e.id}/><div className="ia-main"><span className="ig-rn">{name(e.id)}</span><Mark s={s}/><span className="ig-meta">{services(e)}</span></div></div>
  {s==='needs_app'&&e.app&&<p className="ib-need"><strong>Tarvitaan:</strong> {e.app.what} ({e.app.where}). Kysytään {e.app.fields.map(f=>f[0]).join(' ja ')}.</p>}
  <AppLine site={site} e={e}/>
  <dl className="ia-means"><div><dt>Henkilöille</dt><dd data-testid={`people-${e.id}`}>{forPeople(site,e)}</dd></div><div><dt>Käyttöönotossa</dt><dd data-testid={`onb-${e.id}`}>{forOnboarding(site,e)}</dd></div></dl>
  <div className="ib-act"><Actions site={site} e={e} on={on}/></div></li>;};
 return <div className="ib" data-testid="ig-groups">
  {fix.length>0&&<section aria-label="Korjattavaa"><h3 className="ib-h">Korjattavaa <span className="count">{fix.length}</span></h3><p className="muted">Ei pitäisi esiintyä: työkalut tulevat julkaisun mukana.</p><ul className="ib-list">{fix.map(card)}</ul></section>}
  {todo.length>0&&<section aria-label="Tarvitsee sovellustunnukset"><h3 className="ib-h">Tarvitsee sovellustunnukset <span className="count">{todo.length}</span></h3><p className="muted">Organisaatio rekisteröi palveluun oman sovelluksen kerran. Sen jälkeen jokainen henkilö kirjautuu omalla tilillään.</p><ul className="ib-list">{todo.map(card)}</ul></section>}
  <section aria-label="Valmiina käyttöön"><h3 className="ib-h">Valmiina käyttöön <span className="count">{ready.length}</span></h3>
   {readyApp.length>0&&<ul className="ib-list">{readyApp.map(card)}</ul>}
   {readyNoAdmin.length>0&&<div className="s-card ib-plain" data-testid="ready-plain"><ul>{readyNoAdmin.map(e=><li key={e.id} data-testid={`row-${e.id}`} data-status="ready"><ProviderMark provider={e.id} small/><span className="ig-rn">{name(e.id)}</span><span className="muted">{e.person}</span><span className="muted" data-testid={`onb-${e.id}`}>{site.steps.includes(e.id)?'Käyttöönoton vaihe':'Ei käyttöönotossa'}</span></li>)}</ul><p className="muted">Näitä ei tarvitse asettaa. Ne näkyvät kaikille Asetukset › Integraatiot -sivulla.</p></div>}
  </section>
 </div>;
}

// ---------- Direction 3: a section of the Palvelin tab ----------

function OnServerTab({site,on}:{site:Site;on:(a:Act)=>void}){
 return <section className="ic" aria-label="Integraatiot" data-testid="ig-section"><h3 className="ic-h">Integraatiot</h3><p className="muted">Palvelut, joihin henkilöt voivat yhdistää omat tilinsä.</p>
  <div className="s-card ic-table"><div className="ic-tr ic-th" aria-hidden="true"><span>Palvelu</span><span>Tila</span><span>Henkilöille</span><span/></div>
   {catalog.map(e=>{const s=statusOf(site,e);return <div key={e.id} className="ic-tr" data-testid={`row-${e.id}`} data-status={s}>
    <span className="ic-name"><ProviderMark provider={e.id} small/><span><span className="ig-rn">{name(e.id)}</span>{site.steps.includes(e.id)&&<span className="ic-step" data-testid={`onb-${e.id}`}>Käyttöönoton vaihe{s!=='ready'?' · piilossa':''}</span>}</span></span>
    <span><Mark s={s}/></span>
    <span className="muted" data-testid={`people-${e.id}`}>{s==='ready'?(e.app?'Yhdistää omalla tilillään':'Osoite ja sovellussalasana'):s==='saving'?'Odottaa palvelinta':'Ei voi yhdistää'}</span>
    <span className="ic-act"><Actions site={site} e={e} on={on}/></span></div>;})}
  </div>
  <p className="muted">Käyttöönoton vaihe näkyy uusille henkilöille vain, kun integraatio on valmiina käyttöön.</p></section>;
}

// ---------- The person's Settings › Integraatiot, production component ----------

function PersonView({site,theme,onClose}:{site:Site;theme:string;onClose:()=>void}){
 const list:IntegrationList={schema_version:1,accounts:[],skill:'none',providers:catalog.map(e=>({id:e.id,available:statusOf(site,e)==='ready',login:e.login,services:e.services}))};
 const noop=()=>{};
 return <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={o=>!o&&onClose()}><Modal className="ah-modal pv-modal" data-theme={theme}><Dialog className="ah-dialog pv-dialog" data-testid="person-view" aria-label="Henkilön näkymä: Asetukset › Integraatiot">
  <header className="pv-bar"><Icon name="eye" width={16} height={16}/><strong>Henkilön näkymä</strong><span className="muted">Asetukset › Integraatiot uudella henkilöllä, jolla ei ole vielä tilejä.</span><Button data-testid="pv-close" size="row" variant="secondary" onPress={onClose}>Sulje</Button></header>
  <div className="pv-page"><h2>Integraatiot</h2><IntegrationsOverview list={list} checking={new Set()} onCheck={noop} onConnect={noop} onSignInAgain={noop} onRemove={noop}/></div>
 </Dialog></Modal></ModalOverlay>;
}

// ---------- Käyttöönotto: just the integration steps, to show the link ----------

function OnboardingTab({site,setSite,goto}:{site:Site;setSite:(f:(s:Site)=>Site)=>void;goto:()=>void}){
 const [adding,setAdding]=useState(false);
 const addable=catalog.filter(e=>!site.steps.includes(e.id));
 return <><h2>Käyttöönotto</h2><p className="lede">Kierros näyttää tästä välilehdestä vain integraatiovaiheet. Muu välilehti on kierroksen 6 mukainen.</p>
  <div className="s-card onb-steps"><p className="eyebrow">Integraatiovaiheet</p><ul data-testid="onb-steps">{site.steps.map(id=>{const e=entry(id),s=statusOf(site,e);return <li key={id} data-testid={`onb-step-${id}`} data-status={s}><ProviderMark provider={id} small/><span className="ig-rn">{name(id)}</span>{s==='ready'?<span className="muted">Voi ohittaa</span>:<span className="hidden-step"><StatusMark label="Piilossa uusilta henkilöiltä" tone="warning"/><button type="button" className="linkish" onClick={goto}>{statusText[s][0]}</button></span>}<Button size="row" variant="quiet" aria-label={`Poista vaihe ${name(id)}`} onPress={()=>setSite(x=>({...x,steps:x.steps.filter(p=>p!==id)}))}><Icon name="cross" width={14} height={14}/></Button></li>;})}</ul>
   {!site.steps.length&&<p className="muted">Ei integraatiovaiheita.</p>}
   <Button data-testid="onb-add" size="row" variant="secondary" onPress={()=>setAdding(v=>!v)}><Icon name="plus" width={14} height={14}/>Lisää integraatio</Button>
   {adding&&<ul className="onb-add" data-testid="onb-add-list">{addable.map(e=>{const s=statusOf(site,e);return <li key={e.id}><ProviderMark provider={e.id} small/><span className="ig-rn">{name(e.id)}</span>{s==='ready'?<Button data-testid={`onb-add-${e.id}`} size="row" variant="quiet" onPress={()=>{setSite(x=>({...x,steps:[...x.steps,e.id]}));setAdding(false);}}>Lisää</Button>:<span className="muted" data-testid={`onb-blocked-${e.id}`}>{statusText[s][0]}</span>}</li>;})}</ul>}
  </div></>;
}

// ---------- The page ----------

type Tab='server'|'integrations'|'onboarding'|'users';
let reviewTheme='light',reviewPhone=false,reviewServer:Server='fresh';
function App({direction}:{direction:number}){
 const [theme,setTheme]=useState(reviewTheme),[phone,setPhone]=useState(reviewPhone);
 const [server,setServer]=useState<Server>(reviewServer);
 const [site,setSite]=useState<Site>(()=>siteOf(reviewServer));
 const inServer=direction===2;
 const [tab,setTab]=useState<Tab>(inServer?'server':'integrations');
 const [act,setAct]=useState<Act>(null),[person,setPerson]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{if(inServer&&tab==='integrations')setTab('server');},[inServer,tab]);
 const tabs:[Tab,string][]=inServer?[['server','Palvelin'],['onboarding','Käyttöönotto'],['users','Käyttäjät ja pääsy']]:[['server','Palvelin'],['integrations','Integraatiot'],['onboarding','Käyttöönotto'],['users','Käyttäjät ja pääsy']];
 const save=(id:ProviderId)=>{setAct(null);setNotice('');setSite(s=>({...s,saving:[...s.saving,id]}));setTimeout(()=>{setSite(s=>({...s,saving:s.saving.filter(p=>p!==id),apps:{...s.apps,[id]:{suffix:'b71c',at:'24.10. Kaisa Admin'}}}));setNotice(`${name(id)}: palvelin vahvisti tunnukset. Prototyypin malli, oikea palvelin ei muuttunut.`);},900);};
 const remove=(id:ProviderId)=>{setAct(null);setSite(s=>({...s,saving:[...s.saving,id]}));setTimeout(()=>{setSite(s=>{const apps={...s.apps};delete apps[id];return {...s,saving:s.saving.filter(p=>p!==id),apps};});setNotice(`${name(id)}: tunnukset poistettu.`);},900);};
 const counts=(['ready','needs_app','tool_missing'] as Status[]).map(st=>[st,catalog.filter(e=>statusOf(site,e)===st).length] as const).filter(([,n])=>n>0);
 const lead=<p className="lede">Mitkä palvelut henkilöt voivat yhdistää omiin tileihinsä. Sähköposti, kalenteri ja yhteystiedot toimivat heti. Google, Microsoft 365 ja Dropbox tarvitsevat organisaation oman sovelluksen tunnukset, jotka asetetaan kerran.</p>;
 const authority=<p className="authority" data-testid="authority"><Icon name="server" width={16} height={16}/><span>Palvelin tallentaa tunnukset. Selain lähettää ne pyyntönä, ja muutos on voimassa, kun palvelin on vahvistanut sen. Tallennettua salaisuutta ei näytetä uudelleen.</span></p>;
 const personBtn=<Button data-testid="pv-open" size="page" variant="secondary" onPress={()=>setPerson(true)}><Icon name="eye" width={16} height={16}/>Näytä henkilön näkymä</Button>;
 const summary=<p className="ia-sum" data-testid="ig-summary">{counts.map(([st,n])=><span key={st}><Mark s={st}/> {n}</span>)}</p>;
 const view=direction===0?<ByProvider site={site} on={setAct}/>:direction===1?<ByStatus site={site} on={setAct}/>:<OnServerTab site={site} on={setAct}/>;
 const integrations=<><div className="tab-head"><div><h2>Integraatiot</h2>{lead}</div>{personBtn}</div>{authority}{notice&&<p role="status" className="notice" data-testid="notice">{notice}</p>}{direction===0&&summary}{view}</>;
 const serverTab=<><h2>Palvelin</h2><div className="facts s-card"><div className="s-row"><strong>Northstar</strong><code>habitat.example.test</code></div><div className="s-row"><strong>Versio</strong><code>v0.0.0-prototype</code></div><div className="s-row"><strong>Oletuslevytila</strong><span>20 Gt / henkilö</span></div></div>
  {inServer&&<>{notice&&<p role="status" className="notice" data-testid="notice">{notice}</p>}<div className="tab-head ic-top">{authority}{personBtn}</div>{view}</>}</>;
 return <div data-theme={theme} className={phone?'review phone':'review'}><header className="reviewbar"><strong>Palvelimen integraatiot · kierros 1</strong><label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label><label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);}}/> 390 px</label><p>Synteettiset tiedot. Ei yhteyttä palvelimeen.</p></header>
 <div className="scenario"><span className="muted">Esimerkkipalvelin</span><Segmented data-testid="server" label="Esimerkkipalvelin" size="row" options={(Object.keys(servers) as Server[]).map(s=>({id:s,label:servers[s].label}))} value={server} onChange={s=>{reviewServer=s;setServer(s);setSite(siteOf(s));setNotice('');}}/><span className="muted" data-testid="server-hint">{servers[server].hint}</span></div>
 <p className="axis">Missä ylläpitäjän integraatioyleiskuva on ja miten se on järjestetty: oma välilehti palveluittain, oma välilehti tilan mukaan tai osio Palvelin-välilehdellä. Suositus: Oma välilehti.</p>
 <div className={`shell variant-${direction}`}><div className="hostbar"><strong>Open Habitat</strong><span>Northstar · esimerkkisivusto</span><Icon name="user"/></div><section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>{['Tili','Agentit','Integraatiot','Ulkoasu','Editori'].map(n=><span className="s-nav-i" key={n}>{n}</span>)}<span className="s-nav-h">Palvelimen ylläpito</span>{tabs.map(([id,label])=><button type="button" key={id} className="s-nav-i" data-testid={`tab-${id}`} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{label}</button>)}<span className="s-nav-i">Levytila</span></nav><main className="s-main">
 <nav className="mobiletabs" aria-label="Palvelimen ylläpito"><span className="muted">Asetukset › Palvelimen ylläpito</span><div>{tabs.map(([id,label])=><button type="button" key={id} data-testid={`mtab-${id}`} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{label}</button>)}</div></nav>
 {tab==='integrations'?integrations:tab==='onboarding'?<OnboardingTab site={site} setSite={setSite} goto={()=>setTab(inServer?'server':'integrations')}/>:tab==='users'?<><h2>Käyttäjät ja pääsy</h2><p className="muted">Kierroksen 6 mukainen. Ei tämän kierroksen aihe.</p></>:serverTab}
 </main></section></div>
 {act&&<ActDialog act={act} site={site} theme={theme} onClose={()=>setAct(null)} onSave={save} onRemove={remove}/>}
 {person&&<PersonView site={site} theme={theme} onClose={()=>setPerson(false)}/>}
 </div>;
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
directions.forEach((n,i)=>{const button=document.createElement('button');button.className='proto-picker-item';button.textContent=n.replaceAll(' ','\u00a0');if(i===0){button.setAttribute('data-active','');button.setAttribute('aria-current','true');}picker.append(button);});
document.body.append(picker);
new Function('stage','variants',pickerSource)(stageSink,variants);
