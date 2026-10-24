import React, {useEffect, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, Segmented} from '../../../../web/src/components/ControlElements';
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

// Round 4 of the server administrator's integrations setup: what "Aseta
// tunnukset…" on the Microsoft 365 row opens, in round 3's chosen form
// (Vaiheittain). The tab is round 2's direction 2, unchanged. The one real
// Microsoft-specific choice is where the two IDs are entered: Entra shows them
// on the Overview page right after registration, unlike Google's secret, which
// exists only once the client is created. Every portal step comes from
// Microsoft Learn (cited in the issue's result.md) and every value from
// internal/daemon/integrations/microsoft_linux.go. Everything is synthetic.
const directions=['Tunnukset lopussa','Tunnukset heti'];

// ---------- What the daemon's Microsoft integration actually needs ----------

// microsoftScopes + microsoftMCPScopes, deduplicated, in request order. All
// are delegated Microsoft Graph permissions; the daemon asks for no app roles.
const PERMS=['openid','profile','User.Read','offline_access','Files.ReadWrite.All','Sites.ReadWrite.All','Mail.ReadWrite','Mail.Send','Calendars.ReadWrite','Contacts.ReadWrite'];
// The redirect microsoftConsent() names. Device code itself needs none.
const NATIVE='https://login.microsoftonline.com/common/oauth2/nativeclient';
const GUID=/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/; // microsoftID
const consentLink=(tenant:string,client:string)=>`https://login.microsoftonline.com/${tenant}/adminconsent?client_id=${client}`;

// ---------- The catalog and synthetic servers (as rounds 2–3) ----------

type Status='ready'|'needs_app'|'tool_missing'|'saving';
type Entry={id:ProviderId;tools:string[];app?:{where:string}};
const catalog:Entry[]=[
 {id:'google',tools:['gog','rclone'],app:{where:'Google Cloud'}},
 {id:'microsoft',tools:['rclone','ms-365-mcp-server'],app:{where:'Microsoft Entra'}},
 {id:'imap',tools:['himalaya']},
 {id:'caldav',tools:['curl']},
 {id:'carddav',tools:['curl']},
 {id:'dropbox',tools:['rclone'],app:{where:'Dropbox App Console'}},
];
const entry=(id:ProviderId)=>catalog.find(e=>e.id===id)!;
const name=(id:ProviderId)=>providerCopy[id].name;
const FIX='sudo open-habitat host apply --site /etc/open-habitat/site.json';

type Server='google'|'microsoft'|'partial';
const G_ID='704213598812-k3v9q2mfa0b7s1dn5e8rjhtc4lpu6xwo.apps.googleusercontent.com';
const M_ID='3f2a91c4-7d0e-4b6a-9c15-e8a4b2d7f031',M_TENANT='b81e5c27-4a93-4f0d-86c2-1d9e7a3f5b60';
const servers:Record<Server,{label:string;hint:string;apps:ProviderId[];missing:string[]}>={
 google:{label:'Google asetettu',hint:'Googlen tunnukset asetettu, Microsoft ja Dropbox puuttuvat.',apps:['google'],missing:[]},
 microsoft:{label:'Microsoft asetettu',hint:'Googlen ja Microsoftin tunnukset asetettu.',apps:['google','microsoft'],missing:[]},
 partial:{label:'Vajaa asennus',hint:'Vanha asennus, josta ms-365-mcp-server puuttuu.',apps:['google'],missing:['ms-365-mcp-server']},
};
// Both IDs are public: they are in every sign-in URL. Nothing secret is stored.
type App={clientId:string;tenantId?:string;at:string};
type Site={apps:Partial<Record<ProviderId,App>>;missing:string[];saving:ProviderId[];steps:ProviderId[]};
const appOf=(p:ProviderId):App=>p==='microsoft'?{clientId:M_ID,tenantId:M_TENANT,at:'24.10. Kaisa Admin'}:{clientId:G_ID,at:'24.10. Kaisa Admin'};
const siteOf=(s:Server):Site=>({apps:Object.fromEntries(servers[s].apps.map(p=>[p,appOf(p)])),missing:servers[s].missing,saving:[],steps:['google','microsoft']});
const statusOf=(site:Site,e:Entry):Status=>site.saving.includes(e.id)?'saving':e.tools.some(t=>site.missing.includes(t))?'tool_missing':e.app&&!site.apps[e.id]?'needs_app':'ready';
const missingOf=(site:Site,e:Entry)=>e.tools.filter(t=>site.missing.includes(t));
const kindOf=(s:Status)=>s==='ready'?'success':s==='tool_missing'?'error':'neutral';
const Mark=({site,e}:{site:Site;e:Entry})=>{
 const s=statusOf(site,e);
 const [label,tone]=({ready:['Käytössä','success'],needs_app:['Ei käytössä','warning'],tool_missing:[`Ei käytössä · ${missingOf(site,e).join(', ')} puuttuu`,'danger'],saving:['Odottaa palvelinta','info']} as Record<Status,[string,Tone]>)[s];
 return <StatusMark data-testid="ig-status" label={label} tone={tone} animated={s==='saving'?'running':false} kind={kindOf(s)}/>;
};
// Google: the project number before the dash. Microsoft: a GUID's first group.
const shortId=(id:string)=>id.split('-')[0]+'-…';
const AppLine=({site,e}:{site:Site;e:Entry})=>e.app&&site.apps[e.id]?<span className="r2-app" data-testid={`app-${e.id}`}>{e.app.where} · client id <code>{shortId(site.apps[e.id]!.clientId)}</code> · {site.apps[e.id]!.at}</span>:null;

// ---------- Small shared pieces (as round 3) ----------

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

type Form={clientId:string;setClientId:(v:string)=>void;tenantId:string;setTenantId:(v:string)=>void;
 errors:{client?:string;tenant?:string};check:()=>boolean;pending:boolean;submit:()=>void;early:boolean};
type Step={id:string;title:string;body:(f:Form)=>React.ReactNode};

const REGISTER:Step={id:'register',title:'Rekisteröi sovellus',body:()=><>
 <Path p="Entra ID › App registrations › New registration"/>
 <Val k="Name" v="Open Habitat"/>
 <Val k="Supported account types" v="Single tenant only - <organisaatio>" copy={false} testId="account-type"/>
 <p className="r3-quiet" data-testid="single-tenant">Vain organisaation työtilit. Henkilökohtaiset Microsoft-tilit eivät voi yhdistää.</p>
 <p className="r3-quiet">Jätä Redirect URI tyhjäksi ja valitse <em>Register</em>.</p>
 <Role>Vaatii vähintään roolin Application Developer.</Role>
</>};
const PUBLIC:Step={id:'public',title:'Julkinen asiakas',body:()=><>
 <Path p="Authentication › Settings"/>
 <Val k="Allow public client flows" v="Enabled" copy={false} testId="public-flows"/>
 <p className="r3-quiet">Valitse <em>Save</em>. Henkilöt kirjautuvat laitekoodilla, joten client secretiä ei luoda.</p>
 <Path p="Authentication › Redirect URI configuration › Add Redirect URI › Mobile and desktop applications"/>
 <Val k="Redirect URI" v={NATIVE} testId="redirect"/>
</>};
const PERMISSIONS:Step={id:'permissions',title:'Käyttöoikeudet',body:()=><>
 <Path p="API permissions › Add a permission › Microsoft Graph › Delegated permissions"/>
 <div className="r3-scopes" data-testid="permissions"><pre className="cmd">{PERMS.join('\n')}</pre><Copy value={PERMS.join(' ')} label="käyttöoikeudet"/></div>
 <p className="r3-quiet">User.Read on valmiina. Valitse lopuksi <em>Add permissions</em>.</p>
</>};
const CONSENT:Step={id:'consent',title:'Hyväksyntä',body:f=>{
 const exact=f.early&&GUID.test(f.tenantId.trim())&&GUID.test(f.clientId.trim());
 const link=exact?consentLink(f.tenantId.trim(),f.clientId.trim()):consentLink('{Directory (tenant) ID}','{Application (client) ID}');
 return <>
  <Path p="API permissions › Grant admin consent for <organisaatio> › Yes"/>
  <p className="r3-quiet" data-testid="consent-effect">Henkilöiltä ei kysytä hyväksyntää. Status-sarakkeessa lukee <em>Granted for &lt;organisaatio&gt;</em>.</p>
  <Role>Vaatii roolin Cloud Application Administrator, Application Administrator tai Privileged Role Administrator.</Role>
  <div className="r4-handoff" data-testid="handoff" data-exact={exact||undefined}>
   <span className="r3-k">Jos rooli puuttuu, lähetä linkki sille, jolla se on:</span>
   <div className="r3-scopes"><pre className="cmd">{link}</pre>{exact&&<Copy value={link} label="hyväksyntälinkki"/>}</div>
   {!exact&&<span className="r3-quiet">Arvot ovat sovelluksen Overview-sivulla.</span>}
  </div>
 </>;
}};

function Fields({f}:{f:Form}){
 return <div className="r3-fields" data-testid="fields">
  <TextField data-testid="client-id" label="Application (client) ID" mono value={f.clientId} onChange={f.setClientId} error={f.errors.client}/>
  <TextField data-testid="tenant-id" label="Directory (tenant) ID" mono value={f.tenantId} onChange={f.setTenantId} error={f.errors.tenant}/>
  <p className="r3-quiet" data-testid="no-secret">Salaisuutta ei tarvita.</p>
 </div>;
}
const ENTER:Step={id:'enter',title:'Tunnukset',body:f=><><Path p="Overview"/><Fields f={f}/></>};

function useForm(onSave:(a:App)=>void,early:boolean):Form{
 const [clientId,setClientId]=useState(''),[tenantId,setTenantId]=useState('');
 const [errors,setErrors]=useState<Form['errors']>({}),[pending,setPending]=useState(false);
 const check=()=>{
  const c=clientId.trim(),t=tenantId.trim(),e:Form['errors']={};
  if(!GUID.test(c))e.client='Tarkista Application (client) ID: muotoa 8-4-4-4-12 merkkiä.';
  if(!GUID.test(t))e.tenant='Tarkista Directory (tenant) ID: muotoa 8-4-4-4-12 merkkiä.';
  else if(t.toLowerCase()===c.toLowerCase())e.tenant='Tämä on sama kuin client id.';
  setErrors(e);return !e.client&&!e.tenant;
 };
 const submit=()=>{if(!check())return;setPending(true);onSave({clientId:clientId.trim(),tenantId:tenantId.trim(),at:'24.10. Kaisa Admin'});};
 const edit=(set:(v:string)=>void,k:keyof Form['errors'])=>(v:string)=>{set(v);setErrors(e=>({...e,[k]:undefined}));};
 return {clientId,setClientId:edit(setClientId,'client'),tenantId,setTenantId:edit(setTenantId,'tenant'),errors,check,pending,submit,early};
}
type GuideProps={theme:string;onClose:()=>void;onSave:(a:App)=>void;pending:boolean};

// ---------- Both directions: round 3's Vaiheittain stepper ----------

// Direction 1 keeps Google's order: console work first, the values last.
// Direction 2 asks for the values on the Overview page Entra opens after
// Register; the steps after it then show the exact consent link. Saving is
// still the last step, so no person can try a half-configured app.
const ORDER=[[REGISTER,PUBLIC,PERMISSIONS,CONSENT,ENTER],[REGISTER,ENTER,PUBLIC,PERMISSIONS,CONSENT]];

function Stepper({direction,theme,onClose,onSave,pending}:GuideProps&{direction:number}){
 const early=direction===1,f=useForm(onSave,early);f.pending=pending;
 const [skipped,setSkipped]=useState(false);
 const all=skipped?[ENTER]:ORDER[direction]!;
 const [at,setAt]=useState(0),i=Math.min(at,all.length-1),last=i===all.length-1,s=all[i]!;
 const next=()=>{if(s.id==='enter'&&!f.check())return;setAt(i+1);};
 return <ModalOverlay className="ah-overlay" isOpen isDismissable={!pending} onOpenChange={o=>!o&&onClose()}><Modal className="ah-modal r3-modal r3-narrow" data-theme={theme}><Dialog className="ah-dialog r3-dialog" data-testid="guide" data-direction={early?'early':'late'} aria-label="Microsoft 365: aseta tunnukset">
  <Heading slot="title">Microsoft 365: aseta tunnukset</Heading>
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
    :<Button data-testid="next" size="page" variant="primary" onPress={next}>Seuraava</Button>}
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
  <ul className="consequences"><li>Uusia tilejä ei voi yhdistää.</li><li>Yhdistetyt tilit eivät voi kirjautua uudelleen.</li>{site.steps.includes(e.id)&&<li>Käyttöönoton vaihe piilotetaan.</li>}</ul>
  {e.id==='microsoft'&&<p className="r3-quiet" data-testid="remove-other">Toisen sovelluksen voi asettaa poiston jälkeen.</p>}
  <div className="dlg-foot"><Button size="row" variant="secondary" onPress={onClose}>Peruuta</Button><Button data-testid="confirm-remove" size="page" variant="danger" onPress={()=>onRemove(e.id)}>Poista tunnukset</Button></div></>
 :<>
  <Heading slot="title">{name(e.id)}: tunnukset</Heading>
  <p>{e.id==='google'?'Kierroksen 3 Vaiheittain. Ei tämän kierroksen aihe.':'Tulee omalla kierroksellaan.'}</p>
  <div className="dlg-foot"><Button size="page" variant="primary" onPress={onClose}>Sulje</Button></div></>;
 return <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={o=>!o&&onClose()}><Modal className="ah-modal act-modal" data-theme={theme}><Dialog className="ah-dialog act-dialog" data-testid="act-dialog" data-kind={act.kind} aria-label={name(e.id)}>{body}</Dialog></Modal></ModalOverlay>;
}

// ---------- Round 2's chosen tab: Käytössä vai ei ----------

// Microsoft has no secret to renew, so its menu has no Vaihda: another app is
// set by removing these and setting again (Jari's rule from round 3).
const menuItems=(id:ProviderId)=>id==='microsoft'?[{id:'remove',label:'Poista tunnukset…',danger:true}]:[{id:'replace',label:'Vaihda tunnukset…'},{id:'remove',label:'Poista tunnukset…',danger:true}];
function Rows({site,on,guide,goto}:{site:Site;on:(a:Act)=>void;guide:()=>void;goto:()=>void}){
 return <ul className="ig-admin s-card r2-list r2-plain" data-testid="ig-rows">{catalog.map(e=>{const s=statusOf(site,e);return <li key={e.id} className="r2-row" data-testid={`row-${e.id}`} data-status={s}>
  <ProviderMark provider={e.id} small/>
  <div className="r2-main"><div className="r2-head"><span className="ig-rn">{name(e.id)}</span><StepBadge site={site} e={e} goto={goto}/></div></div>
  <div className="r2-state"><Mark site={site} e={e}/></div>
  <div className="r2-act">{s==='needs_app'?<Button data-testid={`setup-${e.id}`} size="row" variant="secondary" onPress={()=>e.id==='microsoft'?guide():on({kind:'later',id:e.id})}>Aseta tunnukset…</Button>
   :s==='tool_missing'?<Button data-testid={`tool-${e.id}`} size="row" variant="secondary" onPress={()=>on({kind:'tool',id:e.id})}>Korjaa…</Button>
   :s==='ready'&&e.app?<span data-testid={`menu-wrap-${e.id}`}><Menu label={`${name(e.id)}: tunnukset`} trigger={<span>Tunnukset</span>} placement="bottom end" heading={<AppLine site={site} e={e}/>} items={menuItems(e.id)} onAction={k=>k==='remove'?on({kind:'remove',id:e.id}):on({kind:'later',id:e.id})}/></span>:null}</div>
 </li>;})}</ul>;
}

// ---------- The page ----------

type Tab='server'|'integrations'|'onboarding'|'users';
let reviewTheme='light',reviewPhone=false,reviewServer:Server='google';
function App({direction}:{direction:number}){
 const [theme,setTheme]=useState(reviewTheme),[phone,setPhone]=useState(reviewPhone);
 const [server,setServer]=useState<Server>(reviewServer);
 const [site,setSite]=useState<Site>(()=>siteOf(reviewServer));
 const [tab,setTab]=useState<Tab>('integrations');
 const [act,setAct]=useState<Act>(null),[notice,setNotice]=useState('');
 const [guide,setGuide]=useState(0); // 0 closed; otherwise a key that remounts the form
 useEffect(()=>{setNotice('');setGuide(0);},[server]);
 const tabs:[Tab,string][]=[['server','Palvelin'],['integrations','Integraatiot'],['onboarding','Käyttöönotto'],['users','Käyttäjät ja pääsy']];
 const pending=(id:ProviderId,done:(s:Site)=>Site,msg:string,after?:()=>void)=>{setAct(null);setNotice('');setSite(s=>({...s,saving:[...s.saving,id]}));setTimeout(()=>{setSite(s=>done({...s,saving:s.saving.filter(p=>p!==id)}));setNotice(msg);after?.();},900);};
 // The guide stays open until the server confirms, then closes onto the row.
 const save=(a:App)=>pending('microsoft',s=>({...s,apps:{...s.apps,microsoft:a}}),'Microsoft 365: tunnukset tallennettu.',()=>setGuide(0));
 const remove=(id:ProviderId)=>pending(id,s=>{const apps={...s.apps};delete apps[id];return {...s,apps};},`${name(id)}: tunnukset poistettu.`);
 const openGuide=()=>{setNotice('');setGuide(g=>g+1);};
 const integrations=<><h2>Integraatiot</h2>{notice&&<p role="status" className="notice" data-testid="notice">{notice}</p>}<Rows site={site} on={setAct} guide={openGuide} goto={()=>setTab('onboarding')}/></>;
 const serverTab=<><h2>Palvelin</h2><div className="facts s-card"><div className="s-row"><strong>Northstar</strong><code>habitat.example.test</code></div><div className="s-row"><strong>Versio</strong><code>v0.0.0-prototype</code></div></div></>;
 return <div data-theme={theme} className={phone?'review phone':'review'}><header className="reviewbar"><strong>Palvelimen integraatiot · kierros 4</strong><label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label><label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);}}/> 390 px</label><p>Synteettiset tiedot. Ei yhteyttä palvelimeen eikä Microsoftiin.</p></header>
 <div className="scenario"><span className="muted">Esimerkkipalvelin</span><Segmented data-testid="server" label="Esimerkkipalvelin" size="row" options={(Object.keys(servers) as Server[]).map(s=>({id:s,label:servers[s].label}))} value={server} onChange={s=>{reviewServer=s;setServer(s);setSite(siteOf(s));}}/><span className="muted" data-testid="server-hint">{servers[server].hint}</span></div>
 <p className="axis">Microsoft 365:n ohjattu asetus vaiheittain: kysytäänkö tunnukset lopussa vai heti rekisteröinnin jälkeen. Suositus: Tunnukset heti.</p>
 <div className={`shell variant-${direction}`}><div className="hostbar"><strong>Open Habitat</strong><span>Northstar · esimerkkisivusto</span><Icon name="user"/></div><section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>{['Tili','Agentit','Integraatiot','Ulkoasu','Editori'].map(n=><span className="s-nav-i" key={n}>{n}</span>)}<span className="s-nav-h">Palvelimen ylläpito</span>{tabs.map(([id,label])=><button type="button" key={id} className="s-nav-i" data-testid={`tab-${id}`} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{label}</button>)}<span className="s-nav-i">Levytila</span></nav><main className="s-main">
 <nav className="mobiletabs" aria-label="Palvelimen ylläpito"><span className="muted">Asetukset › Palvelimen ylläpito</span><div>{tabs.map(([id,label])=><button type="button" key={id} data-testid={`mtab-${id}`} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{label}</button>)}</div></nav>
 {tab==='integrations'?integrations:tab==='onboarding'?<><h2>Käyttöönotto</h2><p className="muted">Kierroksen 1 säännöt. Ei tämän kierroksen aihe.</p></>:tab==='users'?<><h2>Käyttäjät ja pääsy</h2><p className="muted">Ei tämän kierroksen aihe.</p></>:serverTab}
 </main></section></div>
 {guide>0&&<Stepper key={guide} direction={direction} theme={theme} onClose={()=>setGuide(0)} onSave={save} pending={site.saving.includes('microsoft')}/>}
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
