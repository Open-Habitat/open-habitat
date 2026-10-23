import React, {useEffect, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {OnboardingFrame, OnboardingRoute, type OnboardingRouteStep} from '../../../../web/src/components/OnboardingFrame';
import {PiDeviceSignIn, type PiDeviceSignInView} from '../../../../web/src/components/PiDeviceSignIn';
import {OnboardingClones} from '../../../../web/src/components/ClonePage';
import {ProviderMark} from '../../../../web/src/components/Integrations';
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
let personOpenAI:string|null=null; // The person's own OpenAI key suffix in the preview, never the site key.
const credentials=()=>({schema_version:1,openai:{present:personOpenAI!==null,suffix:personOpenAI},subscription:{present:false}});
const realFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url,method=(init?.method??'GET').toUpperCase();
 if(url.includes('/api/v1/pi/claude-login'))return json(method==='POST'?{schema_version:1,state:'code',attempt_id:'20261023T120000.000000000',verification_uri:'https://claude.com/cai/oauth/authorize?prototype'}:method==='PUT'?{schema_version:1,state:'completed'}:{schema_version:1,state:'missing'});
 if(url.includes('/api/v1/pi/credentials')){
  if(method==='POST'){const key=String(JSON.parse(String(init?.body??'{}')).key??'');personOpenAI=key.slice(-4);}
  if(method==='DELETE')personOpenAI=null;
  return json(credentials());
 }
 if(url.startsWith('/'))return new Response('',{status:404});
 return realFetch(input,init);
};

// Variant axes: how the administrator gives a site key (its own section, or a
// third way beside "person chooses" and "default"), and how the person reaches
// the other services behind "Käytä muuta AI-palvelua" (production choices, or a list).
const directions=['Avain erikseen','Kolme tapaa','Muut listana'];
const keyAsMode=(d:number)=>d>0,othersAsList=(d:number)=>d===2;

type Opt='openai'|'claude'|'openai-key'|'anthropic-key'|'deepseek-key';
type KeyProvider='openai'|'anthropic'|'deepseek';
type Offer='all'|Opt;
type SiteKey={provider:KeyProvider;suffix:string}|null;
const opts:{id:Opt;label:string;how:string;key?:KeyProvider;missing?:boolean}[]=[
 {id:'openai',label:'ChatGPT / OpenAI',how:'Tilauksella. Kirjautuminen OpenAIn sivulla lyhyellä koodilla.'},
 {id:'claude',label:'Claude-tilaus',how:'Tilauksella. Kirjautuminen Clauden sivulla ja koodi takaisin tänne.'},
 {id:'openai-key',label:'OpenAI API-avain',how:'Henkilö liittää oman avaimensa; OpenAI laskuttaa käytöstä.',key:'openai'},
 {id:'anthropic-key',label:'Anthropic API-avain',how:'Henkilö liittää oman avaimensa; Anthropic laskuttaa käytöstä.',key:'anthropic',missing:true},
 {id:'deepseek-key',label:'DeepSeek API-avain',how:'Henkilö liittää oman avaimensa; DeepSeek laskuttaa käytöstä.',key:'deepseek',missing:true},
];
const opt=(id:Opt)=>opts.find(o=>o.id===id)!;
const keyNames:Record<KeyProvider,string>={openai:'OpenAI',anthropic:'Anthropic',deepseek:'DeepSeek'};
// Shape checks only, like production's literal OpenAI check; nothing is verified with the service.
const keyShape:Record<KeyProvider,RegExp>={openai:/^sk-(?!ant-)[A-Za-z0-9_-]{20,200}$/,anthropic:/^sk-ant-[A-Za-z0-9_-]{20,200}$/,deepseek:/^sk-[A-Za-z0-9]{20,200}$/};
const keyHint:Record<KeyProvider,string>={openai:'alkaa sk-',anthropic:'alkaa sk-ant-',deepseek:'alkaa sk-'};
const keyPrefix=(p:KeyProvider)=>p==='anthropic'?'sk-ant-…':'sk-…';
const missingTag=<span className="proto-tag" title="Pi tukee tätä, Open Habitat ei vielä">ei vielä tuotannossa</span>;

// ---------- The new person's AI step inside the production Kartta frame ----------

// A production-like key row for providers the product does not store yet. Its
// markup is PiCredentials' own, so it reads as the same control.
function ProtoKeyRow({provider}:{provider:KeyProvider}){
 const [suffix,setSuffix]=useState<string|null>(null),[editing,setEditing]=useState(false),[key,setKey]=useState('');
 // Saved on press as well as on Enter: the review sandbox does not allow form submission.
 const save=()=>{if(!keyShape[provider].test(key))return;setSuffix(key.slice(-4));setKey('');setEditing(false);};
 return <div className="s-row" data-testid={`key-row-${provider}`}><div className="s-lbl"><strong>{keyNames[provider]} API-avain</strong><span className="s-desc">Pi:n omat tunnukset. {keyNames[provider]} laskuttaa käytöstä.</span></div>
  <div className="s-val"><span>{suffix?`${keyPrefix(provider)}${suffix}`:'Ei avainta'}</span><Button size="row" onPress={()=>setEditing(true)} data-testid={`key-add-${provider}`}>{suffix?'Vaihda':'Lisää avain'}</Button>{suffix&&<Button size="row" variant="quiet" onPress={()=>setSuffix(null)}>Poista avain</Button>}</div>
  {editing&&<form className="s-editor" onSubmit={e=>{e.preventDefault();save();}}><label className="s-field">API-avain<input data-testid={`key-input-${provider}`} type="password" autoComplete="off" value={key} maxLength={207} onChange={e=>setKey(e.target.value)}/></label><p className="s-desc">Avain lähetetään kerran eikä sitä palauteta.</p><div className="s-actions"><Button size="row" onPress={()=>{setKey('');setEditing(false);}}>Peruuta</Button><Button size="row" isDisabled={!keyShape[provider].test(key)} onPress={save}>Tallenna avain</Button></div></form>}
 </div>;
}
function KeyRow({provider}:{provider:KeyProvider}){return provider==='openai'?<PiCredentials csrf="prototype" providers={['openai']}/>:<ProtoKeyRow provider={provider}/>;}

function DeviceFlow(){
 const [device,setDevice]=useState<PiDeviceSignInView>({phase:'start'});
 return <div data-testid="flow-openai"><PiDeviceSignIn embedded view={device} onRetry={device.phase==='start'?()=>setDevice({phase:'pending',verificationUri:'https://auth.openai.com/codex/device',userCode:'ABCD-1234'}):undefined} onCancel={device.phase==='pending'?()=>setDevice({phase:'start'}):undefined}/>{device.phase==='pending'&&<Button data-testid="pv-ai-simulate" size="row" variant="quiet" onPress={()=>setDevice({phase:'connected'})}>Simuloi hyväksyntä</Button>}</div>;
}
function Flow({id}:{id:Opt}){
 if(id==='openai')return <DeviceFlow/>;
 if(id==='claude')return <div data-testid="flow-claude"><ClaudeSignIn csrf="prototype" onboarding/></div>;
 return <div className="ah-provider-api" data-testid={`flow-${id}`}><KeyRow provider={opt(id).key!}/></div>;
}
// Production's choice set today (subscriptions as a segmented pair, API keys
// under one disclosure), with the two new key providers added to the disclosure.
function Choices({among}:{among:Opt[]}){
 const subs=among.filter(i=>!opt(i).key),keys=among.filter(i=>opt(i).key);
 const [sub,setSub]=useState<Opt|undefined>(subs[0]);
 return <>
  {subs.length>1&&<fieldset className="ah-provider-choices" aria-label="AI-palvelu">{subs.map(i=><Button key={i} data-testid={i==='openai'?'segment-openai-codex':'segment-claude-bridge'} size="row" variant={sub===i?'primary':'secondary'} aria-pressed={sub===i} onPress={()=>setSub(i)}>{opt(i).label}</Button>)}</fieldset>}
  {subs.length===1&&<h3 className="pv-subhead">{opt(subs[0]).label}</h3>}
  {sub&&<Flow key={sub} id={sub}/>}
  {keys.length>0&&<details className="ah-provider-api" data-testid="pv-api-keys"><summary>{keys.length===1?`Käytä ${opt(keys[0]).label}ta tilauksen sijaan`:'Käytä API-avainta tilauksen sijaan'}</summary>{keys.map(i=><KeyRow key={i} provider={opt(i).key!}/>)}</details>}
 </>;
}
const heading:Record<Opt,string>={openai:'Kirjaudu ChatGPT / OpenAI -tilillä',claude:'Kirjaudu Claude-tilauksella','openai-key':'Lisää OpenAI API-avain','anthropic-key':'Lisää Anthropic API-avain','deepseek-key':'Lisää DeepSeek API-avain'};

function OtherServices({offer,direction}:{offer:Opt;direction:number}){
 const [open,setOpen]=useState(false),[chosen,setChosen]=useState<Opt>(offer);
 const others=opts.map(o=>o.id).filter(i=>i!==chosen);
 // The sign-in components carry their own heading; only a key needs one here.
 const lead=chosen===offer?'Sivusto ehdottaa tätä AI-tiliä. Voit lisätä muita tilejä myöhemmin asetuksissa.':'Valitsit muun kuin sivuston ehdottaman palvelun. Voit lisätä muita tilejä myöhemmin asetuksissa.';
 const main=<>{opt(chosen).key?<div><h2>{heading[chosen]}</h2><p>{lead}</p></div>:<p className="pv-lead" data-testid="pv-lead">{lead}</p>}<Flow key={chosen} id={chosen}/><Clones/></>;
 const toggle=<button type="button" className="pv-other" data-testid="pv-other" aria-expanded={open} onClick={()=>setOpen(o=>!o)}><span className="pv-chev" aria-hidden="true">›</span>Käytä muuta AI-palvelua</button>;
 if(!othersAsList(direction))return <>{main}<div className="pv-others">{toggle}{open&&<div className="pv-others-body" data-testid="pv-others"><Choices among={others}/></div>}</div></>;
 return <>{main}<div className="pv-others">{chosen!==offer&&<button type="button" className="pv-other" data-testid="pv-back-offer" onClick={()=>{setChosen(offer);setOpen(false);}}><span className="pv-chev" aria-hidden="true">‹</span>Palaa sivuston ehdotukseen: {opt(offer).label}</button>}{toggle}
  {open&&<ul className="pv-otherlist" data-testid="pv-others">{others.map(i=><li key={i}><span><strong>{opt(i).label}</strong><span className="muted">{opt(i).how}</span></span><Button data-testid={`pv-pick-${i}`} size="row" variant="secondary" onPress={()=>{setChosen(i);setOpen(false);}}>Valitse</Button></li>)}</ul>}</div></>;
}
const Clones=()=><OnboardingClones rows={[{full_name:'northstar-demo/product',state:'running',stage:'receiving',percent:42,retryable:false}]}/>;
const passed:OnboardingRouteStep[]=[{id:'github',note:'Kirjautunut'},{id:'repositories',note:'1 repo haussa'},{id:'google',skipped:true}];

function PersonView({offer,siteKey,direction}:{offer:Offer;siteKey:SiteKey;direction:number}){
 if(siteKey)return <div className="pv-frame" data-testid="person-view" data-at="google"><OnboardingRoute steps={passed.map(s=>s.id==='google'?{id:'google'}:s)}><OnboardingFrame step="google"><div className="pv-int"><h2>Google</h2><p>Yhdistä oma Google-tilisi, jos agentin pitää lukea sähköpostia, kalenteria tai Drivea. Voit tehdä tämän myöhemmin asetuksissa.</p><div className="ig-tile"><ProviderMark provider="google"/><div><span className="ig-rn">Google</span><span className="ig-meta">Gmail · Kalenteri · Yhteystiedot · Drive</span></div><Button size="row" variant="secondary">Yhdistä…</Button></div><div className="pv-actions"><Button data-testid="pv-open-workspaces" size="page" variant="secondary">Jatka ilman Googlea</Button></div><p className="muted" data-testid="pv-last">Tämä on reitin viimeinen vaihe. Seuraavaksi avautuvat työtilat.</p></div></OnboardingFrame></OnboardingRoute></div>;
 return <div className="pv-frame" data-testid="person-view" data-at="ai"><OnboardingRoute steps={[...passed,{id:'ai'}]}><OnboardingFrame step="ai">
  {offer==='all'?<><div><h2>Valitse AI-tili</h2><p>Kirjaudu yhdellä tilauksella. Voit lisätä muita tilejä myöhemmin asetuksissa.</p></div><Clones/><Choices among={opts.map(o=>o.id)}/></>:<OtherServices offer={offer} direction={direction}/>}
 </OnboardingFrame></OnboardingRoute></div>;
}

// ---------- The administrator's site key: entered, replaced and removed on its own ----------

function SiteKeyEditor({siteKey,onSave,onRemove,onCancel,startOpen=false}:{siteKey:SiteKey;onSave:(k:NonNullable<SiteKey>)=>void;onRemove:()=>void;onCancel?:()=>void;startOpen?:boolean}){
 const [editing,setEditing]=useState(startOpen&&!siteKey),[provider,setProvider]=useState<KeyProvider>(siteKey?.provider??'openai'),[key,setKey]=useState(''),[confirm,setConfirm]=useState(false);
 const ok=keyShape[provider].test(key);
 const close=()=>{setKey('');setEditing(false);};
 const save=()=>{if(!ok)return;onSave({provider,suffix:key.slice(-4)});close();};
 return <div className="sitekey" data-testid="site-key">
  {siteKey&&!editing&&<div className="sitekey-row" data-testid="site-key-present"><div><strong>{keyNames[siteKey.provider]} API-avain</strong><code data-testid="site-key-suffix">{keyPrefix(siteKey.provider)}{siteKey.suffix}</code><span className="muted">Käytöstä laskutetaan avaimen omistajan tiliä palvelussa {keyNames[siteKey.provider]}.</span></div><div className="sitekey-actions"><Button data-testid="site-key-replace" size="row" variant="secondary" onPress={()=>{setProvider(siteKey.provider);setEditing(true);}}>Vaihda avain…</Button><Button data-testid="site-key-remove-open" size="row" variant="quiet" onPress={()=>setConfirm(true)}>Poista avain…</Button></div></div>}
  {!siteKey&&!editing&&<div className="sitekey-row"><p className="muted">Ei sivuston avainta. Jokainen uusi henkilö kirjautuu omalla AI-tilillään.</p><Button data-testid="site-key-add" size="row" variant="secondary" onPress={()=>setEditing(true)}><Icon name="plus" width={14} height={14}/>Anna API-avain…</Button></div>}
  {editing&&<form className="sitekey-form" onSubmit={e=>{e.preventDefault();save();}}>
   <label className="field"><strong>Palvelu</strong><select data-testid="site-key-provider" value={provider} onChange={e=>setProvider(e.target.value as KeyProvider)}>{(Object.keys(keyNames) as KeyProvider[]).map(p=><option key={p} value={p}>{keyNames[p]}{p==='openai'?'':' (ei vielä tuotannossa)'}</option>)}</select></label>
   <label className="field"><strong>{siteKey?'Uusi API-avain':'API-avain'}</strong><input data-testid="site-key-input" type="password" autoComplete="off" value={key} maxLength={207} onChange={e=>setKey(e.target.value)} aria-describedby="site-key-hint"/></label>
   <p className="muted" id="site-key-hint">{key&&!ok?<span role="alert" data-testid="site-key-error">Tämä ei näytä {keyNames[provider]}-avaimelta ({keyHint[provider]}).</span>:`Avain lähetetään kerran eikä sitä näytetä uudelleen; näkyviin jää vain loppuosa.${siteKey?' Uusi avain korvaa nykyisen.':''}`}</p>
   <div className="sitekey-actions"><Button data-testid="site-key-cancel" size="row" variant="secondary" onPress={()=>{close();onCancel?.();}}>Peruuta</Button><Button data-testid="site-key-save" size="row" isDisabled={!ok} onPress={save}>{siteKey?'Vaihda avain':'Ota avain käyttöön'}</Button></div>
  </form>}
  <p className="proto-note">Prototyyppi ei lähetä avainta minnekään. Missä sivuston avain säilyy ja miten se tulee kunkin henkilön käyttöön, on vielä päättämättä.</p>
  <ModalOverlay className="ah-overlay" isOpen={confirm} onOpenChange={setConfirm} isDismissable><Modal className="ah-modal"><Dialog className="ah-dialog" aria-label="Poistetaanko sivuston API-avain?"><Heading slot="title">Poistetaanko sivuston API-avain?</Heading><p>Uudet henkilöt näkevät taas AI-tilin vaiheen ja kirjautuvat omalla tilillään. Avainta ei peruta palvelussa {siteKey?keyNames[siteKey.provider]:''}.</p><div className="ah-dialog-actions"><Button size="row" onPress={()=>setConfirm(false)}>Peruuta</Button><Button data-testid="site-key-remove-confirm" size="row" variant="danger-subtle" onPress={()=>{setConfirm(false);onRemove();}}>Poista avain</Button></div></Dialog></Modal></ModalOverlay>
 </div>;
}

// ---------- Settings › Palvelin, "Lista reittinä" ----------

let reviewTheme='light',reviewPhone=false;
function App({direction}:{direction:number}){
 const [theme,setTheme]=useState(reviewTheme),[phone,setPhone]=useState(reviewPhone);
 const [offer,setOffer]=useState<Offer>('openai'),[savedOffer,setSavedOffer]=useState<Offer>('openai');
 const [siteKey,setSiteKey]=useState<SiteKey>(null),[keyTab,setKeyTab]=useState(false),[leaveKey,setLeaveKey]=useState<'all'|'default'|undefined>();
 const [notice,setNotice]=useState('');
 useEffect(()=>{personOpenAI=null;},[]);
 const dirty=offer!==savedOffer;
 const patch=(o:Offer)=>{setOffer(o);setNotice('');};
 const saveKey=(k:NonNullable<SiteKey>)=>{setSiteKey(k);setKeyTab(false);setNotice(`Sivuston ${keyNames[k.provider]}-avain otettu käyttöön (prototyyppi; avainta ei lähetetty). AI-tilin vaihe ohitetaan.`);};
 const removeKey=(next?:'all'|'default')=>{setSiteKey(null);setKeyTab(false);if(next==='all')patch('all');if(next==='default'&&offer==='all')patch('openai');setNotice('Sivuston avain poistettu. AI-tilin vaihe on taas reitillä.');};
 const effect=(text:string)=><p className="effect" data-testid="effect">Uudelle henkilölle: {text}</p>;
 const effectText=siteKey?`AI-tilin vaihetta ei näytetä. Henkilön agentit käyttävät sivuston ${keyNames[siteKey.provider]}-avainta, ja reitti päättyy Googleen. Oman tilin voi lisätä myöhemmin asetuksissa.`:offer==='all'?'AI-tilin vaihe näyttää kaikki vaihtoehdot, kuten nyt. Henkilö kirjautuu omalla tilillään.':`tarjotaan vain ${opt(offer).label}. Muut vaihtoehdot ovat linkin › Käytä muuta AI-palvelua takana.`;
 const offerRadios=(withAll:boolean,disabled=false)=><fieldset className="ai-choices" aria-label="Oletuksena tarjottava AI-tili" disabled={disabled}>{withAll&&<label className="ai-choice" data-testid="ai-all"><input type="radio" name={`ai-offer-${direction}`} checked={offer==='all'} onChange={()=>patch('all')}/><span><strong>Ei oletusta</strong><span className="muted">Henkilö valitsee kaikista vaihtoehdoista.</span></span></label>}{opts.map(c=><label key={c.id} className="ai-choice" data-testid={`ai-${c.id}`}><input type="radio" name={`ai-offer-${direction}`} checked={offer===c.id} onChange={()=>patch(c.id)}/><span><strong>{c.label} {c.missing&&missingTag}</strong><span className="muted">{c.how}</span></span></label>)}</fieldset>;
 // Variant 1: the default and the site key are separate sections; a key overrides the default.
 const separate=<><h4>Tarjottava AI-tili</h4>{siteKey&&<p className="muted" data-testid="offer-overridden">Ei käytössä, koska sivusto antaa avaimen. Valinta palaa voimaan, jos avain poistetaan.</p>}{offerRadios(true,!!siteKey)}<h4>Sivuston API-avain</h4><p className="muted">Kun sivusto antaa avaimen, AI-tilin vaihetta ei näytetä uudelle henkilölle.</p><SiteKeyEditor siteKey={siteKey} onSave={saveKey} onRemove={()=>removeKey()}/></>;
 // Variants 2–3: one choice of three ways; the key way is in force once a key is given.
 const way=siteKey||keyTab?'key':offer==='all'?'all':'default';
 const pickWay=(w:'all'|'default'|'key')=>{if(w===way)return;if(siteKey){setLeaveKey(w as 'all'|'default');return;}if(w==='key'){setKeyTab(true);return;}setKeyTab(false);patch(w==='all'?'all':offer==='all'?'openai':offer);};
 const threeWays=<><Segmented data-testid="ai-way" label="AI-tilin tarjoaminen" size="row" options={[{id:'all',label:'Henkilö valitsee'},{id:'default',label:'Oletus'},{id:'key',label:'Sivuston avain'}]} value={way} onChange={pickWay}/>
  {way==='all'&&<p className="muted">Henkilö näkee kaikki vaihtoehdot, kuten nyt.</p>}
  {way==='default'&&<>{offerRadios(false)}</>}
  {way==='key'&&<><p className="muted">Sivusto antaa avaimen, eikä AI-tilin vaihetta näytetä uudelle henkilölle.{!siteKey&&` Kunnes avain on annettu, henkilö näkee vaiheen kuten valinnalla ${offer==='all'?'Henkilö valitsee':`Oletus: ${opt(offer).label}`}.`}</p><SiteKeyEditor siteKey={siteKey} startOpen onSave={saveKey} onRemove={()=>removeKey(offer==='all'?'all':'default')} onCancel={()=>setKeyTab(false)}/></>}
  <ModalOverlay className="ah-overlay" isOpen={!!leaveKey} onOpenChange={o=>!o&&setLeaveKey(undefined)} isDismissable><Modal className="ah-modal"><Dialog className="ah-dialog" aria-label="Poistetaanko sivuston API-avain?"><Heading slot="title">Poistetaanko sivuston API-avain?</Heading><p>{leaveKey==='all'?'Henkilö valitsee':'Oletus'} tarkoittaa, että uudet henkilöt kirjautuvat omalla tilillään. Sivuston {siteKey?keyNames[siteKey.provider]:''}-avain poistetaan; sitä ei peruta palvelussa.</p><div className="ah-dialog-actions"><Button size="row" onPress={()=>setLeaveKey(undefined)}>Peruuta</Button><Button data-testid="leave-key-confirm" size="row" variant="danger-subtle" onPress={()=>{const w=leaveKey;setLeaveKey(undefined);removeKey(w);}}>Poista avain</Button></div></Dialog></Modal></ModalOverlay></>;
 const aiHint=siteKey?`Ohitetaan · sivuston ${keyNames[siteKey.provider]}-avain`:offer==='all'?'Henkilö valitsee':`Oletus: ${opt(offer).label}`;
 // The settled "Lista reittinä" list; this round edits only the AI-account row.
 const rows:[string,string,string][]=[['github','GitHub','Kirjautuminen'],['repos','Repot','2 esivalittuna'],['google','Google','Voi ohittaa'],['add','Lisää integraatio','Uusi vaihe ennen AI-tiliä']];
 const stepList=<ol className="steplist route-like" aria-label="Käyttöönoton vaiheet, kiinteä järjestys">{rows.map(([k,name,hint],i)=><li key={k} className={k==='add'?'add':undefined}><button type="button" disabled title="Kierros 3 näyttää vain AI-tilin"><span className="num">{k==='add'?<Icon name="plus" width={14} height={14}/>:i+1}</span><span className="txt"><strong>{name}</strong><small>{hint}</small></span></button></li>)}
  <li className={siteKey?'skipped':undefined}><button type="button" data-testid="step-ai" aria-current="step"><span className="num">{siteKey?'–':'4'}</span><span className="txt"><strong>AI-tili</strong><small data-testid="step-ai-hint">{aiHint}</small></span></button></li></ol>;
 return <div data-theme={theme} className={phone?'review phone':'review'}><header className="reviewbar"><strong>Palvelin · kierros 3 · AI-tili</strong><label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label><label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);}}/> 390 px</label><p>Synteettiset tiedot. Ei yhteyttä palvelimeen tai AI-palveluihin; avaimia ei lähetetä minnekään.</p></header>
 <p className="axis">Lista reittinä, kierros 3: vain AI-tilin vaihe. Akselit: miten ylläpitäjä antaa sivuston avaimen ja miten henkilö löytää muut palvelut oletuksen takaa. Suositus: Avain erikseen.</p>
 <div className="shell"><div className="hostbar"><strong>Open Habitat</strong><span>Northstar · esimerkkisivusto</span><Icon name="user"/></div><section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>{['Tili','Agentit','Integraatiot','Ulkoasu','Editori'].map(n=><span className="s-nav-i" key={n}>{n}</span>)}<span className="s-nav-h">Palvelimen ylläpito</span><span className="s-nav-i" aria-current="page">Palvelin</span><span className="s-nav-i">Käyttäjät</span><span className="s-nav-i">Levytila</span></nav><main className="s-main">
 <p className="mobileback">Asetukset › Palvelin</p><h2>Palvelin</h2><div className="facts s-card"><div className="s-row"><strong>Northstar</strong><code>habitat.example.test</code></div><div className="s-row"><strong>Versio</strong><code>v0.0.0-prototype</code></div></div>
 <nav className="subnav" aria-label="Palvelimen sisältö"><Button size="row" variant="primary">Käyttöönotto</Button><Button size="row" variant="secondary" isDisabled>Pääsy (2)</Button></nav>
 {notice&&<p role="status" className="notice">{notice}</p>}
 <h3>Uuden henkilön käyttöönotto</h3><p>Vaiheiden järjestys on kiinteä: GitHub, repot, integraatiot ja AI-tili.</p>
 <div className={`layout direction-1 variant-${direction}`}>
  <div className="s-card listcol"><p className="eyebrow">Uuden henkilön reitti</p>{stepList}<p className="muted listnote">Kierros 3 muokkaa vain AI-tiliä; muut vaiheet ovat kierroksen 2 mukaiset.</p></div>
  <div className="stepcol"><div className="s-card"><section className="config" data-step="ai"><h3>AI-tili</h3>{keyAsMode(direction)?threeWays:separate}{effect(effectText)}</section></div>
   <aside className="preview" aria-label="Vaikutus uudelle henkilölle"><p className="eyebrow">{dirty?'Luonnoksen vaikutus':'Tallennetun mallin vaikutus'} · {siteKey?'AI-tili ohitetaan: henkilön reitin viimeinen vaihe':'näin henkilö näkee tämän vaiheen'}</p><PersonView key={`${offer}|${siteKey?.provider??''}|${direction}`} offer={offer} siteKey={siteKey} direction={direction}/></aside></div>
 </div>
 <p className="muted">Oletuksen muutos koskee seuraavaa uutta käyttöönottoa ja tallennetaan muiden asetusten kanssa. Sivuston avain otetaan käyttöön ja poistetaan omalla toiminnollaan, ei luonnoksena.</p>
 <div className="save"><span>{dirty?'Tallentamattomia muutoksia':'Ei tallentamattomia muutoksia'}</span><Button data-testid="discard" size="row" variant="secondary" isDisabled={!dirty} onPress={()=>{setOffer(savedOffer);setNotice('Luonnos peruttu.');}}>Peru muutokset</Button><Button data-testid="save" size="page" isDisabled={!dirty} onPress={()=>{setSavedOffer(offer);setNotice('Prototyypin malli tallennettu. Oikea palvelin ei muuttunut.');}}>Tallenna käyttöönotto</Button></div>
 <details><summary>Yhteinen käsitteistö suunnittelua varten</summary><pre>{JSON.stringify({onboarding:{ai_account:{offer,site_key:siteKey?{provider:siteKey.provider,present:true}:null}}},null,2)}</pre><p className="muted">Esimerkki, ei lukittu skeema. Avaimen säilytys ja jakelu Unix-käyttäjille ratkaistaan auktoriteettisuunnitelmassa.</p></details>
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
