import React, {useEffect, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, useLocation, useNavigate} from 'react-router';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {GitHubRepoChooser} from '../../../../web/src/components/GitHubRepoChooser';
import {LoginCard} from '../../../../web/src/components/LoginCard';
import {OnboardingFrame} from '../../../../web/src/components/OnboardingFrame';
import {PiDeviceSignIn, type PiDeviceSignInView} from '../../../../web/src/components/PiDeviceSignIn';
import {OnboardingClones, RepoFinder, type RepoChoice} from '../../../../web/src/components/ClonePage';
import {arrange, exactName, type CatalogRepo, type Since} from '../../../../web/src/components/repoCatalog';
import {AgentWarning, ConnectDialog, ProviderMark, providerCopy, serviceName} from '../../../../web/src/components/Integrations';
import type {Provider, ProviderId} from '../../../../web/src/app/integrations';
import {ClaudeSignIn} from '../../../../web/src/app/ClaudeSignIn';
import {PiCredentials} from '../../../../web/src/app/PiCredentials';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/Integrations.css';
import './round.css';

// Everything below is synthetic and in memory. The production AI-account
// components read their state on mount; answer those reads here, so nothing
// leaves the page and no request is refused by the review sandbox.
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
const realFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url,method=(init?.method??'GET').toUpperCase();
 if(url.includes('/api/v1/pi/claude-login'))return json(method==='POST'?{schema_version:1,state:'code',attempt_id:'20261023T120000.000000000',verification_uri:'https://claude.com/cai/oauth/authorize?prototype'}:method==='PUT'?{schema_version:1,state:'completed'}:{schema_version:1,state:'missing'});
 if(url.includes('/api/v1/pi/credentials'))return json({schema_version:1,openai:{present:false,suffix:null},subscription:{present:false}});
 if(url.startsWith('/'))return new Response('',{status:404});
 return realFetch(input,init);
};

const directions=['Kartta vieressä','Lista reittinä','Erillinen kokeilu'];
type Mode='preselected'|'auto'|'skip';
type AiDefault='openai'|'claude'|'api-key';
type Draft={mode:Mode;repos:string[];integrations:{id:ProviderId;required:boolean}[];ai:AiDefault};
const initial:Draft={mode:'preselected',repos:['northstar-demo/product','northstar-demo/design-system'],integrations:[{id:'google',required:false}],ai:'openai'};
// The providers of Settings › Integraatiot, in its order. The onboarding keeps
// this order; the administrator chooses which of them are steps, not where.
const providers:Provider[]=[
 {id:'google',available:true,login:'pasted_redirect',services:['mail','calendar','contacts','drive']},
 {id:'microsoft',available:true,login:'device_code',services:['mail','calendar','contacts','onedrive']},
 {id:'dropbox',available:true,login:'pasted_redirect',services:['dropbox']},
 {id:'imap',available:true,login:'app_password',services:['mail','calendar','contacts']},
];
const provider=(id:ProviderId)=>providers.find(p=>p.id===id)!;
const aiChoices:{id:AiDefault;label:string;how:string}[]=[
 {id:'openai',label:'ChatGPT / OpenAI',how:'Tilauksella, kirjautuminen OpenAIn sivulla lyhyellä koodilla.'},
 {id:'claude',label:'Claude-tilaus',how:'Tilauksella, kirjautuminen Clauden sivulla ja koodi takaisin tänne.'},
 {id:'api-key',label:'OpenAI API-avain',how:'Henkilö liittää oman avaimensa; OpenAI laskuttaa käytöstä.'},
];
const aiName=(id:AiDefault)=>aiChoices.find(c=>c.id===id)!.label;
const day=86400000,now=Date.parse('2026-10-23T12:00:00Z');
const ago=(d:number|null)=>d===null?null:new Date(now-d*day).toISOString();
const repo=(full_name:string,description:string,age:number|null,size_kib=4200,priv=true,owner_type:'User'|'Organization'='Organization'):CatalogRepo=>({full_name,description,pushed_at:ago(age),size_kib,private:priv,default_branch:'main',owner_type});
// The administrator's own GitHub view. A new person's access is checked with
// their own account; a default they cannot read is not shown to them.
const adminCatalog:CatalogRepo[]=[
 repo('northstar-demo/product','Synteettinen tuotekehitysrepo',0.2),
 repo('northstar-demo/design-system','Komponentit ja tokenit',1),
 repo('northstar-demo/infra','Palvelinten asetukset',2),
 repo('northstar-demo/docs','Käyttöohjeet',6,1800,false),
 repo('northstar-demo/mobile-app','Mobiilisovellus',12,96000),
 repo('northstar-demo/data-pipeline','Raportoinnin ajot',40),
 repo('northstar-demo/handbook','Perehdytysmateriaali',95,900,false),
 repo('northstar-demo/legacy-site','Vanha verkkosivu',420,620000),
 repo('kaisa-admin/dotfiles','Omat asetukset',3,120,false,'User'),
];
const lookupOnly=[repo('northstar-labs/research','Tutkimusmuistiinpanot',20)];

type StepKey=string; // 'github' | 'repos' | 'int:<provider>' | 'ai' | 'done'
const routeOf=(d:Draft):StepKey[]=>['github',...(d.mode==='skip'?[]:['repos']),...d.integrations.map(i=>'int:'+i.id),'ai'];
const stepName=(k:StepKey)=>k==='github'?'GitHub':k==='repos'?'Repot':k==='ai'?'AI-tili':k==='done'?'Työtilat':providerCopy[k.slice(4) as ProviderId].name;
const stepHint=(k:StepKey,d:Draft)=>k==='github'?'Kirjautuminen':k==='repos'?(d.mode==='auto'?`${d.repos.length||'Ei'} haetaan automaattisesti`:d.repos.length?`${d.repos.length} esivalittuna`:'Henkilö valitsee'):k==='ai'?`Oletus: ${aiName(d.ai)}`:d.integrations.find(i=>'int:'+i.id===k)?.required?'Pakollinen':'Voi ohittaa';
const sortIntegrations=(list:Draft['integrations'])=>[...list].sort((a,b)=>providers.findIndex(p=>p.id===a.id)-providers.findIndex(p=>p.id===b.id));

// ---------- The new person's view: the chosen Kartta route around production steps ----------

function PersonView({draft,at:asked,onAt,routeVisible=true}:{draft:Draft;at:StepKey;onAt:(k:StepKey)=>void;routeVisible?:boolean}){
 const route=routeOf(draft);
 // A step the administrator just removed is never rendered; the parent moves on next.
 const at=asked==='done'||route.includes(asked)?asked:route[route.length-1];
 const [done,setDone]=useState<Record<string,'ok'|'skipped'>>({});
 const [selected,setSelected]=useState<string[]>(draft.mode==='preselected'?draft.repos:[]);
 const [connect,setConnect]=useState<ProviderId|undefined>();
 const [ai,setAi]=useState<'openai'|'claude'>(draft.ai==='claude'?'claude':'openai');
 const [device,setDevice]=useState<PiDeviceSignInView>({phase:'start'});
 const next=(k:StepKey,state:'ok'|'skipped'='ok')=>{setDone(d=>({...d,[k]:state}));const i=route.indexOf(k);onAt(i<0||i===route.length-1?'done':route[i+1]);};
 const fetched=draft.mode==='auto'?draft.repos:draft.mode==='preselected'&&done.repos==='ok'?selected:[];
 const clones=fetched.length?<OnboardingClones rows={fetched.map((n,i)=>({full_name:n,state:i===0?'running':'waiting',stage:'receiving',percent:42,retryable:false}))}/>:null;
 const statusOf=(k:StepKey)=>k===at?'Nyt':done[k]==='ok'?'Valmis':done[k]==='skipped'?'Ohitettu':stepHint(k,draft);
 const personal=(k:StepKey)=>k.startsWith('int:')?draft.integrations.find(i=>'int:'+i.id===k)!:undefined;
 let body:React.ReactNode;
 if(at==='github')body=<LoginCard onLogin={()=>next('github')}/>;
 else if(at==='repos'&&draft.mode==='auto')body=<OnboardingFrame step={2}><div className="pv-auto"><p className="ah-eyebrow">Käyttöönotto</p><h1>Sivuston oletusrepot haetaan</h1><p>Haku alkoi kirjautumisen jälkeen omalla GitHub-tililläsi. Voit jatkaa heti; haku jatkuu taustalla.</p>{draft.repos.length?<OnboardingClones rows={draft.repos.map((n,i)=>({full_name:n,state:i===0?'running':'waiting',stage:'receiving',percent:42,retryable:false}))}/>:<p className="muted">Oletusrepoja ei ole valittu, joten mitään ei haeta.</p>}<Button data-testid="pv-auto-next" size="page" onPress={()=>next('repos')}>Jatka</Button></div></OnboardingFrame>;
 else if(at==='repos')body=<GitHubRepoChooser view={{phase:'catalog',repositories:[...adminCatalog.filter(r=>r.owner_type==='Organization'),repo('aino-demo/muistiinpanot','Omat muistiinpanot',4,80,true,'User')].map(({full_name,private:p,description,pushed_at})=>({full_name,private:p,description,pushed_at}))}} selectedNames={selected} onToggle={(n,yes)=>setSelected(s=>yes?[...s,n]:s.filter(x=>x!==n))} onProceed={names=>next('repos',names.length?'ok':'skipped')}/>;
 else if(at.startsWith('int:')){const it=personal(at)!,p=provider(it.id),copy=providerCopy[it.id],ok=done[at]==='ok';
  body=<OnboardingFrame step={2}><div className="pv-int"><p className="ah-eyebrow">Integraatio · {it.required?'pakollinen':'voi ohittaa'}</p><h1>{copy.name}</h1>
  <div data-testid={`integration-tile-${p.id}`} className="ig-tile"><ProviderMark provider={p.id}/><div><span className="ig-rn">{copy.name}</span><span className="ig-meta">{p.services.map(s=>serviceName(p.id,s)).join(' · ')}</span></div>{ok?<span className="pv-ok"><Icon name="check" width={14} height={14}/> Yhdistetty</span>:<Button data-testid="pv-connect" size="row" variant="secondary" onPress={()=>setConnect(p.id)}>Yhdistä…</Button>}</div>
  <AgentWarning/>
  <div className="pv-actions">{ok?<Button data-testid="pv-int-next" size="page" onPress={()=>next(at)}>Jatka</Button>:it.required?<p className="muted" data-testid="pv-required">Sivusto edellyttää tätä liitosta. Käyttöönotto jatkuu, kun tili on yhdistetty; voit keskeyttää ja palata myöhemmin.</p>:<Button data-testid="pv-int-skip" size="page" variant="secondary" onPress={()=>next(at,'skipped')}>Jatka ilman: {copy.name}</Button>}</div></div></OnboardingFrame>;}
 else if(at==='ai')body=<OnboardingFrame step={3}><div><h2>Valitse AI-tili</h2><p>Kirjaudu yhdellä tilauksella. Voit lisätä muita tilejä myöhemmin asetuksissa.</p>
  <fieldset className="ah-provider-choices" aria-label="AI-palvelu"><Button data-testid="segment-openai-codex" size="row" variant={ai==='openai'?'primary':'secondary'} aria-pressed={ai==='openai'} onPress={()=>setAi('openai')}>ChatGPT / OpenAI</Button><Button data-testid="segment-claude-bridge" size="row" variant={ai==='claude'?'primary':'secondary'} aria-pressed={ai==='claude'} onPress={()=>setAi('claude')}>Claude-tilaus</Button></fieldset></div>
  {clones}
  <div hidden={ai!=='openai'}><PiDeviceSignIn embedded view={device} onRetry={device.phase==='start'?()=>setDevice({phase:'pending',verificationUri:'https://auth.openai.com/codex/device',userCode:'ABCD-1234'}):undefined} onCancel={device.phase==='pending'?()=>setDevice({phase:'start'}):undefined}/>{device.phase==='pending'&&<Button data-testid="pv-ai-simulate" size="row" variant="quiet" onPress={()=>{setDevice({phase:'connected'});}}>Simuloi hyväksyntä</Button>}</div>
  <div hidden={ai!=='claude'}><ClaudeSignIn csrf="prototype" onboarding/></div>
  <details className="ah-provider-api" open={draft.ai==='api-key'} data-testid="pv-api-key"><summary>Käytä OpenAI API-avainta tilauksen sijaan</summary><PiCredentials csrf="prototype" providers={['openai']}/></details>
  <Button data-testid="pv-ai-next" size="page" variant={device.phase==='connected'?'primary':'secondary'} onPress={()=>next('ai',device.phase==='connected'?'ok':'skipped')}>{device.phase==='connected'?'Avaa työtilat':'Simuloi: jatka työtiloihin'}</Button></OnboardingFrame>;
 else body=<OnboardingFrame step={3}><div><h2>Työtilat</h2><p role="status">Käyttöönotto valmis tässä simulaatiossa.</p><ul className="pv-summary">{route.map(k=><li key={k}><strong>{stepName(k)}</strong> {done[k]==='ok'?'valmis':done[k]==='skipped'?'ohitettu':'ei käyty'}</li>)}</ul><Button size="row" variant="secondary" onPress={()=>{setDone({});onAt(route[0]);}}>Aloita alusta</Button></div></OnboardingFrame>;
 return <div className="pv" data-testid="person-view" data-at={at}>
  <div className="pv-brand"><strong>Open Habitat</strong><span>habitat.example.test</span><small>Käyttöönotto</small></div>
  <div className={routeVisible?'pv-layout':'pv-layout pv-solo'}>
   {routeVisible&&<aside className="pv-side"><p className="pv-kicker">OMA REITTISI</p><ol className="pv-route" aria-label="Käyttöönoton reitti">{route.map((k,n)=><li key={k} aria-current={at===k?'step':undefined}><button type="button" data-testid={`route-${k}`} onClick={()=>onAt(k)}><span className="pv-dot">{done[k]==='ok'?<Icon name="check" width={14} height={14} aria-label="Valmis"/>:n+1}</span><span><strong>{stepName(k)}</strong><small>{statusOf(k)}</small></span></button></li>)}</ol><small className="pv-later">Valinnaiset liitokset voi täydentää myöhemmin.</small></aside>}
   <main className="pv-main">{body}</main>
  </div>
  {connect&&<ConnectDialog provider={provider(connect)} stage={{stage:'intro'}} onContinue={()=>{setDone(d=>({...d,['int:'+connect]:'ok'}));setConnect(undefined);}} onPassword={()=>{}} onPaste={()=>{}} onFolders={()=>{}} onRestart={()=>{}} onClose={()=>setConnect(undefined)}/>}
 </div>;
}

// ---------- The administrator's default-repository chooser: the production finder ----------

function FinderRoutes({added,onAdd}:{added:string[];onAdd:(n:string)=>void}){
 const location=useLocation(),navigate=useNavigate();
 const [query,setQuery]=useState(''),[since,setSince]=useState<Since>('0');
 useEffect(()=>{const m=location.pathname.match(/^\/add\/(.+)$/);if(m){onAdd(decodeURIComponent(m[1]));navigate('/',{replace:true});}},[location.pathname]);
 const mark=(r:CatalogRepo):RepoChoice=>({...r,href:'/add/'+encodeURIComponent(r.full_name),selected:added.includes(r.full_name),mark:added.includes(r.full_name)?{label:'oletus',tone:'ok'}:undefined});
 const exact=exactName(query),known=exact&&[...adminCatalog,...lookupOnly].find(r=>r.full_name.toLowerCase()===exact.toLowerCase());
 const lookup=exact&&!adminCatalog.some(r=>r.full_name.toLowerCase()===exact.toLowerCase())?known?{state:'found' as const,name:exact,repo:mark(known)}:{state:'not_found' as const,name:exact}:undefined;
 return <RepoFinder arrangement={arrange(adminCatalog.map(mark),{login:'kaisa-admin',query,since,now,taken:r=>added.includes(r.full_name)})} query={query} onQuery={setQuery} since={since} onSince={setSince} now={now} lookup={lookup} state="ready"/>;
}
function RepoPicker({added,onAdd,onClose}:{added:string[];onAdd:(n:string)=>void;onClose:()=>void}){
 return <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={o=>!o&&onClose()}><Modal className="ah-modal rp-modal"><Dialog className="ah-dialog rp-dialog" aria-label="Lisää oletusrepo"><Heading slot="title">Lisää oletusrepo</Heading><p className="muted">Näet omat GitHub-repojesi. Uuden henkilön pääsy tarkistetaan hänen omalla tilillään; repo, johon hänellä ei ole pääsyä, ei näy hänelle.</p><MemoryRouter><FinderRoutes added={added} onAdd={onAdd}/></MemoryRouter><div className="rp-foot"><span role="status" className="muted" data-testid="picker-count">{added.length} oletusrepoa</span><Button data-testid="picker-done" size="page" onPress={onClose}>Valmis</Button></div></Dialog></Modal></ModalOverlay>;
}

// ---------- Settings › Palvelin ----------

let reviewTheme='light',reviewPhone=false;
function App({direction}:{direction:number}){
 const [theme,setTheme]=useState(reviewTheme),[phone,setPhone]=useState(reviewPhone);
 const [draft,setDraft]=useState<Draft>(initial),[saved,setSaved]=useState<Draft>(initial),[tab,setTab]=useState('onboarding');
 const [edit,setEdit]=useState<StepKey>('repos'),[at,setAt]=useState<StepKey>('repos'),[picker,setPicker]=useState(false),[trial,setTrial]=useState(false);
 const [notice,setNotice]=useState(''),[username,setUsername]=useState(''),[inviteError,setInviteError]=useState('');
 const [people,setPeople]=useState([{name:'aino-demo',state:'Odottaa ensimmäistä kirjautumista'},{name:'leo-demo',state:'Liittynyt'}]);
 const [revoke,setRevoke]=useState('');
 const dirty=JSON.stringify(draft)!==JSON.stringify(saved);
 const patch=(p:Partial<Draft>)=>{setDraft(d=>({...d,...p}));setNotice('');};
 const route=routeOf(draft);
 // Editing a step shows that step to the new person; a removed step falls back to its neighbour.
 const group=(k:StepKey)=>k.startsWith('int:')?'integrations':k;
 const show=(k:StepKey)=>{setEdit(direction===1?k:group(k));const target=k==='integrations'?route.find(r=>r.startsWith('int:'))??'ai':k==='add-int'?'ai':k;setAt(route.includes(target)?target:route[Math.min(1,route.length-1)]);};
 useEffect(()=>{if(at!=='done'&&!route.includes(at))setAt(route.includes(edit)?edit:route[route.length-1]);if(direction===1&&edit.startsWith('int:')&&!route.includes(edit))setEdit('add-int');},[JSON.stringify(route)]);
 const addIntegration=(id:ProviderId)=>{patch({integrations:sortIntegrations([...draft.integrations,{id,required:false}])});if(direction===1)setEdit('int:'+id);setAt('int:'+id);};
 const removeIntegration=(id:ProviderId)=>patch({integrations:draft.integrations.filter(i=>i.id!==id)});
 const setRequired=(id:ProviderId,required:boolean)=>patch({integrations:draft.integrations.map(i=>i.id===id?{...i,required}:i)});
 const effect=(text:string)=><p className="effect" data-testid="effect">Uudelle henkilölle: {text}</p>;
 const integrationRow=(it:Draft['integrations'][number])=>{const p=provider(it.id),copy=providerCopy[it.id];return <div className="int-row" key={it.id} data-testid={`int-row-${it.id}`}><ProviderMark provider={it.id}/><div className="int-txt"><strong>{copy.name}</strong><span className="muted">{p.services.map(s=>serviceName(p.id,s)).join(' · ')}</span></div><Segmented data-testid={`int-rule-${it.id}`} label={`${copy.name}: pakollisuus`} options={[{id:'optional',label:'Voi ohittaa'},{id:'required',label:'Pakollinen'}]} value={it.required?'required':'optional'} onChange={v=>setRequired(it.id,v==='required')}/><Button data-testid={`int-remove-${it.id}`} size="row" variant="quiet" aria-label={`Poista ${copy.name} käyttöönotosta`} onPress={()=>removeIntegration(it.id)}><Icon name="cross" width={14} height={14}/>Poista</Button></div>;};
 const addTiles=(onlyTiles=false)=>{const rest=providers.filter(p=>!draft.integrations.some(i=>i.id===p.id));return rest.length?<div className="add-int"><h4>{onlyTiles?'Lisää integraatio käyttöönottoon':'Lisää integraatio'}</h4><div className="ig-tiles">{rest.map(p=><div className="ig-tile" key={p.id} data-testid={`add-tile-${p.id}`}><ProviderMark provider={p.id}/><div><span className="ig-rn">{providerCopy[p.id].name}</span><span className="ig-meta">{p.services.map(s=>serviceName(p.id,s)).join(' · ')}</span></div><Button data-testid={`int-add-${p.id}`} size="row" variant="secondary" onPress={()=>addIntegration(p.id)}><Icon name="plus" width={14} height={14}/>Lisää</Button></div>)}</div><p className="muted">Samat palvelut kuin Asetukset › Integraatiot. Jokainen lisätty integraatio on oma vaiheensa; järjestys on sama kuin Integraatiot-sivulla.</p></div>:<p className="muted">Kaikki palvelimen integraatiot ovat käyttöönotossa.</p>;};
 const config=(k:StepKey)=>{
  if(k==='github')return <section className="config" data-step="github"><h3>GitHub-kirjautuminen</h3><p>Aina ensimmäinen vaihe. Kuka saa liittyä, ratkaistaan kutsuilla.</p><Button size="row" variant="secondary" onPress={()=>setTab('invites')}>Kutsut ja pääsy</Button></section>;
  if(k==='repos')return <section className="config" data-step="repos"><h3>Repot</h3>
   <label className="field"><strong>Repojen aloitustapa</strong><select data-testid="repo-mode" value={draft.mode} onChange={e=>patch({mode:e.target.value as Mode})}><option value="preselected">Esivalitse oletusrepot</option><option value="auto">Hae oletusrepot automaattisesti</option><option value="skip">Ohita repovaihe</option></select></label>
   {draft.mode!=='skip'&&<div className="defaults"><strong>Oletusrepot</strong>{draft.repos.length?<ul className="repo-list" data-testid="default-repos">{draft.repos.map(n=>{const r=[...adminCatalog,...lookupOnly].find(x=>x.full_name===n);const [o,name]=n.split('/');return <li key={n} data-testid={`default-${n}`}><span className="repo-id"><span className="ah-mono"><span className="ah-clone-owner">{o}/</span><b>{name}</b></span>{r?.private&&<Icon name="lock" width={12} height={12}/>}<span className="muted repo-desc">{r?.description}</span></span><Button data-testid={`remove-${n}`} size="row" variant="quiet" aria-label={`Poista ${n} oletusrepoista`} onPress={()=>patch({repos:draft.repos.filter(x=>x!==n)})}><Icon name="cross" width={14} height={14}/>Poista</Button></li>;})}</ul>:<p className="muted" data-testid="no-defaults">Ei oletusrepoja.</p>}<Button data-testid="add-repo" size="row" variant="secondary" onPress={()=>setPicker(true)}><Icon name="plus" width={14} height={14}/>Lisää oletusrepo</Button></div>}
   {effect(draft.mode==='skip'?'repovalitsinta ei näytetä eikä mitään haeta. Repoja voi hakea myöhemmin työtilanäkymästä.':draft.mode==='auto'?(draft.repos.length?`${draft.repos.length} ${draft.repos.length===1?'repo haetaan':'repoa haetaan'} heti kirjautumisen jälkeen ilman valitsinta. Puuttuva oikeus näkyy virheenä, ei ohitettuna onnistumisena.`:'mitään ei haeta, koska oletusrepoja ei ole. Lisää ainakin yksi tai valitse esivalinta.'):draft.repos.length?`repovalitsin avautuu ${draft.repos.length} ${draft.repos.length===1?'oletusrepo':'oletusrepoa'} valmiiksi valittuna. Henkilö voi poistaa valinnat ja valita muita.`:'repovalitsin avautuu ilman esivalintoja.')}
  </section>;
  if(k==='integrations')return <section className="config" data-step="integrations"><h3>Integraatiot</h3>{draft.integrations.length?<div className="int-list">{draft.integrations.map(integrationRow)}</div>:<p className="muted" data-testid="no-integrations">Ei integraatioita käyttöönotossa.</p>}{addTiles()}{effect(draft.integrations.length?`${draft.integrations.map(i=>providerCopy[i.id].name).join(', ')} ${draft.integrations.length===1?'on oma vaiheensa':'ovat omia vaiheitaan'} ennen AI-tiliä. Henkilö yhdistää oman tilinsä; ylläpitäjä ei liitä kenenkään tiliä.`:'integraatiovaiheita ei näytetä. Liitokset voi tehdä myöhemmin asetuksissa.')}</section>;
  if(k.startsWith('int:')){const it=draft.integrations.find(i=>'int:'+i.id===k);if(!it)return null;return <section className="config" data-step={k}><h3>{providerCopy[it.id].name}</h3><div className="int-list">{integrationRow(it)}</div>{effect(it.required?`${providerCopy[it.id].name} pitää yhdistää ennen kuin käyttöönotto jatkuu. Henkilö voi keskeyttää ja palata myöhemmin.`:`${providerCopy[it.id].name} ehdotetaan omana vaiheenaan; sen voi ohittaa.`)}</section>;}
  if(k==='add-int')return <section className="config" data-step="add-int"><h3>Lisää integraatio</h3>{addTiles(true)}</section>;
  return <section className="config" data-step="ai"><h3>AI-tili</h3><fieldset className="ai-choices" aria-label="Oletuksena tarjottava AI-tili">{aiChoices.map(c=><label key={c.id} className="ai-choice" data-testid={`ai-${c.id}`}><input type="radio" name={`ai-default-${direction}`} checked={draft.ai===c.id} onChange={()=>patch({ai:c.id})}/><span><strong>{c.label}</strong><span className="muted">{c.how}</span></span></label>)}</fieldset>{effect(`AI-tilin vaihe avautuu valmiiksi kohdassa ${aiName(draft.ai)}. Muut vaihtoehdot jäävät valittaviksi; sivusto ei jaa kenenkään tunnuksia.`)}</section>;
 };
 // "Lista reittinä" lists the person's route itself, with the place where an
 // integration can be added; a skipped repository step stays editable there.
 const listSteps:StepKey[]=direction===1?['github','repos',...draft.integrations.map(i=>'int:'+i.id),'add-int','ai']:['github','repos','integrations','ai'];
 const numberOf=(k:StepKey)=>{const i=route.indexOf(k);return i<0?'':String(i+1);};
 const stepList=<ol className={direction===1?'steplist route-like':'steplist'} aria-label="Käyttöönoton vaiheet, kiinteä järjestys">{listSteps.map(k=>{const current=edit===k;const add=k==='add-int';return <li key={k} className={add?'add':undefined}><button type="button" data-testid={`step-${k}`} aria-current={current?'step':undefined} onClick={()=>show(k)}><span className="num">{add?<Icon name="plus" width={14} height={14}/>:k==='integrations'?String(route.indexOf(route.find(r=>r.startsWith('int:'))??'')+1||'–'):numberOf(k)||'–'}</span><span className="txt"><strong>{add?'Lisää integraatio':k==='integrations'?'Integraatiot':stepName(k)}</strong><small>{add?'Uusi vaihe ennen AI-tiliä':k==='integrations'?(draft.integrations.length?draft.integrations.map(i=>providerCopy[i.id].name).join(' · '):'Ei integraatioita'):k==='repos'&&draft.mode==='skip'?'Ohitettu':stepHint(k,draft)}</small></span></button></li>;})}</ol>;
 const editor=<div className="editor"><div className="s-card">{stepList}</div><div className="s-card">{config(edit)}</div></div>;
 const person=(routeVisible=true)=><PersonView key={JSON.stringify(draft)} draft={draft} at={at} onAt={k=>{setAt(k);if(k!=='done')setEdit(direction===1?k:group(k));}} routeVisible={routeVisible}/>;
 const textRoute=<ol className="textroute" data-testid="text-route">{route.map((k,n)=><li key={k}><span className="num">{n+1}</span><span><strong>{stepName(k)}</strong> <span className="muted">{stepHint(k,draft)}</span></span></li>)}</ol>;
 function invite(){const name=username.trim();if(!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(name)||name.includes('--')){setInviteError('Kirjoita GitHub-käyttäjänimi, ei sähköpostia tai osoitetta.');return;}if(people.some(p=>p.name.toLowerCase()===name.toLowerCase())){setInviteError('Tämä henkilö on jo listalla. Uutta kutsua ei luotu.');return;}setPeople([...people,{name,state:'Odottaa ensimmäistä kirjautumista'}]);setUsername('');setInviteError('');setNotice(`Kutsu luotu käyttäjälle ${name}. Jaa sivuston osoite itse; viestiä ei lähetetty.`);}
 return <div data-theme={theme} className={phone?'review phone':'review'}><header className="reviewbar"><strong>Palvelin · kierros 2</strong><label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label><label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);}}/> 390 px</label><p>Synteettiset tiedot. Ei yhteyttä palvelimeen, GitHubiin, Googleen tai AI-palveluihin.</p></header>
 <p className="axis">Vaihelista, kierros 2. Akseli: missä uuden henkilön Kartta-näkymä näkyy suhteessa vaihelistaan. Suositus: Kartta vieressä.</p>
 <div className="shell"><div className="hostbar"><strong>Open Habitat</strong><span>Northstar · esimerkkisivusto</span><Icon name="user"/></div><section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>{['Tili','Agentit','Integraatiot','Ulkoasu','Editori'].map(n=><span className="s-nav-i" key={n}>{n}</span>)}<span className="s-nav-h">Palvelimen ylläpito</span><span className="s-nav-i" aria-current="page">Palvelin</span><span className="s-nav-i">Käyttäjät</span><span className="s-nav-i">Levytila</span></nav><main className="s-main">
 <p className="mobileback">Asetukset › Palvelin</p><h2>Palvelin</h2><div className="facts s-card"><div className="s-row"><strong>Northstar</strong><code>habitat.example.test</code></div><div className="s-row"><strong>Versio</strong><code>v0.0.0-prototype</code></div></div>
 <nav className="subnav" aria-label="Palvelimen sisältö"><Button size="row" variant={tab==='onboarding'?'primary':'secondary'} onPress={()=>setTab('onboarding')}>Käyttöönotto</Button><Button size="row" variant={tab==='invites'?'primary':'secondary'} onPress={()=>setTab('invites')}>Kutsut ja pääsy ({people.length})</Button></nav>
 {notice&&<p role="status" className="notice">{notice}</p>}
 {tab==='onboarding'?<><h3>Uuden henkilön käyttöönotto</h3><p>Vaiheiden järjestys on kiinteä: GitHub, repot, integraatiot ja AI-tili. Kutsut eivät muutu tätä tallennettaessa.</p>
 <div className={`layout direction-${direction}`}>
 {direction===0&&<>{editor}<aside className="preview" aria-label="Vaikutus uudelle henkilölle"><p className="eyebrow">{dirty?'Luonnoksen vaikutus':'Tallennetun mallin vaikutus'} · uuden henkilön näkymä</p>{person()}</aside></>}
 {direction===1&&<><div className="s-card listcol"><p className="eyebrow">Uuden henkilön reitti</p>{stepList}</div><div className="stepcol"><div className="s-card">{config(edit)}</div>{edit!=='add-int'&&<aside className="preview" aria-label="Vaikutus uudelle henkilölle"><p className="eyebrow">{dirty?'Luonnoksen vaikutus':'Tallennetun mallin vaikutus'} · näin henkilö näkee tämän vaiheen</p>{person(false)}</aside>}</div></>}
 {direction===2&&<>{editor}<aside className="preview" aria-label="Vaikutus uudelle henkilölle"><p className="eyebrow">{dirty?'Luonnoksen vaikutus':'Tallennetun mallin vaikutus'}</p><h4>Uuden henkilön reitti</h4>{textRoute}<Button data-testid="open-trial" size="page" variant="secondary" onPress={()=>setTrial(true)}>Kokeile uuden henkilön näkymää</Button></aside>
  {trial&&<ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={o=>!o&&setTrial(false)}><Modal className="ah-modal trial-modal"><Dialog className="ah-dialog trial-dialog" aria-label="Uuden henkilön näkymä"><div className="trial-head"><Heading slot="title">Uuden henkilön näkymä · {dirty?'luonnos':'tallennettu malli'}</Heading><Button data-testid="close-trial" size="row" variant="secondary" onPress={()=>setTrial(false)}>Sulje</Button></div>{person()}</Dialog></Modal></ModalOverlay>}</>}
 </div>
 <p className="muted">Muutos koskee seuraavaa uutta käyttöönottoa. Jo liittyneiden työtilat ja liitokset eivät muutu.</p>
 <div className="save"><span>{dirty?'Tallentamattomia muutoksia':'Ei tallentamattomia muutoksia'}</span><Button data-testid="discard" size="row" variant="secondary" isDisabled={!dirty} onPress={()=>{setDraft(saved);setNotice('Luonnos peruttu.');}}>Peru muutokset</Button><Button data-testid="save" size="page" isDisabled={!dirty} onPress={()=>{setSaved({...draft});setNotice('Prototyypin malli tallennettu. Oikea palvelin ei muuttunut.');}}>Tallenna käyttöönotto</Button></div>
 <details><summary>Yhteinen käsitteistö suunnittelua varten</summary><pre>{JSON.stringify({onboarding:{steps:route.map(k=>k==='repos'?'repositories':k==='ai'?'ai_account':k.startsWith('int:')?`integration:${k.slice(4)}`:k),repositories:{mode:draft.mode,defaults:draft.mode==='skip'?[]:draft.repos},integrations:draft.integrations.map(i=>({provider:i.id,required:i.required})),ai_account:{default:draft.ai}},invitations:people},null,2)}</pre></details>
 {picker&&<RepoPicker added={draft.repos} onAdd={n=>{if(!draft.repos.includes(n))patch({repos:[...draft.repos,n]});}} onClose={()=>setPicker(false)}/>}
 </>:<section className="invites"><h3>Kutsut ja pääsy</h3><p>Kutsu sallii liittymisen tällä GitHub-käyttäjänimellä. Se ei anna GitHub-repojen oikeuksia, ylläpitäjän asemaa tai liitä kenenkään tilejä.</p><div className="s-card inviteform"><label className="field"><strong>GitHub-käyttäjänimi</strong><input data-testid="invite-name" placeholder="esim. sara-demo" value={username} onChange={e=>setUsername(e.target.value)}/></label><Button data-testid="invite" size="page" onPress={invite}>Luo kutsu</Button><p className="muted">Jaa <code>https://habitat.example.test</code> henkilölle itse. Sähköpostia tai GitHub-viestiä ei lähetetä. Kutsuttu kulkee yllä määritellyn käyttöönoton.</p>{inviteError&&<p role="alert">{inviteError}</p>}</div><ul className="people s-card">{people.map(p=><li key={p.name}><div><code>{p.name}</code><p>{p.state}</p></div>{p.state.startsWith('Odottaa')?<div className="person-actions"><Button size="row" variant="secondary" onPress={()=>{setPeople(people.map(x=>x.name===p.name?{...x,state:'Liittynyt'}:x));setNotice('Simuloitu ensimmäinen kirjautuminen.');}}>Simuloi liittyminen</Button><Button size="row" variant="danger-subtle" onPress={()=>setRevoke(p.name)}>Peru kutsu</Button></div>:<p className="muted">Pääsyn poisto kuuluu Käyttäjät-osioon, ei kutsun perumiseen.</p>}</li>)}</ul>
 {revoke&&<div role="group" aria-label="Vahvista kutsun peruminen" className="confirm"><h4>Perutaanko käyttäjän {revoke} kutsu?</h4><p>Henkilö ei voi liittyä tämän kutsun perusteella. Olemassa olevaa tiliä tai istuntoja ei poisteta.</p><Button size="row" variant="secondary" onPress={()=>setRevoke('')}>Säilytä kutsu</Button><Button data-testid="confirm-revoke" size="row" variant="danger" onPress={()=>{setPeople(people.filter(p=>p.name!==revoke));setNotice(`Kutsu peruttu: ${revoke}.`);setInviteError('');setRevoke('');}}>Vahvista peruminen</Button></div>}
 <p className="muted">Tässä mallissa pääsy on vain hyväksytyillä GitHub-käyttäjillä. Jo hyväksytyt henkilöt näkyvät Käyttäjät-osiossa.</p></section>}
 </main></section></div></div>;
}
const root=createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
// Flush the empty commit so switching (and R) really unmounts the old fixture.
const stage={set innerHTML(view:React.ReactNode){flushSync(()=>root.render(view===''?null:view));}};
const variants=directions.map((_,direction)=>()=> <App direction={direction}/>);
const picker=document.createElement('nav');
picker.className='proto-picker';picker.setAttribute('aria-label','Prototype variants');
picker.innerHTML='<span class="proto-picker-highlight" aria-hidden="true"></span>';
// Non-breaking label spaces keep the fixed reference pill single-line at 390 px.
directions.forEach((name,i)=>{const button=document.createElement('button');button.className='proto-picker-item';button.textContent=name.replaceAll(' ',' ');if(i===0){button.setAttribute('data-active','');button.setAttribute('aria-current','true');}picker.append(button);});
document.body.append(picker);
new Function('stage','variants',pickerSource)(stage,variants);
