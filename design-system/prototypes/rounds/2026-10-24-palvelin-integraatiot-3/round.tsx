import React, {useEffect, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, DisclosureButton, ExternalLink, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {Menu} from '../../../../web/src/components/Overlays';
import {RadioGroup, TextField} from '../../../../web/src/components/Primitives';
import {Badge, StatusMark} from '../../../../web/src/components/Status';
import {ProviderMark, providerCopy} from '../../../../web/src/components/Integrations';
import type {ProviderId} from '../../../../web/src/app/integrations';
import type {Tone} from '../../../../web/src/components/types';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/Integrations.css';
import './round.css';

// Round 3 of the server administrator's integrations setup: what "Aseta
// tunnukset…" on the Google row opens. The tab is round 2's direction 2
// (Käytössä vai ei), unchanged. This round riffs on the guided setup itself:
// one checklist, a stepper, or a side panel beside the rows. Every console
// step comes from Google's documentation (cited in the issue's result.md)
// and every value from internal/daemon/integrations/google_linux.go.
// Microsoft and Dropbox remain placeholders. Everything is synthetic.
const directions=['Tarkistuslista','Vaiheittain','Sivupaneeli'];

// ---------- What the daemon's Google integration actually needs ----------

// googleScopes in google_linux.go, in order.
const SCOPES=['openid','email','https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/gmail.modify','https://www.googleapis.com/auth/calendar','https://www.googleapis.com/auth/contacts'];
// rclone uses Drive; gog uses Gmail, Calendar and People (contacts).
const APIS:[string,string][]=[['Gmail API','gmail.googleapis.com'],['Google Calendar API','calendar-json.googleapis.com'],['Google Drive API','drive.googleapis.com'],['People API','people.googleapis.com']];
const ENABLE='https://console.cloud.google.com/apis/enableflow?apiid='+APIS.map(a=>a[1]).join(',');
const REDIRECT='http://localhost'; // googleRedirect: pasted back by the person, never registered
const CLIENT_ID=/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;
const SECRET=/^[A-Za-z0-9._-]{1,256}$/; // googleApp()'s check

// ---------- The catalog and synthetic servers (as round 2) ----------

type Status='ready'|'needs_app'|'tool_missing'|'saving';
type Entry={id:ProviderId;tools:string[];app?:{where:string;fields:string[]}};
const catalog:Entry[]=[
 {id:'google',tools:['gog','rclone'],app:{where:'Google Cloud',fields:['Client ID','Client secret']}},
 {id:'microsoft',tools:['rclone','ms-365-mcp-server'],app:{where:'Microsoft Entra',fields:['Sovelluksen (client) id','Kirjautujat']}},
 {id:'imap',tools:['himalaya']},
 {id:'caldav',tools:['curl']},
 {id:'carddav',tools:['curl']},
 {id:'dropbox',tools:['rclone'],app:{where:'Dropbox App Console',fields:['App key','App secret']}},
];
const entry=(id:ProviderId)=>catalog.find(e=>e.id===id)!;
const name=(id:ProviderId)=>providerCopy[id].name;
const FIX='sudo open-habitat host apply --site /etc/open-habitat/site.json';

type Server='fresh'|'google'|'partial';
const OLD_ID='704213598812-k3v9q2mfa0b7s1dn5e8rjhtc4lpu6xwo.apps.googleusercontent.com';
const servers:Record<Server,{label:string;hint:string;apps:ProviderId[];missing:string[]}>={
 fresh:{label:'Uusi asennus',hint:'Työkalut asennettu, sovellustunnuksia ei vielä.',apps:[],missing:[]},
 google:{label:'Google asetettu',hint:'Googlen tunnukset asetettu, Microsoft ja Dropbox puuttuvat.',apps:['google'],missing:[]},
 partial:{label:'Vajaa asennus',hint:'Vanha asennus, josta rclone puuttuu.',apps:['google'],missing:['rclone']},
};
// The client id is public (it is in every sign-in URL); the secret never returns.
type App={clientId:string;at:string};
type Site={apps:Partial<Record<ProviderId,App>>;missing:string[];saving:ProviderId[];steps:ProviderId[]};
const siteOf=(s:Server):Site=>({apps:Object.fromEntries(servers[s].apps.map(p=>[p,{clientId:OLD_ID,at:'24.10. Kaisa Admin'}])),missing:servers[s].missing,saving:[],steps:['google']});
const statusOf=(site:Site,e:Entry):Status=>site.saving.includes(e.id)?'saving':e.tools.some(t=>site.missing.includes(t))?'tool_missing':e.app&&!site.apps[e.id]?'needs_app':'ready';
const missingOf=(site:Site,e:Entry)=>e.tools.filter(t=>site.missing.includes(t));
const kindOf=(s:Status)=>s==='ready'?'success':s==='tool_missing'?'error':'neutral';
const Mark=({site,e}:{site:Site;e:Entry})=>{
 const s=statusOf(site,e);
 const [label,tone]=({ready:['Käytössä','success'],needs_app:['Ei käytössä','warning'],tool_missing:[`Ei käytössä · ${missingOf(site,e).join(', ')} puuttuu`,'danger'],saving:['Odottaa palvelinta','info']} as Record<Status,[string,Tone]>)[s];
 return <StatusMark data-testid="ig-status" label={label} tone={tone} animated={s==='saving'?'running':false} kind={kindOf(s)}/>;
};
// Every Google client id ends in .apps.googleusercontent.com, so a last-four
// suffix would always read ".com". The project number before the dash is what
// the administrator also sees in the console.
const shortId=(id:string)=>id.split('-')[0]+'-…';
const AppLine=({site,e}:{site:Site;e:Entry})=>e.app&&site.apps[e.id]?<span className="r2-app" data-testid={`app-${e.id}`}>{e.app.where} · client id <code>{shortId(site.apps[e.id]!.clientId)}</code> · {site.apps[e.id]!.at}</span>:null;

// ---------- Small shared pieces ----------

function Copy({value,label}:{value:string;label:string}){
 const [done,setDone]=useState(false);
 const copy=async()=>{try{await navigator.clipboard.writeText(value);}catch{/* the value stays selectable */}setDone(true);setTimeout(()=>setDone(false),1400);};
 return <Button size="row" variant="quiet" aria-label={`Kopioi ${label}`} data-testid="copy" onPress={()=>void copy()}><Icon name={done?'check':'copy'} width={14} height={14}/></Button>;
}
/** A value the administrator types into Google: label, value, copy. */
const Val=({k,v,copy=true}:{k:string;v:string;copy?:boolean})=><div className="r3-val"><span className="r3-k">{k}</span><code>{v}</code>{copy&&<Copy value={v} label={k}/>}</div>;
/** Where in the console, in the console's own (English) words. */
const Path=({p}:{p:string})=><p className="r3-path"><Icon name="forward" width={12} height={12}/><span>{p}</span></p>;

function FixCommand(){
 return <div className="r2-fix" data-testid="fix-command"><pre className="cmd">{FIX}</pre><Copy value={FIX} label="komento"/></div>;
}
function StepBadge({site,e,goto}:{site:Site;e:Entry;goto:()=>void}){
 if(!site.steps.includes(e.id))return null;
 const hidden=statusOf(site,e)!=='ready';
 return <button type="button" className="r2-step" data-testid={`onb-${e.id}`} data-hidden={hidden||undefined} onClick={goto} aria-label={`Käyttöönotto: ${name(e.id)}-vaihe${hidden?', piilossa':''}`}><Badge label={hidden?'Käyttöönotossa · piilossa':'Käyttöönotossa'} tone={hidden?'warning':'neutral'}/></button>;
}

// ---------- The guide's content, shared by every direction ----------

type Audience='internal'|'external';
type Change='secret'|'client';
type Form={audience:Audience;setAudience:(a:Audience)=>void;change:Change;setChange:(c:Change)=>void;
 clientId:string;setClientId:(v:string)=>void;secret:string;setSecret:(v:string)=>void;
 errors:{id?:string;secret?:string};replace:App|undefined;pending:boolean;submit:()=>void};

type Step={id:string;title:string;body:(f:Form)=>React.ReactNode};
const STEPS:Step[]=[
 {id:'apis',title:'API:t',body:()=><>
  <p>Valitse organisaation projekti ja ota käyttöön:</p>
  <ul className="r3-apis" data-testid="apis">{APIS.map(([n])=><li key={n}>{n}</li>)}</ul>
  <ExternalLink href={ENABLE} target="_blank" rel="noreferrer" data-testid="enable-link">Ota käyttöön Google Cloudissa <Icon name="external" width={12} height={12}/></ExternalLink>
 </>},
 {id:'audience',title:'Kohdeyleisö',body:f=><>
  <Path p="Google Auth platform › Branding › Get started"/>
  <Val k="App name" v="Open Habitat"/>
  <div className="r3-aud"><span className="r3-k">Audience</span><Segmented data-testid="audience" label="Audience" size="row" options={[{id:'internal',label:'Internal'},{id:'external',label:'External'}]} value={f.audience} onChange={f.setAudience}/></div>
  {f.audience==='internal'
   ?<p className="r3-effect" data-testid="audience-effect">Vain organisaation Google Workspace -tilit. Ei Googlen vahvistusta.</p>
   :<ul className="r3-effect" data-testid="audience-effect">
    <li><strong>Testing:</strong> lisää jokainen tili kohtaan <em>Audience › Test users</em>, enintään 100. Kirjautuminen vanhenee 7 päivässä.</li>
    <li><strong>In production:</strong> Gmail ja Drive vaativat Googlen vahvistuksen ja vuosittaisen tietoturva-arvion.</li>
   </ul>}
 </>},
 {id:'scopes',title:'Käyttöoikeudet',body:()=><>
  <Path p="Google Auth platform › Data Access › Add or Remove Scopes"/>
  <div className="r3-scopes" data-testid="scopes"><pre className="cmd">{SCOPES.join('\n')}</pre><Copy value={SCOPES.join(',')} label="käyttöoikeudet"/></div>
 </>},
 {id:'client',title:'OAuth-asiakas',body:()=><>
  <Path p="Google Auth platform › Clients › Create Client"/>
  <Val k="Application type" v="Desktop app" copy={false}/>
  <Val k="Name" v="Open Habitat"/>
  <p className="r3-quiet" data-testid="redirect">Ei uudelleenohjausosoitetta. Palvelin käyttää osoitetta <code>{REDIRECT}</code>.</p>
  <p className="warn-line" data-testid="secret-once"><Icon name="warning" width={16} height={16}/><span>Kopioi Client secret heti: Google näyttää sen vain kerran.</span></p>
 </>},
];

/** Replacing: a new secret on the same client, or another client. */
function ChangeChoice({f}:{f:Form}){
 return <div className="r3-change" data-testid="change">
  <RadioGroup label="Mitä vaihdetaan?" value={f.change} onChange={f.setChange} options={[
   {value:'secret',label:'Uusi salaisuus samalle asiakkaalle',description:'Clients › Open Habitat › Add secret'},
   {value:'client',label:'Uusi asiakas',description:'Esimerkiksi toinen projekti'}]}/>
  <p className="r3-quiet" data-testid="change-effect">Yhdistetyt tilit käyttävät vanhaa {f.change==='secret'?'salaisuutta':'asiakasta'}, kunnes poistat sen Googlessa. Sen jälkeen niiden täytyy kirjautua uudelleen.</p>
 </div>;
}
function Fields({f}:{f:Form}){
 const secretOnly=!!f.replace&&f.change==='secret';
 return <div className="r3-fields" data-testid="fields">
  {secretOnly?<Val k="Client ID" v={f.replace!.clientId} copy={false}/>
   :<TextField data-testid="client-id" label="Client ID" mono value={f.clientId} onChange={f.setClientId} error={f.errors.id} hint="…apps.googleusercontent.com"/>}
  <label className="s-field ig-password r3-secret"><span>Client secret</span><input type="password" data-testid="client-secret" autoComplete="new-password" value={f.secret} maxLength={256} aria-invalid={!!f.errors.secret||undefined} onChange={e=>f.setSecret(e.target.value)}/>{f.errors.secret&&<span className="r3-err" role="alert">{f.errors.secret}</span>}</label>
 </div>;
}
const SaveButton=({f}:{f:Form})=><Button data-testid="save" size="page" variant="primary" isDisabled={f.pending} onPress={f.submit}>{f.pending?'Odottaa palvelinta…':'Tallenna'}</Button>;

function useForm(replace:App|undefined,onSave:(a:App)=>void):Form{
 const [audience,setAudience]=useState<Audience>('internal'),[change,setChange]=useState<Change>('secret');
 const [clientId,setClientId]=useState(''),[secret,setSecret]=useState('');
 const [errors,setErrors]=useState<Form['errors']>({}),[pending,setPending]=useState(false);
 const submit=()=>{
  const secretOnly=!!replace&&change==='secret',id=secretOnly?replace!.clientId:clientId.trim();
  const e:Form['errors']={};
  if(!CLIENT_ID.test(id))e.id='Tarkista Client ID: se päättyy .apps.googleusercontent.com.';
  if(!SECRET.test(secret.trim()))e.secret='Tarkista Client secret.';
  setErrors(e);if(e.id||e.secret)return;
  setPending(true);onSave({clientId:id,at:'24.10. Kaisa Admin'});
 };
 return {audience,setAudience,change,setChange,clientId,setClientId,secret,setSecret,errors,replace,pending,submit};
}
type GuideProps={site:Site;theme:string;onClose:()=>void;onSave:(a:App)=>void;pending:boolean};
const titleOf=(replace:App|undefined)=>replace?'Google: vaihda tunnukset':'Google: aseta tunnukset';

// ---------- Direction 1: one checklist, everything visible ----------

function Checklist({site,theme,onClose,onSave,pending}:GuideProps){
 const replace=site.apps.google,f=useForm(replace,onSave);f.pending=pending;
 const steps=replace&&f.change==='secret'?[]:STEPS;
 return <ModalOverlay className="ah-overlay" isOpen isDismissable={!pending} onOpenChange={o=>!o&&onClose()}><Modal className="ah-modal r3-modal" data-theme={theme}><Dialog className="ah-dialog r3-dialog" data-testid="guide" data-direction="checklist" aria-label={titleOf(replace)}>
  <Heading slot="title">{titleOf(replace)}</Heading>
  {replace&&<ChangeChoice f={f}/>}
  <ol className="r3-check">{steps.map((s,i)=><li key={s.id} data-testid={`step-${s.id}`}><span className="r3-num">{i+1}</span><div><h3>{s.title}</h3>{s.body(f)}</div></li>)}
   <li data-testid="step-enter"><span className="r3-num">{steps.length+1}</span><div><h3>Tunnukset</h3><Fields f={f}/></div></li></ol>
  <div className="dlg-foot"><Button size="row" variant="secondary" onPress={onClose}>Peruuta</Button><SaveButton f={f}/></div>
 </Dialog></Modal></ModalOverlay>;
}

// ---------- Direction 2: one step at a time ----------

function Stepper({site,theme,onClose,onSave,pending}:GuideProps){
 const replace=site.apps.google,f=useForm(replace,onSave);f.pending=pending;
 const steps=replace&&f.change==='secret'?[]:STEPS,all=[...steps,{id:'enter',title:'Tunnukset',body:(x:Form)=><Fields f={x}/>}];
 const [at,setAt]=useState(0),i=Math.min(at,all.length-1),last=i===all.length-1,s=all[i]!;
 return <ModalOverlay className="ah-overlay" isOpen isDismissable={!pending} onOpenChange={o=>!o&&onClose()}><Modal className="ah-modal r3-modal r3-narrow" data-theme={theme}><Dialog className="ah-dialog r3-dialog" data-testid="guide" data-direction="stepper" aria-label={titleOf(replace)}>
  <Heading slot="title">{titleOf(replace)}</Heading>
  {replace&&i===0&&<ChangeChoice f={f}/>}
  <div className="r3-progress" data-testid="progress" aria-label={`Vaihe ${i+1}/${all.length}`}>{all.map((x,j)=><span key={x.id} data-done={j<i||undefined} data-current={j===i||undefined}/>)}</div>
  <p className="r3-stepname" data-testid="stepname"><span className="muted">{i+1}/{all.length}</span> {s.title}</p>
  <div className="r3-stepbody" data-testid={`step-${s.id}`}>{s.body(f)}</div>
  <div className="dlg-foot">
   {i===0&&!last&&<Button data-testid="skip" size="row" variant="quiet" onPress={()=>setAt(all.length-1)}>Minulla on jo asiakas</Button>}
   <span className="r3-grow"/>
   {i>0?<Button data-testid="back" size="row" variant="secondary" isDisabled={pending} onPress={()=>setAt(i-1)}>Takaisin</Button>:<Button size="row" variant="secondary" onPress={onClose}>Peruuta</Button>}
   {last?<SaveButton f={f}/>:<Button data-testid="next" size="page" variant="primary" onPress={()=>setAt(i+1)}>Seuraava</Button>}
  </div>
 </Dialog></Modal></ModalOverlay>;
}

// ---------- Direction 3: side panel beside the rows, fields first ----------

function Panel({site,onClose,onSave,pending}:GuideProps){
 const replace=site.apps.google,f=useForm(replace,onSave);f.pending=pending;
 const [open,setOpen]=useState<string[]>(replace?[]:['apis']);
 const toggle=(id:string)=>setOpen(o=>o.includes(id)?o.filter(x=>x!==id):[...o,id]);
 const steps=replace&&f.change==='secret'?[]:STEPS;
 return <aside className="r3-panel" data-testid="guide" data-direction="panel" aria-label={titleOf(replace)}>
  <div className="r3-panel-head"><Button data-testid="panel-back" className="r3-back" size="row" variant="quiet" onPress={onClose}><Icon name="back" width={14} height={14}/>Integraatiot</Button><h3>{titleOf(replace)}</h3><Button data-testid="panel-close" className="r3-close" size="row" variant="quiet" aria-label="Sulje" onPress={onClose}><Icon name="cross" width={14} height={14}/></Button></div>
  {replace&&<ChangeChoice f={f}/>}
  <Fields f={f}/>
  <div className="r3-panel-save"><SaveButton f={f}/></div>
  {steps.length>0&&<div className="r3-guide" data-testid="panel-guide"><p className="eyebrow">Google Cloudissa</p><ol>{steps.map((s,i)=><li key={s.id} data-testid={`step-${s.id}`} data-open={open.includes(s.id)||undefined}>
   <DisclosureButton data-testid={`open-${s.id}`} aria-expanded={open.includes(s.id)} onPress={()=>toggle(s.id)}><span className="r3-num">{i+1}</span><span className="r3-grow">{s.title}</span><span aria-hidden="true" className="r2-chev"/></DisclosureButton>
   {open.includes(s.id)&&<div className="r3-gbody">{s.body(f)}</div>}
  </li>)}</ol></div>}
 </aside>;
}

// ---------- Removal, missing tool, other providers' placeholder ----------

type Act={kind:'remove'|'tool'|'later';id:ProviderId}|null;
function ActDialog({act,site,theme,onClose,onRemove}:{act:NonNullable<Act>;site:Site;theme:string;onClose:()=>void;onRemove:(id:ProviderId)=>void}){
 const e=entry(act.id);
 const body=act.kind==='tool'?<>
  <Heading slot="title">{name(e.id)}: {missingOf(site,e).join(', ')} puuttuu</Heading>
  <p>Aja palvelimella:</p><FixCommand/>
  <div className="dlg-foot"><Button size="page" variant="primary" onPress={onClose}>Sulje</Button></div></>
 :act.kind==='remove'?<>
  <Heading slot="title">Poistetaanko {name(e.id)}-tunnukset?</Heading>
  <ul className="consequences"><li>Uusia tilejä ei voi yhdistää.</li><li>Yhdistetyt tilit eivät voi kirjautua uudelleen.</li>{site.steps.includes(e.id)&&<li>Käyttöönoton vaihe piilotetaan.</li>}</ul>
  <div className="dlg-foot"><Button size="row" variant="secondary" onPress={onClose}>Peruuta</Button><Button data-testid="confirm-remove" size="page" variant="danger" onPress={()=>onRemove(e.id)}>Poista tunnukset</Button></div></>
 :<>
  <Heading slot="title">{name(e.id)}: aseta tunnukset</Heading>
  <p>Tulee omalla kierroksellaan. Kysyy: {e.app!.fields.join(' ja ')}.</p>
  <div className="dlg-foot"><Button size="page" variant="primary" onPress={onClose}>Sulje</Button></div></>;
 return <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={o=>!o&&onClose()}><Modal className="ah-modal act-modal" data-theme={theme}><Dialog className="ah-dialog act-dialog" data-testid="act-dialog" data-kind={act.kind} aria-label={name(e.id)}>{body}</Dialog></Modal></ModalOverlay>;
}

// ---------- Round 2's chosen tab: Käytössä vai ei ----------

function Rows({site,on,guide,goto}:{site:Site;on:(a:Act)=>void;guide:()=>void;goto:()=>void}){
 return <ul className="ig-admin s-card r2-list r2-plain" data-testid="ig-rows">{catalog.map(e=>{const s=statusOf(site,e);return <li key={e.id} className="r2-row" data-testid={`row-${e.id}`} data-status={s}>
  <ProviderMark provider={e.id} small/>
  <div className="r2-main"><div className="r2-head"><span className="ig-rn">{name(e.id)}</span><StepBadge site={site} e={e} goto={goto}/></div></div>
  <div className="r2-state"><Mark site={site} e={e}/></div>
  <div className="r2-act">{s==='needs_app'?<Button data-testid={`setup-${e.id}`} size="row" variant="secondary" onPress={()=>e.id==='google'?guide():on({kind:'later',id:e.id})}>Aseta tunnukset…</Button>
   :s==='tool_missing'?<Button data-testid={`tool-${e.id}`} size="row" variant="secondary" onPress={()=>on({kind:'tool',id:e.id})}>Korjaa…</Button>
   :s==='ready'&&e.app?<span data-testid={`menu-wrap-${e.id}`}><Menu label={`${name(e.id)}: tunnukset`} trigger={<span>Tunnukset</span>} placement="bottom end" heading={<AppLine site={site} e={e}/>} items={[{id:'replace',label:'Vaihda tunnukset…'},{id:'remove',label:'Poista tunnukset…',danger:true}]} onAction={k=>k==='remove'?on({kind:'remove',id:e.id}):e.id==='google'?guide():on({kind:'later',id:e.id})}/></span>:null}</div>
 </li>;})}</ul>;
}

// ---------- The page ----------

type Tab='server'|'integrations'|'onboarding'|'users';
let reviewTheme='light',reviewPhone=false,reviewServer:Server='fresh';
function App({direction}:{direction:number}){
 const [theme,setTheme]=useState(reviewTheme),[phone,setPhone]=useState(reviewPhone);
 const [server,setServer]=useState<Server>(reviewServer);
 const [site,setSite]=useState<Site>(()=>siteOf(reviewServer));
 const [tab,setTab]=useState<Tab>('integrations');
 const [act,setAct]=useState<Act>(null),[notice,setNotice]=useState('');
 const [guide,setGuide]=useState(0); // 0 closed; otherwise a key that remounts the form
 const pendingGoogle=site.saving.includes('google');
 useEffect(()=>{setNotice('');setGuide(0);},[server]);
 const tabs:[Tab,string][]=[['server','Palvelin'],['integrations','Integraatiot'],['onboarding','Käyttöönotto'],['users','Käyttäjät ja pääsy']];
 const pending=(id:ProviderId,done:(s:Site)=>Site,msg:string,after?:()=>void)=>{setAct(null);setNotice('');setSite(s=>({...s,saving:[...s.saving,id]}));setTimeout(()=>{setSite(s=>done({...s,saving:s.saving.filter(p=>p!==id)}));setNotice(msg);after?.();},900);};
 // The guide stays open until the server confirms, then closes onto the row.
 const save=(a:App)=>pending('google',s=>({...s,apps:{...s.apps,google:a}}),'Google: tunnukset tallennettu.',()=>setGuide(0));
 const remove=(id:ProviderId)=>pending(id,s=>{const apps={...s.apps};delete apps[id];return {...s,apps};},`${name(id)}: tunnukset poistettu.`);
 const openGuide=()=>{setNotice('');setGuide(g=>g+1);};
 const gp:GuideProps={site,theme,onClose:()=>setGuide(0),onSave:save,pending:pendingGoogle};
 const rows=<Rows site={site} on={setAct} guide={openGuide} goto={()=>setTab('onboarding')}/>;
 const integrations=<><h2>Integraatiot</h2>{notice&&<p role="status" className="notice" data-testid="notice">{notice}</p>}
  {direction===2?<div className="r3-split" data-panel={guide?'':undefined}>{rows}{guide>0&&<Panel key={guide} {...gp}/>}</div>:rows}</>;
 const serverTab=<><h2>Palvelin</h2><div className="facts s-card"><div className="s-row"><strong>Northstar</strong><code>habitat.example.test</code></div><div className="s-row"><strong>Versio</strong><code>v0.0.0-prototype</code></div></div></>;
 return <div data-theme={theme} className={phone?'review phone':'review'}><header className="reviewbar"><strong>Palvelimen integraatiot · kierros 3</strong><label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label><label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);}}/> 390 px</label><p>Synteettiset tiedot. Ei yhteyttä palvelimeen eikä Googleen.</p></header>
 <div className="scenario"><span className="muted">Esimerkkipalvelin</span><Segmented data-testid="server" label="Esimerkkipalvelin" size="row" options={(Object.keys(servers) as Server[]).map(s=>({id:s,label:servers[s].label}))} value={server} onChange={s=>{reviewServer=s;setServer(s);setSite(siteOf(s));}}/><span className="muted" data-testid="server-hint">{servers[server].hint}</span></div>
 <p className="axis">Miten Googlen ohjattu asetus asettuu konsolityön rinnalle: tarkistuslista, vaiheittain, sivupaneeli. Suositus: Sivupaneeli.</p>
 <div className={`shell variant-${direction}`}><div className="hostbar"><strong>Open Habitat</strong><span>Northstar · esimerkkisivusto</span><Icon name="user"/></div><section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>{['Tili','Agentit','Integraatiot','Ulkoasu','Editori'].map(n=><span className="s-nav-i" key={n}>{n}</span>)}<span className="s-nav-h">Palvelimen ylläpito</span>{tabs.map(([id,label])=><button type="button" key={id} className="s-nav-i" data-testid={`tab-${id}`} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{label}</button>)}<span className="s-nav-i">Levytila</span></nav><main className="s-main">
 <nav className="mobiletabs" aria-label="Palvelimen ylläpito"><span className="muted">Asetukset › Palvelimen ylläpito</span><div>{tabs.map(([id,label])=><button type="button" key={id} data-testid={`mtab-${id}`} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{label}</button>)}</div></nav>
 {tab==='integrations'?integrations:tab==='onboarding'?<><h2>Käyttöönotto</h2><p className="muted">Kierroksen 1 säännöt. Ei tämän kierroksen aihe.</p></>:tab==='users'?<><h2>Käyttäjät ja pääsy</h2><p className="muted">Ei tämän kierroksen aihe.</p></>:serverTab}
 </main></section></div>
 {guide>0&&direction===0&&<Checklist key={guide} {...gp}/>}
 {guide>0&&direction===1&&<Stepper key={guide} {...gp}/>}
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
directions.forEach((n,i)=>{const button=document.createElement('button');button.className='proto-picker-item';button.textContent=n.replaceAll(' ',' ');if(i===0){button.setAttribute('data-active','');button.setAttribute('aria-current','true');}picker.append(button);});
document.body.append(picker);
new Function('stage','variants',pickerSource)(stageSink,variants);
