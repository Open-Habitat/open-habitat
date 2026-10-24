import React, {useEffect, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, DisclosureButton, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {Menu} from '../../../../web/src/components/Overlays';
import {Badge, StatusMark} from '../../../../web/src/components/Status';
import {ProviderMark, providerCopy} from '../../../../web/src/components/Integrations';
import type {ProviderId} from '../../../../web/src/app/integrations';
import type {Tone} from '../../../../web/src/components/types';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/Integrations.css';
import './round.css';

// Round 2 of the server administrator's integrations setup. Jari chose round
// 1's direction 1 (its own tab, one row per catalog entry) and removed the
// person preview, the intro, the authority explanation and the counts row.
// This round riffs on the row itself: how status reads, how much of the
// consequence for people and onboarding remains, where the credential actions
// live, how ready DAV rows stay quiet and how a missing tool is fixed. The
// guided credential setup is still a placeholder. Everything is synthetic.
const directions=['Tila ja lause','Käytössä vai ei','Avattava rivi'];

// ---------- The catalog, as internal/daemon/integrations defines it ----------

type Status='ready'|'needs_app'|'tool_missing'|'saving';
type Entry={id:ProviderId;tools:string[];app?:{where:string;fields:string[]}};
// Order as catalog_linux.go's providerOrder.
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

// ---------- Synthetic server states ----------

type Server='fresh'|'google'|'partial';
const servers:Record<Server,{label:string;hint:string;apps:ProviderId[];missing:string[]}>={
 fresh:{label:'Uusi asennus',hint:'Työkalut asennettu, sovellustunnuksia ei vielä.',apps:[],missing:[]},
 google:{label:'Google asetettu',hint:'Googlen tunnukset asetettu, Microsoft ja Dropbox puuttuvat.',apps:['google'],missing:[]},
 partial:{label:'Vajaa asennus',hint:'Vanha asennus, josta rclone puuttuu.',apps:['google'],missing:['rclone']},
};
type App={suffix:string;at:string};
type Site={apps:Partial<Record<ProviderId,App>>;missing:string[];saving:ProviderId[];steps:ProviderId[]};
const siteOf=(s:Server):Site=>({apps:Object.fromEntries(servers[s].apps.map(p=>[p,{suffix:'3f9a',at:'24.10. Kaisa Admin'}])),missing:servers[s].missing,saving:[],steps:['google']});
const statusOf=(site:Site,e:Entry):Status=>site.saving.includes(e.id)?'saving':e.tools.some(t=>site.missing.includes(t))?'tool_missing':e.app&&!site.apps[e.id]?'needs_app':'ready';
const missingOf=(site:Site,e:Entry)=>e.tools.filter(t=>site.missing.includes(t));
const kindOf=(s:Status)=>s==='ready'?'success':s==='tool_missing'?'error':'neutral';

// Round 1's wording (directions 1 and 3) and the shortest wording (direction 2).
const longText:Record<Status,[string,Tone]>={ready:['Valmiina käyttöön','success'],needs_app:['Tarvitsee sovellustunnukset','warning'],tool_missing:['Työkalu puuttuu','danger'],saving:['Odottaa palvelinta','info']};
const Mark=({site,e,short}:{site:Site;e:Entry;short?:boolean})=>{
 const s=statusOf(site,e);
 const [label,tone]=short?({ready:['Käytössä','success'],needs_app:['Ei käytössä','warning'],tool_missing:[`Ei käytössä · ${missingOf(site,e).join(', ')} puuttuu`,'danger'],saving:['Odottaa palvelinta','info']} as Record<Status,[string,Tone]>)[s]:longText[s];
 return <StatusMark data-testid="ig-status" label={label} tone={tone} animated={s==='saving'?'running':false} kind={kindOf(s)}/>;
};
const AppLine=({site,e}:{site:Site;e:Entry})=>e.app&&site.apps[e.id]?<span className="r2-app" data-testid={`app-${e.id}`}>{e.app.where} · client id <code>…{site.apps[e.id]!.suffix}</code> · {site.apps[e.id]!.at}</span>:null;

// ---------- Shared pieces: copyable fix command, step badge ----------

function FixCommand(){
 const [copied,setCopied]=useState('');
 const copy=async()=>{try{await navigator.clipboard.writeText(FIX);setCopied('Kopioitu.');}catch{setCopied('Kopioi komento itse.');}};
 return <div className="r2-fix" data-testid="fix-command"><pre className="cmd">{FIX}</pre><Button size="row" variant="secondary" aria-label="Kopioi komento" onPress={()=>void copy()}><Icon name="copy" width={14} height={14}/></Button>{copied&&<span role="status" className="muted">{copied}</span>}</div>;
}
/** Onboarding shown only when a step exists; nothing otherwise. */
function StepBadge({site,e,goto}:{site:Site;e:Entry;goto:()=>void}){
 if(!site.steps.includes(e.id))return null;
 const hidden=statusOf(site,e)!=='ready';
 return <button type="button" className="r2-step" data-testid={`onb-${e.id}`} data-hidden={hidden||undefined} onClick={goto} aria-label={`Käyttöönotto: ${name(e.id)}-vaihe${hidden?', piilossa':''}`}><Badge label={hidden?'Käyttöönotossa · piilossa':'Käyttöönotossa'} tone={hidden?'warning':'neutral'}/></button>;
}

// ---------- Dialogs: setup placeholder, removal, fix ----------

type Act={kind:'setup'|'remove'|'tool';id:ProviderId}|null;
function ActDialog({act,site,theme,onClose,onSave,onRemove}:{act:NonNullable<Act>;site:Site;theme:string;onClose:()=>void;onSave:(id:ProviderId)=>void;onRemove:(id:ProviderId)=>void}){
 const e=entry(act.id),replace=!!site.apps[e.id];
 const body=act.kind==='tool'?<>
  <Heading slot="title">{name(e.id)}: {missingOf(site,e).join(', ')} puuttuu</Heading>
  <p>Aja palvelimella:</p><FixCommand/>
  <div className="dlg-foot"><Button size="page" variant="primary" onPress={onClose}>Sulje</Button></div></>
 :act.kind==='remove'?<>
  <Heading slot="title">Poistetaanko {name(e.id)}-tunnukset?</Heading>
  <ul className="consequences"><li>Uusia tilejä ei voi yhdistää.</li><li>Yhdistetyt tilit eivät voi kirjautua uudelleen.</li>{site.steps.includes(e.id)&&<li>Käyttöönoton vaihe piilotetaan.</li>}</ul>
  <div className="dlg-foot"><Button size="row" variant="secondary" onPress={onClose}>Peruuta</Button><Button data-testid="confirm-remove" size="page" variant="danger" onPress={()=>onRemove(e.id)}>Poista tunnukset</Button></div></>
 :<>
  <Heading slot="title">{name(e.id)}: {replace?'vaihda tunnukset':'aseta tunnukset'}</Heading>
  <p>Ohjattu asetus tulee kierroksella 3. Se kysyy: {e.app!.fields.join(' ja ')}.</p>
  {replace&&<p className="warn-line"><Icon name="warning" width={16} height={16}/><span>Yhdistettyjen tilien täytyy ehkä kirjautua uudelleen.</span></p>}
  <p className="proto-note">Prototyypissä painike tallentaa keksityt tunnukset 0,9 sekunnin viiveellä.</p>
  <div className="dlg-foot"><Button size="row" variant="secondary" onPress={onClose}>Peruuta</Button><Button data-testid="simulate-save" size="page" variant="primary" onPress={()=>onSave(e.id)}>Simuloi: tallennettu</Button></div></>;
 return <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={o=>!o&&onClose()}><Modal className="ah-modal act-modal" data-theme={theme}><Dialog className="ah-dialog act-dialog" data-testid="act-dialog" data-kind={act.kind} aria-label={name(e.id)}>{body}</Dialog></Modal></ModalOverlay>;
}
type RowProps={site:Site;on:(a:Act)=>void;goto:()=>void};

// ---------- Direction 1: status and one sentence, buttons on the row ----------

/** At most one sentence, and only when something is not as it should be. */
function sentence(site:Site,e:Entry):string|null{
 const s=statusOf(site,e);
 if(s==='needs_app')return 'Henkilöt eivät voi vielä yhdistää.';
 if(s==='saving')return 'Voimassa, kun palvelin vahvistaa.';
 return null;
}
function Sentence({site,on,goto}:RowProps){
 // One fix for the whole server, so it is said once above the rows.
 const missing=site.missing.filter(t=>catalog.some(e=>e.tools.includes(t)));
 return <>{missing.length>0&&<div className="r2-banner s-card" data-testid="fix-banner" role="note"><p className="r2-line"><Icon name="warning" width={16} height={16}/>Palvelimelta puuttuu <code>{missing.join(', ')}</code>. Aja palvelimella:</p><FixCommand/></div>}<ul className="ig-admin s-card r2-list" data-testid="ig-rows">{catalog.map(e=>{const s=statusOf(site,e),line=sentence(site,e);return <li key={e.id} className="r2-row" data-testid={`row-${e.id}`} data-status={s}>
  <ProviderMark provider={e.id}/>
  <div className="r2-main"><div className="r2-head"><span className="ig-rn">{name(e.id)}</span><Mark site={site} e={e}/><StepBadge site={site} e={e} goto={goto}/></div>
   {line&&<span className="r2-line" data-testid={`people-${e.id}`}>{line}</span>}
   {s==='tool_missing'&&<span className="r2-line" data-testid={`people-${e.id}`}>Henkilöt eivät voi yhdistää. Puuttuu <code>{missingOf(site,e).join(', ')}</code>.</span>}
   <AppLine site={site} e={e}/>
  </div>
  <div className="r2-act">{s==='needs_app'?<Button data-testid={`setup-${e.id}`} size="row" variant="primary" onPress={()=>on({kind:'setup',id:e.id})}>Aseta tunnukset…</Button>
   :s==='ready'&&e.app?<span className="row-acts"><Button data-testid={`replace-${e.id}`} size="row" variant="quiet" onPress={()=>on({kind:'setup',id:e.id})}>Vaihda…</Button><Button data-testid={`remove-${e.id}`} size="row" variant="quiet" aria-label={`Poista ${name(e.id)}-tunnukset`} onPress={()=>on({kind:'remove',id:e.id})}>Poista</Button></span>:null}</div>
 </li>;})}</ul></>;
}

// ---------- Direction 2: the status is the consequence, rare actions in a menu ----------

function Plain({site,on,goto}:RowProps){
 return <ul className="ig-admin s-card r2-list r2-plain" data-testid="ig-rows">{catalog.map(e=>{const s=statusOf(site,e);return <li key={e.id} className="r2-row" data-testid={`row-${e.id}`} data-status={s}>
  <ProviderMark provider={e.id} small/>
  <div className="r2-main"><div className="r2-head"><span className="ig-rn">{name(e.id)}</span><StepBadge site={site} e={e} goto={goto}/></div></div>
  <div className="r2-state"><Mark site={site} e={e} short/></div>
  <div className="r2-act">{s==='needs_app'?<Button data-testid={`setup-${e.id}`} size="row" variant="secondary" onPress={()=>on({kind:'setup',id:e.id})}>Aseta tunnukset…</Button>
   :s==='tool_missing'?<Button data-testid={`tool-${e.id}`} size="row" variant="secondary" onPress={()=>on({kind:'tool',id:e.id})}>Korjaa…</Button>
   :s==='ready'&&e.app?<span data-testid={`menu-wrap-${e.id}`}><Menu label={`${name(e.id)}: tunnukset`} trigger={<span>Tunnukset</span>} placement="bottom end" heading={<AppLine site={site} e={e}/>} items={[{id:'replace',label:'Vaihda tunnukset…'},{id:'remove',label:'Poista tunnukset…',danger:true}]} onAction={k=>on({kind:k==='remove'?'remove':'setup',id:e.id})}/></span>:null}</div>
 </li>;})}</ul>;
}

// ---------- Direction 3: one quiet line per service, details open in place ----------

function Expanding({site,on,goto}:RowProps){
 const [open,setOpen]=useState<ProviderId[]>([]);
 const toggle=(id:ProviderId)=>setOpen(o=>o.includes(id)?o.filter(x=>x!==id):[...o,id]);
 return <ul className="ig-admin s-card r2-list r2-exp" data-testid="ig-rows">{catalog.map(e=>{
  const s=statusOf(site,e),has=!!e.app||s==='tool_missing',isOpen=has&&open.includes(e.id);
  const head=<><ProviderMark provider={e.id} small/><span className="ig-rn">{name(e.id)}</span><span className="r2-grow"/><Mark site={site} e={e}/></>;
  return <li key={e.id} className="r2-xrow" data-testid={`row-${e.id}`} data-status={s} data-open={isOpen||undefined}>
   {has?<DisclosureButton data-testid={`open-${e.id}`} aria-expanded={isOpen} onPress={()=>toggle(e.id)}>{head}<span aria-hidden="true" className="r2-chev"/></DisclosureButton>:<div className="r2-xhead">{head}<span className="r2-chev-space"/></div>}
   {isOpen&&<div className="r2-xbody">
    {s==='needs_app'&&<p className="r2-line" data-testid={`people-${e.id}`}>Henkilöt eivät voi vielä yhdistää.</p>}
    {s==='saving'&&<p className="r2-line" data-testid={`people-${e.id}`}>Voimassa, kun palvelin vahvistaa.</p>}
    {s==='tool_missing'&&<><p className="r2-line" data-testid={`people-${e.id}`}>Puuttuu <code>{missingOf(site,e).join(', ')}</code>. Aja palvelimella:</p><FixCommand/></>}
    <AppLine site={site} e={e}/>
    {site.steps.includes(e.id)&&<p className="r2-line">Käyttöönoton vaihe{s==='ready'?'':', piilossa'} · <button type="button" className="linkish" data-testid={`onb-${e.id}`} onClick={goto}>Käyttöönotto</button></p>}
    {s==='needs_app'?<div className="r2-xact"><Button data-testid={`setup-${e.id}`} size="row" variant="primary" onPress={()=>on({kind:'setup',id:e.id})}>Aseta tunnukset…</Button></div>
     :s==='ready'&&e.app?<div className="r2-xact"><Button data-testid={`replace-${e.id}`} size="row" variant="secondary" onPress={()=>on({kind:'setup',id:e.id})}>Vaihda…</Button><Button data-testid={`remove-${e.id}`} size="row" variant="quiet" aria-label={`Poista ${name(e.id)}-tunnukset`} onPress={()=>on({kind:'remove',id:e.id})}>Poista</Button></div>:null}
   </div>}
  </li>;})}</ul>;
}

// ---------- Käyttöönotto: just the integration steps, as in round 1 ----------

function OnboardingTab({site,setSite,goto}:{site:Site;setSite:(f:(s:Site)=>Site)=>void;goto:()=>void}){
 const [adding,setAdding]=useState(false);
 const addable=catalog.filter(e=>!site.steps.includes(e.id));
 return <><h2>Käyttöönotto</h2><p className="lede">Vain integraatiovaiheet. Muu välilehti on kierroksen 6 mukainen.</p>
  <div className="s-card onb-steps"><p className="eyebrow">Integraatiovaiheet</p><ul data-testid="onb-steps">{site.steps.map(id=>{const e=entry(id),s=statusOf(site,e);return <li key={id} data-testid={`onb-step-${id}`} data-status={s}><ProviderMark provider={id} small/><span className="ig-rn">{name(id)}</span>{s==='ready'?<span className="muted">Voi ohittaa</span>:<span className="hidden-step"><StatusMark label="Piilossa uusilta henkilöiltä" tone="warning"/><button type="button" className="linkish" onClick={goto}>{longText[s][0]}</button></span>}<Button size="row" variant="quiet" aria-label={`Poista vaihe ${name(id)}`} onPress={()=>setSite(x=>({...x,steps:x.steps.filter(p=>p!==id)}))}><Icon name="cross" width={14} height={14}/></Button></li>;})}</ul>
   {!site.steps.length&&<p className="muted">Ei integraatiovaiheita.</p>}
   <Button data-testid="onb-add" size="row" variant="secondary" onPress={()=>setAdding(v=>!v)}><Icon name="plus" width={14} height={14}/>Lisää integraatio</Button>
   {adding&&<ul className="onb-add" data-testid="onb-add-list">{addable.map(e=>{const s=statusOf(site,e);return <li key={e.id}><ProviderMark provider={e.id} small/><span className="ig-rn">{name(e.id)}</span>{s==='ready'?<Button data-testid={`onb-add-${e.id}`} size="row" variant="quiet" onPress={()=>{setSite(x=>({...x,steps:[...x.steps,e.id]}));setAdding(false);}}>Lisää</Button>:<span className="muted" data-testid={`onb-blocked-${e.id}`}>{longText[s][0]}</span>}</li>;})}</ul>}
  </div></>;
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
 useEffect(()=>{setNotice('');},[server]);
 const tabs:[Tab,string][]=[['server','Palvelin'],['integrations','Integraatiot'],['onboarding','Käyttöönotto'],['users','Käyttäjät ja pääsy']];
 const pending=(id:ProviderId,done:(s:Site)=>Site,msg:string)=>{setAct(null);setNotice('');setSite(s=>({...s,saving:[...s.saving,id]}));setTimeout(()=>{setSite(s=>done({...s,saving:s.saving.filter(p=>p!==id)}));setNotice(msg);},900);};
 const save=(id:ProviderId)=>pending(id,s=>({...s,apps:{...s.apps,[id]:{suffix:'b71c',at:'24.10. Kaisa Admin'}}}),`${name(id)}: tunnukset tallennettu.`);
 const remove=(id:ProviderId)=>pending(id,s=>{const apps={...s.apps};delete apps[id];return {...s,apps};},`${name(id)}: tunnukset poistettu.`);
 const rowProps={site,on:setAct,goto:()=>setTab('onboarding')};
 const view=direction===0?<Sentence {...rowProps}/>:direction===1?<Plain {...rowProps}/>:<Expanding {...rowProps}/>;
 const integrations=<><h2>Integraatiot</h2>{notice&&<p role="status" className="notice" data-testid="notice">{notice}</p>}{view}</>;
 const serverTab=<><h2>Palvelin</h2><div className="facts s-card"><div className="s-row"><strong>Northstar</strong><code>habitat.example.test</code></div><div className="s-row"><strong>Versio</strong><code>v0.0.0-prototype</code></div><div className="s-row"><strong>Oletuslevytila</strong><span>20 Gt / henkilö</span></div></div></>;
 return <div data-theme={theme} className={phone?'review phone':'review'}><header className="reviewbar"><strong>Palvelimen integraatiot · kierros 2</strong><label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label><label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);}}/> 390 px</label><p>Synteettiset tiedot. Ei yhteyttä palvelimeen.</p></header>
 <div className="scenario"><span className="muted">Esimerkkipalvelin</span><Segmented data-testid="server" label="Esimerkkipalvelin" size="row" options={(Object.keys(servers) as Server[]).map(s=>({id:s,label:servers[s].label}))} value={server} onChange={s=>{reviewServer=s;setServer(s);setSite(siteOf(s));}}/><span className="muted" data-testid="server-hint">{servers[server].hint}</span></div>
 <p className="axis">Miten rivi kertoo tilan ja seuraukset ja missä sen toiminnot ovat: tila ja lause, käytössä vai ei, avattava rivi. Suositus: Käytössä vai ei.</p>
 <div className={`shell variant-${direction}`}><div className="hostbar"><strong>Open Habitat</strong><span>Northstar · esimerkkisivusto</span><Icon name="user"/></div><section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>{['Tili','Agentit','Integraatiot','Ulkoasu','Editori'].map(n=><span className="s-nav-i" key={n}>{n}</span>)}<span className="s-nav-h">Palvelimen ylläpito</span>{tabs.map(([id,label])=><button type="button" key={id} className="s-nav-i" data-testid={`tab-${id}`} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{label}</button>)}<span className="s-nav-i">Levytila</span></nav><main className="s-main">
 <nav className="mobiletabs" aria-label="Palvelimen ylläpito"><span className="muted">Asetukset › Palvelimen ylläpito</span><div>{tabs.map(([id,label])=><button type="button" key={id} data-testid={`mtab-${id}`} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{label}</button>)}</div></nav>
 {tab==='integrations'?integrations:tab==='onboarding'?<OnboardingTab site={site} setSite={setSite} goto={()=>setTab('integrations')}/>:tab==='users'?<><h2>Käyttäjät ja pääsy</h2><p className="muted">Kierroksen 6 mukainen. Ei tämän kierroksen aihe.</p></>:serverTab}
 </main></section></div>
 {act&&<ActDialog act={act} site={site} theme={theme} onClose={()=>setAct(null)} onSave={save} onRemove={remove}/>}
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
directions.forEach((n,i)=>{const button=document.createElement('button');button.className='proto-picker-item';button.textContent=n.replaceAll(' ',' ');if(i===0){button.setAttribute('data-active','');button.setAttribute('aria-current','true');}picker.append(button);});
document.body.append(picker);
new Function('stage','variants',pickerSource)(stageSink,variants);
