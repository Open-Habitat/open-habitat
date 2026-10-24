import React, {useEffect, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, ExternalLink, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {Menu} from '../../../../web/src/components/Overlays';
import {TextField} from '../../../../web/src/components/Primitives';
import {Badge, StatusMark} from '../../../../web/src/components/Status';
import {ProviderMark, providerCopy} from '../../../../web/src/components/Integrations';
import type {ProviderId} from '../../../../web/src/app/integrations';
import type {Tone} from '../../../../web/src/components/types';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/Integrations.css';
import './round.css';

// Round 5 of the server administrator's integrations setup: what "Aseta
// tunnukset…" on the Dropbox row opens, in round 3's Vaiheittain form with
// round 4's verdicts (values asked last, a direct link to the console page,
// removal only when there is no secret to renew). Every console step comes
// from Dropbox's documentation (cited in the issue's result.md) and every
// value from internal/daemon/integrations/dropbox_linux.go. The one real
// Dropbox-specific choice is where the app's Development status is handled:
// a new app links only its owner until "Enable additional users", and after
// 50 linked users Dropbox wants a production application within two weeks.
// Everything is synthetic.
const directions=['Käyttäjävaihe','Sivu kerrallaan'];

// ---------- What the daemon's Dropbox integration actually needs ----------

// dropboxScopes, in request order. The authorization URL asks for all of them,
// so each must be enabled on the app. They are user scopes: no team app.
const SCOPES=['account_info.read','files.metadata.read','files.metadata.write','files.content.read','files.content.write','sharing.read','sharing.write'];
const REDIRECT='http://localhost:53682/'; // dropboxRedirect, matched exactly
const CREATE='https://www.dropbox.com/developers/apps/create';
const VALUE=/^[A-Za-z0-9_-]{1,256}$/; // dropboxApp()'s check, for both values

// ---------- The catalog and synthetic servers (as rounds 2–4) ----------

type Status='ready'|'needs_app'|'tool_missing'|'saving';
type Entry={id:ProviderId;tools:string[];app?:{where:string;key:string}};
const catalog:Entry[]=[
 {id:'google',tools:['gog','rclone'],app:{where:'Google Cloud',key:'client id'}},
 {id:'microsoft',tools:['rclone','ms-365-mcp-server'],app:{where:'Microsoft Entra',key:'client id'}},
 {id:'imap',tools:['himalaya']},
 {id:'caldav',tools:['curl']},
 {id:'carddav',tools:['curl']},
 {id:'dropbox',tools:['rclone'],app:{where:'Dropbox App Console',key:'app key'}},
];
const entry=(id:ProviderId)=>catalog.find(e=>e.id===id)!;
const name=(id:ProviderId)=>providerCopy[id].name;
const FIX='sudo open-habitat host apply --site /etc/open-habitat/site.json';

type Server='microsoft'|'dropbox'|'partial';
const G_ID='704213598812-k3v9q2mfa0b7s1dn5e8rjhtc4lpu6xwo.apps.googleusercontent.com';
const M_ID='3f2a91c4-7d0e-4b6a-9c15-e8a4b2d7f031',D_KEY='k7q2xw9rmd4hz1p';
const servers:Record<Server,{label:string;hint:string;apps:ProviderId[];missing:string[]}>={
 microsoft:{label:'Microsoft asetettu',hint:'Googlen ja Microsoftin tunnukset asetettu, Dropbox puuttuu.',apps:['google','microsoft'],missing:[]},
 dropbox:{label:'Kaikki asetettu',hint:'Googlen, Microsoftin ja Dropboxin tunnukset asetettu.',apps:['google','microsoft','dropbox'],missing:[]},
 partial:{label:'Vajaa asennus',hint:'Vanha asennus, josta rclone puuttuu.',apps:['google'],missing:['rclone']},
};
// The app key is public (it is in every authorization URL); the secret never returns.
type App={clientId:string;at:string};
type Site={apps:Partial<Record<ProviderId,App>>;missing:string[];saving:ProviderId[];steps:ProviderId[]};
const appOf=(p:ProviderId):App=>({clientId:p==='microsoft'?M_ID:p==='dropbox'?D_KEY:G_ID,at:'24.10. Kaisa Admin'});
const siteOf=(s:Server):Site=>({apps:Object.fromEntries(servers[s].apps.map(p=>[p,appOf(p)])),missing:servers[s].missing,saving:[],steps:['google','microsoft','dropbox']});
const statusOf=(site:Site,e:Entry):Status=>site.saving.includes(e.id)?'saving':e.tools.some(t=>site.missing.includes(t))?'tool_missing':e.app&&!site.apps[e.id]?'needs_app':'ready';
const missingOf=(site:Site,e:Entry)=>e.tools.filter(t=>site.missing.includes(t));
const kindOf=(s:Status)=>s==='ready'?'success':s==='tool_missing'?'error':'neutral';
const Mark=({site,e}:{site:Site;e:Entry})=>{
 const s=statusOf(site,e);
 const [label,tone]=({ready:['Käytössä','success'],needs_app:['Ei käytössä','warning'],tool_missing:[`Ei käytössä · ${missingOf(site,e).join(', ')} puuttuu`,'danger'],saving:['Odottaa palvelinta','info']} as Record<Status,[string,Tone]>)[s];
 return <StatusMark data-testid="ig-status" label={label} tone={tone} animated={s==='saving'?'running':false} kind={kindOf(s)}/>;
};
// Google: the project number. Microsoft: a GUID's first group. Dropbox: four characters.
const shortId=(p:ProviderId,id:string)=>(p==='dropbox'?id.slice(0,4):id.split('-')[0])+'…';
// Direction 2 keeps Dropbox's 50-user rule where an administrator returns: the row's menu.
const LIMIT_NOTE='Kehitystila: kun 50 henkilöä on yhdistänyt, hae tuotantotilaa kahden viikon kuluessa.';
const AppLine=({site,e,note}:{site:Site;e:Entry;note:boolean})=>e.app&&site.apps[e.id]?<span className="r2-app" data-testid={`app-${e.id}`}>{e.app.where} · {e.app.key} <code>{shortId(e.id,site.apps[e.id]!.clientId)}</code> · {site.apps[e.id]!.at}{note&&e.id==='dropbox'&&<span className="r5-menunote" data-testid="limit-note">{LIMIT_NOTE}</span>}</span>:null;

// ---------- Small shared pieces (as rounds 3–4) ----------

function Copy({value,label}:{value:string;label:string}){
 const [done,setDone]=useState(false);
 const copy=async()=>{try{await navigator.clipboard.writeText(value);}catch{/* the value stays selectable */}setDone(true);setTimeout(()=>setDone(false),1400);};
 return <Button size="row" variant="quiet" aria-label={`Kopioi ${label}`} data-testid="copy" onPress={()=>void copy()}><Icon name={done?'check':'copy'} width={14} height={14}/></Button>;
}
const Val=({k,v,copy=true,testId}:{k:string;v:string;copy?:boolean;testId?:string})=><div className="r3-val" data-testid={testId}><span className="r3-k">{k}</span><code>{v}</code>{copy&&<Copy value={v} label={k}/>}</div>;
const Path=({p,testId}:{p:string;testId?:string})=><p className="r3-path" data-testid={testId}><Icon name="forward" width={12} height={12}/><span>{p}</span></p>;
const Role=({children}:{children:React.ReactNode})=><p className="r3-quiet r4-role" data-testid="role"><Icon name="user" width={12} height={12}/><span>{children}</span></p>;

function FixCommand(){
 return <div className="r2-fix" data-testid="fix-command"><pre className="cmd">{FIX}</pre><Copy value={FIX} label="komento"/></div>;
}
function StepBadge({site,e,goto}:{site:Site;e:Entry;goto:()=>void}){
 if(!site.steps.includes(e.id))return null;
 const hidden=statusOf(site,e)!=='ready';
 return <button type="button" className="r2-step" data-testid={`onb-${e.id}`} data-hidden={hidden||undefined} onClick={goto} aria-label={`Käyttöönotto: ${name(e.id)}-vaihe${hidden?', piilossa':''}`}><Badge label={hidden?'Käyttöönotossa · piilossa':'Käyttöönotossa'} tone={hidden?'warning':'neutral'}/></button>;
}

// ---------- The guide's content, shared by both directions ----------

type Form={key:string;setKey:(v:string)=>void;secret:string;setSecret:(v:string)=>void;
 errors:{key?:string;secret?:string};pending:boolean;submit:()=>void};
type Step={id:string;title:string;body:(f:Form)=>React.ReactNode};

const CREATE_STEP:Step={id:'create',title:'Luo sovellus',body:()=><>
 <ExternalLink className="r5-console" href={CREATE} target="_blank" rel="noreferrer" data-testid="console-link">Avaa Dropbox App Console <Icon name="external" width={12} height={12}/></ExternalLink>
 <Val k="Choose an API" v="Scoped access" copy={false} testId="api"/>
 <Val k="Choose the type of access you need" v="Full Dropbox" copy={false} testId="access"/>
 <p className="r3-quiet" data-testid="full-why">Henkilöt synkronoivat koko Dropboxinsa, joten App folder ei riitä.</p>
 <Val k="Name your app" v="Open Habitat <organisaatio>" copy={false} testId="app-name"/>
 <p className="r3-quiet">Nimen on oltava yksilöllinen, eikä siinä saa olla sanaa Dropbox. Valitse <em>Create app</em>.</p>
 <Role>Sovellus kuuluu tilille, jolla luot sen. Käytä organisaation Dropbox-tiliä.</Role>
</>};
const RedirectBlock=()=><>
 <Path p="Settings › OAuth 2 › Redirect URIs"/>
 <Val k="Redirect URI" v={REDIRECT} testId="redirect"/>
 <p className="r3-quiet">Valitse <em>Add</em>. Osoite on oltava täsmälleen tämä, kauttaviiva mukaan.</p>
</>;
const EnableUsers=()=><>
 <Path p="Settings › Development users › Enable additional users" testId="enable-users"/>
 <p className="r3-quiet" data-testid="owner-only">Uusi sovellus on kehitystilassa (Development), ja ilman tätä vain sovelluksen omistaja voi yhdistää.</p>
</>;
const REDIRECT_STEP:Step={id:'redirect',title:'Uudelleenohjaus',body:()=><RedirectBlock/>};
const SETTINGS_STEP:Step={id:'settings',title:'Asetukset',body:()=><><RedirectBlock/><EnableUsers/></>};
const PERMISSIONS:Step={id:'permissions',title:'Käyttöoikeudet',body:()=><>
 <Path p="Permissions"/>
 <div className="r3-scopes" data-testid="permissions"><pre className="cmd">{SCOPES.join('\n')}</pre><Copy value={SCOPES.join(' ')} label="käyttöoikeudet"/></div>
 <p className="r3-quiet" data-testid="find">account_info.read on valmiina. Löydät muut selaimen haulla (Ctrl+F tai ⌘F). Valitse lopuksi <em>Submit</em>.</p>
 <p className="r3-quiet" data-testid="scopes-now">Myöhempi muutos ei koske jo yhdistettyjä tilejä.</p>
</>};
const USERS:Step={id:'users',title:'Käyttäjät',body:()=><>
 <EnableUsers/>
 <div className="r5-limit" data-testid="limit">
  <span className="r3-k">Kehitystilassa enintään 500 henkilöä.</span>
  <span className="r3-quiet">Kun 50 on yhdistänyt, hae tuotantotilaa kahden viikon kuluessa sovelluksen sivulta. Muuten uudet yhdistämiset jäädytetään.</span>
 </div>
</>};

function Fields({f}:{f:Form}){
 return <div className="r3-fields" data-testid="fields">
  <TextField data-testid="app-key" label="App key" mono value={f.key} onChange={f.setKey} error={f.errors.key}/>
  <label className="s-field ig-password r3-secret"><span>App secret</span><input type="password" data-testid="app-secret" autoComplete="new-password" value={f.secret} maxLength={256} aria-invalid={!!f.errors.secret||undefined} onChange={e=>f.setSecret(e.target.value)}/>{f.errors.secret&&<span className="r3-err" role="alert">{f.errors.secret}</span>}</label>
 </div>;
}
const ENTER:Step={id:'enter',title:'Tunnukset',body:f=><><Path p="Settings › App key ja App secret (Show)"/><Fields f={f}/></>};

function useForm(onSave:(a:App)=>void):Form{
 const [key,setKey]=useState(''),[secret,setSecret]=useState('');
 const [errors,setErrors]=useState<Form['errors']>({}),[pending,setPending]=useState(false);
 const submit=()=>{
  const k=key.trim(),s=secret.trim(),e:Form['errors']={};
  if(!VALUE.test(k))e.key='Tarkista App key.';
  if(!VALUE.test(s))e.secret='Tarkista App secret.';
  else if(s===k)e.secret='Tämä on sama kuin App key.';
  setErrors(e);if(e.key||e.secret)return;
  setPending(true);onSave({clientId:k,at:'24.10. Kaisa Admin'});
 };
 const edit=(set:(v:string)=>void,k:keyof Form['errors'])=>(v:string)=>{set(v);setErrors(e=>({...e,[k]:undefined}));};
 return {key,setKey:edit(setKey,'key'),secret,setSecret:edit(setSecret,'secret'),errors,pending,submit};
}
type GuideProps={theme:string;onClose:()=>void;onSave:(a:App)=>void;pending:boolean};

// ---------- Both directions: round 3's Vaiheittain stepper ----------

// Direction 1 gives Development status its own step, with the 50/500 limits.
// Direction 2 takes one console page per step (Enable additional users sits on
// the Settings page beside the redirect) and keeps the 50-user rule in the
// row's menu afterwards, where it matters months later.
const ORDER=[[CREATE_STEP,REDIRECT_STEP,PERMISSIONS,USERS,ENTER],[CREATE_STEP,SETTINGS_STEP,PERMISSIONS,ENTER]];

function Stepper({direction,theme,onClose,onSave,pending}:GuideProps&{direction:number}){
 const f=useForm(onSave);f.pending=pending;
 const [skipped,setSkipped]=useState(false);
 const all=skipped?[ENTER]:ORDER[direction]!;
 const [at,setAt]=useState(0),i=Math.min(at,all.length-1),last=i===all.length-1,s=all[i]!;
 return <ModalOverlay className="ah-overlay" isOpen isDismissable={!pending} onOpenChange={o=>!o&&onClose()}><Modal className="ah-modal r3-modal r3-narrow" data-theme={theme}><Dialog className="ah-dialog r3-dialog" data-testid="guide" data-direction={direction===0?'users-step':'per-page'} aria-label="Dropbox: aseta tunnukset">
  <Heading slot="title">Dropbox: aseta tunnukset</Heading>
  <div className="r3-progress" data-testid="progress" aria-label={`Vaihe ${i+1}/${all.length}`}>{all.map((x,j)=><span key={x.id} data-done={j<i||undefined} data-current={j===i||undefined}/>)}</div>
  <p className="r3-stepname" data-testid="stepname"><span className="muted">{i+1}/{all.length}</span> {s.title}</p>
  <div className="r3-stepbody" data-testid={`step-${s.id}`}>{s.body(f)}</div>
  <div className="dlg-foot">
   {i===0&&!last&&<Button data-testid="skip" size="row" variant="quiet" onPress={()=>{setSkipped(true);setAt(0);}}>Minulla on jo sovellus</Button>}
   <span className="r3-grow"/>
   {i>0?<Button data-testid="back" size="row" variant="secondary" isDisabled={pending} onPress={()=>setAt(i-1)}>Takaisin</Button>
    :skipped?<Button data-testid="back" size="row" variant="secondary" isDisabled={pending} onPress={()=>{setSkipped(false);setAt(0);}}>Takaisin</Button>
    :<Button size="row" variant="secondary" onPress={onClose}>Peruuta</Button>}
   {last?<Button data-testid="save" size="page" variant="primary" isDisabled={pending} onPress={f.submit}>{pending?'Odottaa palvelinta…':'Tallenna'}</Button>
    :<Button data-testid="next" size="page" variant="primary" onPress={()=>setAt(i+1)}>Seuraava</Button>}
  </div>
 </Dialog></Modal></ModalOverlay>;
}

// ---------- Removal, missing tool, other providers ----------

type Act={kind:'remove'|'tool'|'later';id:ProviderId}|null;
function ActDialog({act,site,theme,onClose,onRemove}:{act:NonNullable<Act>;site:Site;theme:string;onClose:()=>void;onRemove:(id:ProviderId)=>void}){
 const e=entry(act.id);
 const body=act.kind==='tool'?<>
  <Heading slot="title">{name(e.id)}: {missingOf(site,e).join(', ')} puuttuu</Heading>
  <p>Aja palvelimella:</p><FixCommand/>
  <div className="dlg-foot"><Button size="page" variant="primary" onPress={onClose}>Sulje</Button></div></>
 :act.kind==='remove'?<>
  <Heading slot="title">Poistetaanko {name(e.id)}-tunnukset?</Heading>
  <ul className="consequences"><li>Uusia tilejä ei voi yhdistää.</li><li>Yhdistetyt tilit eivät voi kirjautua uudelleen.</li>{e.id==='dropbox'&&<li data-testid="sync-stops">Yhdistettyjen tilien synkronointi pysähtyy.</li>}{site.steps.includes(e.id)&&<li>Käyttöönoton vaihe piilotetaan.</li>}</ul>
  {(e.id==='microsoft'||e.id==='dropbox')&&<p className="r3-quiet" data-testid="remove-other">Toisen sovelluksen voi asettaa poiston jälkeen.</p>}
  <div className="dlg-foot"><Button size="row" variant="secondary" onPress={onClose}>Peruuta</Button><Button data-testid="confirm-remove" size="page" variant="danger" onPress={()=>onRemove(e.id)}>Poista tunnukset</Button></div></>
 :<>
  <Heading slot="title">{name(e.id)}: tunnukset</Heading>
  <p>{e.id==='google'?'Kierroksen 3 Vaiheittain. Ei tämän kierroksen aihe.':'Kierroksen 4 ohje. Ei tämän kierroksen aihe.'}</p>
  <div className="dlg-foot"><Button size="page" variant="primary" onPress={onClose}>Sulje</Button></div></>;
 return <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={o=>!o&&onClose()}><Modal className="ah-modal act-modal" data-theme={theme}><Dialog className="ah-dialog act-dialog" data-testid="act-dialog" data-kind={act.kind} aria-label={name(e.id)}>{body}</Dialog></Modal></ModalOverlay>;
}

// ---------- Round 2's chosen tab: Käytössä vai ei ----------

// Dropbox, like Microsoft, has no self-service secret renewal (Dropbox
// support cycles it on request), so its menu has only Poista.
const menuItems=(id:ProviderId)=>id==='google'?[{id:'replace',label:'Vaihda tunnukset…'},{id:'remove',label:'Poista tunnukset…',danger:true}]:[{id:'remove',label:'Poista tunnukset…',danger:true}];
function Rows({site,on,guide,goto,note}:{site:Site;on:(a:Act)=>void;guide:()=>void;goto:()=>void;note:boolean}){
 return <ul className="ig-admin s-card r2-list r2-plain" data-testid="ig-rows">{catalog.map(e=>{const s=statusOf(site,e);return <li key={e.id} className="r2-row" data-testid={`row-${e.id}`} data-status={s}>
  <ProviderMark provider={e.id} small/>
  <div className="r2-main"><div className="r2-head"><span className="ig-rn">{name(e.id)}</span><StepBadge site={site} e={e} goto={goto}/></div></div>
  <div className="r2-state"><Mark site={site} e={e}/></div>
  <div className="r2-act">{s==='needs_app'?<Button data-testid={`setup-${e.id}`} size="row" variant="secondary" onPress={()=>e.id==='dropbox'?guide():on({kind:'later',id:e.id})}>Aseta tunnukset…</Button>
   :s==='tool_missing'?<Button data-testid={`tool-${e.id}`} size="row" variant="secondary" onPress={()=>on({kind:'tool',id:e.id})}>Korjaa…</Button>
   :s==='ready'&&e.app?<span data-testid={`menu-wrap-${e.id}`}><Menu label={`${name(e.id)}: tunnukset`} trigger={<span>Tunnukset</span>} placement="bottom end" heading={<AppLine site={site} e={e} note={note}/>} items={menuItems(e.id)} onAction={k=>k==='remove'?on({kind:'remove',id:e.id}):on({kind:'later',id:e.id})}/></span>:null}</div>
 </li>;})}</ul>;
}

// ---------- The page ----------

type Tab='server'|'integrations'|'onboarding'|'users';
let reviewTheme='light',reviewPhone=false,reviewServer:Server='microsoft';
function App({direction}:{direction:number}){
 const [theme,setTheme]=useState(reviewTheme),[phone,setPhone]=useState(reviewPhone);
 const [server,setServer]=useState<Server>(reviewServer);
 const [site,setSite]=useState<Site>(()=>siteOf(reviewServer));
 const [tab,setTab]=useState<Tab>('integrations');
 const [act,setAct]=useState<Act>(null),[notice,setNotice]=useState('');
 const [guide,setGuide]=useState(0); // 0 closed; otherwise a key that remounts the form
 useEffect(()=>{setNotice('');setGuide(0);},[server]);
 // Menus portal to <body>, outside the review root: give them the same theme.
 useEffect(()=>{document.documentElement.dataset.theme=theme;},[theme]);
 const tabs:[Tab,string][]=[['server','Palvelin'],['integrations','Integraatiot'],['onboarding','Käyttöönotto'],['users','Käyttäjät ja pääsy']];
 const pending=(id:ProviderId,done:(s:Site)=>Site,msg:string,after?:()=>void)=>{setAct(null);setNotice('');setSite(s=>({...s,saving:[...s.saving,id]}));setTimeout(()=>{setSite(s=>done({...s,saving:s.saving.filter(p=>p!==id)}));setNotice(msg);after?.();},900);};
 // The guide stays open until the server confirms, then closes onto the row.
 const save=(a:App)=>pending('dropbox',s=>({...s,apps:{...s.apps,dropbox:a}}),'Dropbox: tunnukset tallennettu.',()=>setGuide(0));
 const remove=(id:ProviderId)=>pending(id,s=>{const apps={...s.apps};delete apps[id];return {...s,apps};},`${name(id)}: tunnukset poistettu.`);
 const openGuide=()=>{setNotice('');setGuide(g=>g+1);};
 const integrations=<><h2>Integraatiot</h2>{notice&&<p role="status" className="notice" data-testid="notice">{notice}</p>}<Rows site={site} on={setAct} guide={openGuide} goto={()=>setTab('onboarding')} note={direction===1}/></>;
 const serverTab=<><h2>Palvelin</h2><div className="facts s-card"><div className="s-row"><strong>Northstar</strong><code>habitat.example.test</code></div><div className="s-row"><strong>Versio</strong><code>v0.0.0-prototype</code></div></div></>;
 return <div data-theme={theme} className={phone?'review phone':'review'}><header className="reviewbar"><strong>Palvelimen integraatiot · kierros 5</strong><label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label><label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);}}/> 390 px</label><p>Synteettiset tiedot. Ei yhteyttä palvelimeen eikä Dropboxiin.</p></header>
 <div className="scenario"><span className="muted">Esimerkkipalvelin</span><Segmented data-testid="server" label="Esimerkkipalvelin" size="row" options={(Object.keys(servers) as Server[]).map(s=>({id:s,label:servers[s].label}))} value={server} onChange={s=>{reviewServer=s;setServer(s);setSite(siteOf(s));}}/><span className="muted" data-testid="server-hint">{servers[server].hint}</span></div>
 <p className="axis">Dropboxin ohjattu asetus vaiheittain: kehitystilan käyttäjät omana vaiheenaan vai Asetukset-sivun mukana ja 50 henkilön sääntö rivin valikossa. Suositus: Sivu kerrallaan.</p>
 <div className={`shell variant-${direction}`}><div className="hostbar"><strong>Open Habitat</strong><span>Northstar · esimerkkisivusto</span><Icon name="user"/></div><section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>{['Tili','Agentit','Integraatiot','Ulkoasu','Editori'].map(n=><span className="s-nav-i" key={n}>{n}</span>)}<span className="s-nav-h">Palvelimen ylläpito</span>{tabs.map(([id,label])=><button type="button" key={id} className="s-nav-i" data-testid={`tab-${id}`} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{label}</button>)}<span className="s-nav-i">Levytila</span></nav><main className="s-main">
 <nav className="mobiletabs" aria-label="Palvelimen ylläpito"><span className="muted">Asetukset › Palvelimen ylläpito</span><div>{tabs.map(([id,label])=><button type="button" key={id} data-testid={`mtab-${id}`} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{label}</button>)}</div></nav>
 {tab==='integrations'?integrations:tab==='onboarding'?<><h2>Käyttöönotto</h2><p className="muted">Kierroksen 1 säännöt. Ei tämän kierroksen aihe.</p></>:tab==='users'?<><h2>Käyttäjät ja pääsy</h2><p className="muted">Ei tämän kierroksen aihe.</p></>:serverTab}
 </main></section></div>
 {guide>0&&<Stepper key={guide} direction={direction} theme={theme} onClose={()=>setGuide(0)} onSave={save} pending={site.saving.includes('dropbox')}/>}
 {act&&<ActDialog act={act} site={site} theme={theme} onClose={()=>setAct(null)} onRemove={remove}/>}
 </div>;
}
const root=createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink={set innerHTML(view:React.ReactNode){flushSync(()=>root.render(view===''?null:view));}};
const variants=directions.map((_,direction)=>()=> <App direction={direction}/>);
const picker=document.createElement('nav');
picker.className='proto-picker';picker.setAttribute('aria-label','Prototype variants');
picker.innerHTML='<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n,i)=>{const button=document.createElement('button');button.className='proto-picker-item';button.textContent=n.replaceAll(' ','\u00a0');if(i===0){button.setAttribute('data-active','');button.setAttribute('aria-current','true');}picker.append(button);});
document.body.append(picker);
new Function('stage','variants',pickerSource)(stageSink,variants);
