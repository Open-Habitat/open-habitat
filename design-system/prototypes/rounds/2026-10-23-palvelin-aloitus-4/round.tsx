import React, {createContext, type ReactNode, useContext, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {StatusMark} from '../../../../web/src/components/Status';
import {ProviderMark} from '../../../../web/src/components/Integrations';
import frame from '../../../../web/src/components/OnboardingFrame.module.css';
import device from '../../../../web/src/components/PiDeviceSignIn.module.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/Integrations.css';
import './round.css';

// Round 4 of Settings › Käyttöönotto: how the administrator sees the new
// person's screen, and that AI step itself rebuilt so its parts line up.
// Everything is synthetic and in memory; nothing leaves the page.
// Each direction pairs one preview presentation with one step layout.
const directions=['Ikkuna vieressä','Esikatselutila','Merkitty puhelin'];
type Layout='cards'|'segmented'|'list';
type ClonePlace='route'|'identity'|'notice';
const plan:{preview:'window'|'mode'|'annotated';layout:Layout;clones:ClonePlace}[]=[
 {preview:'window',layout:'cards',clones:'route'},
 {preview:'mode',layout:'segmented',clones:'identity'},
 {preview:'annotated',layout:'list',clones:'notice'},
];

type Opt='openai'|'claude'|'openai-key'|'anthropic-key'|'deepseek-key';
type KeyProvider='openai'|'anthropic'|'deepseek';
type Way='all'|'default'|'key';
type SiteKey={provider:KeyProvider;suffix:string}|null;
type Option={id:Opt;name:string;mark:string;how:string;key?:KeyProvider;missing?:boolean};
const opts:Option[]=[
 {id:'openai',name:'ChatGPT-tilaus',mark:'Ch',how:'Kirjaudu OpenAI-tililläsi. Käyttö kuuluu tilaukseesi.'},
 {id:'claude',name:'Claude-tilaus',mark:'Cl',how:'Kirjaudu Claude-tililläsi. Käyttö kuuluu tilaukseesi.'},
 {id:'openai-key',name:'OpenAI API-avain',mark:'OA',how:'OpenAI laskuttaa käytöstä.',key:'openai'},
 {id:'anthropic-key',name:'Anthropic API-avain',mark:'An',how:'Anthropic laskuttaa käytöstä.',key:'anthropic',missing:true},
 {id:'deepseek-key',name:'DeepSeek API-avain',mark:'DS',how:'DeepSeek laskuttaa käytöstä.',key:'deepseek',missing:true},
];
const opt=(id:Opt)=>opts.find(o=>o.id===id)!;
const subs=opts.filter(o=>!o.key),keyOpts=opts.filter(o=>o.key);
const keyNames:Record<KeyProvider,string>={openai:'OpenAI',anthropic:'Anthropic',deepseek:'DeepSeek'};
// Shape checks only, like production's literal OpenAI check; nothing is verified with the service.
const keyShape:Record<KeyProvider,RegExp>={openai:/^sk-(?!ant-)[A-Za-z0-9_-]{20,200}$/,anthropic:/^sk-ant-[A-Za-z0-9_-]{20,200}$/,deepseek:/^sk-[A-Za-z0-9]{20,200}$/};
const keyHint:Record<KeyProvider,string>={openai:'alkaa sk-',anthropic:'alkaa sk-ant-',deepseek:'alkaa sk-'};
const keyPrefix=(p:KeyProvider)=>p==='anthropic'?'sk-ant-…':'sk-…';
const missingTag=<span className="proto-tag" title="Pi tukee tätä, Open Habitat ei vielä">ei vielä tuotannossa</span>;

// ---------- Annotations: one number joins a setting and the part of the person's screen it changes ----------

const Annot=createContext<{on:boolean;hot:number|null;setHot:(n:number|null)=>void}>({on:false,hot:null,setHot:()=>{}});
function Ann({n}:{n:number}){const a=useContext(Annot);return a.on?<span className={`ann${a.hot===n?' hot':''}`} data-ann={n} aria-label={`Merkintä ${n}`}>{n}</span>:null;}
function AnnTarget({n,children,className}:{n:number;children:ReactNode;className?:string}){
 const a=useContext(Annot);
 if(!a.on)return <>{children}</>;
 return <div className={`ann-target${a.hot===n?' hot':''} ${className??''}`} data-ann-target={n}>{children}</div>;
}
function AnnSource({n,children}:{n:number;children:ReactNode}){
 const a=useContext(Annot);
 if(!a.on)return <>{children}</>;
 return <div className={`ann-source${a.hot===n?' hot':''}`} onMouseEnter={()=>a.setHot(n)} onMouseLeave={()=>a.setHot(null)} onFocus={()=>a.setHot(n)} onBlur={()=>a.setHot(null)}>{children}</div>;
}

// ---------- The person's screen: the Kartta frame with the AI step ----------

const Mark=({o}:{o:Option})=><span className={`mk${o.key?' mk-key':''}`} aria-hidden="true">{o.mark}</span>;
const Spin=()=><span className="ah-clone-spin ah-clone-spin-sm" aria-hidden/>;
const clone={name:'northstar-demo/product',percent:42};

type RouteStep={id:string;label:string;state:'done'|'skipped'|'current'|'next';note?:string;progress?:number;ann?:number};
// Production's OnboardingFrame markup and module CSS; the route row can carry
// a progress bar, the change this round proposes for background clones.
function ProtoFrame({route,children,notice,status}:{route:RouteStep[];children:ReactNode;notice?:ReactNode;status?:ReactNode}){
 return <div className={`ah-onboarding-frame ${frame.frame}`} data-step={route.find(s=>s.state==='current')?.id}>
  <div className={frame.identity}><strong>Open Habitat</strong><span aria-hidden="true" className={frame.divider}/><span className={frame.host}>habitat.example.test</span>{status}</div>
  <div className={frame.map}>
   <nav className={frame.route} aria-label="Käyttöönoton vaiheet"><p className={frame.kicker}>Oma reittisi</p>
    <ol data-testid="onboarding-steps">{route.map((s,i)=><li key={s.id} data-testid={`onboarding-step-${s.id}`} data-state={s.state} aria-current={s.state==='current'?'step':undefined}>
     <span className={frame.dot} aria-hidden="true">{s.state==='done'?<Icon name="check"/>:i+1}</span>
     <span className={frame.label}><strong>{s.label}{s.ann&&<Ann n={s.ann}/>}</strong><small>{s.note??(s.state==='current'?'Nyt':s.state==='next'?'Seuraavaksi':s.state==='skipped'?'Ohitettu':'Valmis')}</small>
      {s.progress!==undefined&&<span className="rt-bar" role="progressbar" aria-label={`Haetaan ${clone.name}`} aria-valuenow={s.progress} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${s.progress}%`}}/></span>}</span>
    </li>)}</ol>
   </nav>
   <div className={frame.step}><div className={frame.card} data-testid="onboarding-card">{children}</div>{notice}</div>
  </div>
 </div>;
}

// One subscription sign-in, drawn with production's numbered device steps.
function SubFlow({id}:{id:'openai'|'claude'}){
 const [phase,setPhase]=useState<'start'|'pending'|'done'>('start'),[code,setCode]=useState('');
 const o=opt(id),service=id==='openai'?'OpenAI':'Claude';
 if(phase==='done')return <div className="st-flow" data-testid={`flow-${id}`} data-phase="done"><StatusMark label={`${o.name} yhdistetty`} tone="success"/><p className="st-quiet">Mallin käyttöoikeus selviää ensimmäisessä viestissä.</p><div className="st-actions"><Button data-testid="pv-continue" size="page" variant="primary">Avaa työtilat</Button></div></div>;
 if(phase==='start')return <div className="st-flow" data-testid={`flow-${id}`} data-phase="start"><div className="st-actions"><Button data-testid="pv-start" size="page" variant="primary" onPress={()=>setPhase('pending')}>Kirjaudu {service}-tilillä</Button></div><p className="st-quiet">Kirjautuminen tehdään {service}n omalla sivulla. Salasanaa ei syötetä tänne.</p></div>;
 return <div className="st-flow" data-testid={`flow-${id}`} data-phase="pending"><div className={device.steps}>
  {id==='openai'?<>
   <div className={device.instruction}><span className={device.number}>1</span><div><strong>Kopioi koodi</strong><div className={device.code}><code>ABCD-1234</code><Button size="row" variant="secondary" aria-label="Kopioi koodi"><Icon name="copy"/></Button></div></div></div>
   <div className={device.instruction}><span className={device.number}>2</span><div><strong>Syötä koodi OpenAIn sivulla</strong><a href="#" onClick={e=>e.preventDefault()}>Avaa OpenAIn vahvistussivu (uusi välilehti)</a></div></div>
   <div className={device.instruction} role="status"><span className={device.number}>3</span><div><strong>Palaa tänne ja odota</strong><StatusMark label="Odotetaan vahvistusta OpenAIlta" tone="info" animated="running"/></div></div>
  </>:<>
   <div className={device.instruction}><span className={device.number}>1</span><div><strong>Kirjaudu Clauden sivulla</strong><a href="#" onClick={e=>e.preventDefault()}>Avaa Claude-kirjautuminen (uusi välilehti)</a></div></div>
   <div className={device.instruction}><span className={device.number}>2</span><div><label className="st-field"><strong>Liitä Clauden palauttama koodi</strong><input data-testid="claude-code" type="password" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)}/></label><div className="st-actions"><Button data-testid="claude-confirm" size="row" variant="primary" isDisabled={code.trim().length<8} onPress={()=>{setCode('');setPhase('done');}}>Vahvista koodi</Button></div></div></div>
  </>}
 </div>
 <div className="st-actions"><Button size="row" variant="quiet" onPress={()=>setPhase('start')}>Peruuta</Button>{id==='openai'&&<Button data-testid="pv-simulate" size="row" variant="quiet" onPress={()=>setPhase('done')}>Simuloi hyväksyntä</Button>}</div></div>;
}

// The person's own key: one field, saved on press (the review sandbox blocks form submission).
function KeyFlow({provider}:{provider:KeyProvider}){
 const [suffix,setSuffix]=useState<string|null>(null),[key,setKey]=useState('');
 const ok=keyShape[provider].test(key);
 if(suffix)return <div className="st-flow" data-testid={`flow-key-${provider}`} data-phase="done"><StatusMark label={`${keyNames[provider]}-avain tallennettu · ${keyPrefix(provider)}${suffix}`} tone="success"/><div className="st-actions"><Button data-testid="pv-continue" size="page" variant="primary">Avaa työtilat</Button><Button size="row" variant="quiet" onPress={()=>setSuffix(null)}>Vaihda avain</Button></div></div>;
 return <form className="st-flow" data-testid={`flow-key-${provider}`} data-phase="start" onSubmit={e=>{e.preventDefault();if(ok){setSuffix(key.slice(-4));setKey('');}}}>
  <label className="st-field"><strong>{keyNames[provider]} API-avain</strong><span className="st-inline"><input data-testid={`key-input-${provider}`} type="password" autoComplete="off" value={key} maxLength={207} placeholder={keyPrefix(provider)} onChange={e=>setKey(e.target.value)}/><Button data-testid={`key-save-${provider}`} size="row" variant="primary" isDisabled={!ok} onPress={()=>{setSuffix(key.slice(-4));setKey('');}}>Tallenna</Button></span></label>
  <p className="st-quiet">{key&&!ok?<span role="alert">Tämä ei näytä {keyNames[provider]}-avaimelta ({keyHint[provider]}).</span>:`Avain tallentuu vain omalle käyttäjällesi eikä sitä näytetä uudelleen. ${keyNames[provider]} laskuttaa käytöstä.`}</p>
 </form>;
}
const Flow=({o}:{o:Option})=>o.key?<KeyFlow provider={o.key}/>:<SubFlow id={o.id as 'openai'|'claude'}/>;

const MoreLink=({open,onPress,back}:{open?:boolean;onPress:()=>void;back?:string})=><AnnTarget n={3} className="st-more-wrap"><button type="button" className="st-more" data-testid={back?'pv-back':'pv-other'} aria-expanded={back?undefined:open} onClick={onPress}><span className="st-chev" aria-hidden="true">{back?'‹':'›'}</span>{back??'Käytä muuta AI-palvelua'}</button><Ann n={3}/></AnnTarget>;
const StepHead=({title,lead,badge}:{title:string;lead:string;badge?:string})=><AnnTarget n={2}><header className="st-head"><h1 data-testid="pv-title">{title}<Ann n={2}/></h1>{badge&&<span className="st-badge">{badge}</span>}<p>{lead}</p></header></AnnTarget>;
const leadAll='Valitse yksi tapa. Voit lisätä muita tilejä myöhemmin asetuksissa.';
const leadLater='Voit lisätä muita tilejä myöhemmin asetuksissa.';
const leadOffer=(o:Option)=>`Sivusto ehdottaa: ${o.name}. Voit lisätä muita tilejä myöhemmin asetuksissa.`;

// Layout A, "Ehdotus ja lista": every option is a row of one list; the selected row opens in place.
function StepCards({offer}:{offer:Opt|'all'}){
 const [open,setOpen]=useState(offer==='all'),[sel,setSel]=useState<Opt>(offer==='all'?'openai':offer);
 const row=(o:Option,suggested=false)=>{const on=sel===o.id;return <li key={o.id} className={`st-opt${on?' on':''}${o.key?' key':''}`} data-testid={`opt-${o.id}`}>
  <button type="button" className="st-opt-head" aria-expanded={on} onClick={()=>setSel(o.id)}><Mark o={o}/><span className="st-opt-txt"><strong>{o.name}{o.missing&&missingTag}</strong><small>{o.how}</small></span>{suggested?<span className="st-badge">Ehdotus</span>:<span className="st-radio" aria-hidden="true"/>}</button>
  {on&&<div className="st-opt-body"><Flow o={o}/></div>}</li>;};
 const groups=(among:Option[])=><div className="st-groups" data-testid="pv-others">
  {among.some(o=>!o.key)&&<><p className="st-group">Tilaus</p><ul className="st-opts">{among.filter(o=>!o.key).map(o=>row(o))}</ul></>}
  <p className="st-group">API-avain · maksu käytön mukaan</p><ul className="st-opts">{among.filter(o=>o.key).map(o=>row(o))}</ul></div>;
 if(offer==='all')return <div className="st" data-layout="cards"><StepHead title="Kirjaudu AI-palveluun" lead={leadAll}/>{groups(opts)}</div>;
 const o=opt(offer);
 return <div className="st" data-layout="cards"><StepHead title="Kirjaudu AI-palveluun" lead={leadOffer(o)}/><ul className="st-opts">{row(o,true)}</ul>
  <MoreLink open={open} onPress={()=>setOpen(v=>!v)}/>{open&&groups(opts.filter(x=>x.id!==offer))}</div>;
}

// Layout B, "Tapa ja palvelu": a production Segmented picks the way; the three keys share one field.
function StepSegmented({offer}:{offer:Opt|'all'}){
 const [choosing,setChoosing]=useState(offer==='all');
 const start=offer==='all'?'openai':offer;
 const [method,setMethod]=useState<'openai'|'claude'|'key'>(opt(start).key?'key':start as 'openai'|'claude');
 const [provider,setProvider]=useState<KeyProvider>(opt(start).key??'openai');
 if(!choosing&&offer!=='all'){const o=opt(offer);return <div className="st" data-layout="segmented"><StepHead title={o.key?`Lisää ${o.name}`:`Kirjaudu: ${o.name}`} lead={leadLater} badge="Sivuston ehdotus"/><Flow o={o}/><MoreLink onPress={()=>setChoosing(true)} open={false}/></div>;}
 return <div className="st" data-layout="segmented" data-testid="pv-others"><StepHead title="Valitse AI-tili" lead={leadAll}/>
  <div className="st-pick"><Segmented data-testid="pv-method" label="Tapa" size="row" options={[{id:'openai',label:'ChatGPT'},{id:'claude',label:'Claude'},{id:'key',label:'API-avain'}]} value={method} onChange={setMethod}/>
   {method==='key'&&<div className="st-pick-row"><span className="st-quiet">Palvelu</span><Segmented data-testid="pv-provider" label="API-avaimen palvelu" size="row" options={(Object.keys(keyNames) as KeyProvider[]).map(p=>({id:p,label:keyNames[p]}))} value={provider} onChange={setProvider}/></div>}
   {method==='key'&&provider!=='openai'&&<p className="st-quiet">{missingTag}</p>}
  </div>
  {method==='key'?<KeyFlow key={provider} provider={provider}/>:<Flow key={method} o={opt(method)}/>}
  {offer!=='all'&&<MoreLink onPress={()=>setChoosing(false)} back={`Palaa sivuston ehdotukseen: ${opt(offer).name}`}/>}</div>;
}

// Layout C, "Yksi kerrallaan": the step is one service; the others are a list of rows to switch to.
function StepList({offer}:{offer:Opt|'all'}){
 const [chosen,setChosen]=useState<Opt|null>(offer==='all'?null:offer),[open,setOpen]=useState(false);
 const list=(among:Option[],all=false)=><ul className="st-rows" data-testid={all?undefined:'pv-others'}>{among.map(o=><li key={o.id} data-testid={`opt-${o.id}`}><Mark o={o}/><span className="st-opt-txt"><strong>{o.name}{o.missing&&missingTag}</strong><small>{o.how}</small></span><Button data-testid={`pv-pick-${o.id}`} size="row" variant="secondary" onPress={()=>{setChosen(o.id);setOpen(false);}}>Valitse</Button></li>)}</ul>;
 if(!chosen)return <div className="st" data-layout="list"><StepHead title="Valitse AI-tili" lead={leadAll}/><div className="st-groups" data-testid="pv-others"><p className="st-group">Tilaus</p>{list(subs,true)}<p className="st-group">API-avain · maksu käytön mukaan</p>{list(keyOpts,true)}</div></div>;
 const o=opt(chosen),suggested=chosen===offer;
 return <div className="st" data-layout="list"><StepHead title={o.key?`Lisää ${o.name}`:`Kirjaudu: ${o.name}`} lead={leadLater} badge={suggested?'Sivuston ehdotus':undefined}/><Flow key={chosen} o={o}/>
  {suggested?<><MoreLink open={open} onPress={()=>setOpen(v=>!v)}/>{open&&list(opts.filter(x=>x.id!==chosen))}</>:<MoreLink onPress={()=>setChosen(offer==='all'?null:offer)} back={offer==='all'?'Takaisin valintaan':`Palaa sivuston ehdotukseen: ${opt(offer as Opt).name}`}/>}</div>;
}

type Person={offer:Opt|'all';siteKey:SiteKey};
function PersonScreen({person,layout,clones}:{person:Person;layout:Layout;clones:ClonePlace}){
 const ai=!person.siteKey;
 const route:RouteStep[]=[
  {id:'github',label:'GitHub',state:'done',note:'Kirjautunut'},
  {id:'repositories',label:'Repot',state:'done',note:clones==='route'?`Haetaan ${clone.percent} %`:'1 repo haussa',progress:clones==='route'?clone.percent:undefined},
  {id:'google',label:'Google',state:ai?'skipped':'current'},
  ...(ai?[{id:'ai',label:'AI-tili',state:'current' as const,ann:1}]:[]),
 ];
 const status=clones==='identity'?<span className="fr-bg" data-testid="pv-clones"><Spin/>Repot haussa · {clone.percent} %</span>:undefined;
 const notice=clones==='notice'?<p className="fr-notice" data-testid="pv-clones"><Spin/><span>Taustalla haetaan <code>{clone.name}</code> · {clone.percent} %. Valmiit repot näkyvät työtiloina.</span></p>:undefined;
 const Step=layout==='cards'?StepCards:layout==='segmented'?StepSegmented:StepList;
 return <div className="person" data-testid="person-view" data-at={ai?'ai':'google'}><ProtoFrame route={route} status={status} notice={notice}>
  {ai?<Step offer={person.offer}/>:<div className="st"><AnnTarget n={1}><header className="st-head"><h1>Google<Ann n={1}/></h1><p>Yhdistä oma Google-tilisi, jos agentin pitää lukea sähköpostia, kalenteria tai Drivea. Voit tehdä tämän myöhemmin asetuksissa.</p></header></AnnTarget><div className="ig-tile"><ProviderMark provider="google"/><div><span className="ig-rn">Google</span><span className="ig-meta">Gmail · Kalenteri · Yhteystiedot · Drive</span></div><Button size="row" variant="secondary">Yhdistä…</Button></div><div className="st-actions"><Button size="page" variant="secondary">Jatka ilman Googlea</Button></div><p className="st-quiet" data-testid="pv-last">Tämä on reitin viimeinen vaihe. Seuraavaksi avautuvat työtilat.</p></div>}
 </ProtoFrame></div>;
}

// ---------- Device frames around the person's screen ----------

type Device='desktop'|'phone';
const DESKTOP=720;
// A desktop preview keeps a desktop width and scales down to fit, so a narrow
// column still shows the Kartta layout the person will see rather than reflowing it.
function DeviceStage({device,children,chrome=true}:{device:Device;children:ReactNode;chrome?:boolean}){
 const outer=useRef<HTMLDivElement>(null),inner=useRef<HTMLDivElement>(null);
 const [box,setBox]=useState({w:DESKTOP,h:0});
 useLayoutEffect(()=>{const o=outer.current,i=inner.current;if(!o||!i)return;const ro=new ResizeObserver(()=>setBox({w:o.clientWidth,h:i.offsetHeight}));ro.observe(o);ro.observe(i);return()=>ro.disconnect();},[device]);
 const width=device==='phone'?Math.min(390,box.w):Math.max(box.w,DESKTOP),scale=device==='phone'?1:Math.min(1,box.w/DESKTOP);
 return <div className={`dev dev-${device}`} ref={outer} data-testid="device" data-device={device}>
  <div className="dev-box" style={{width:device==='phone'?width:'100%',height:scale<1?box.h*scale:undefined}}>
   <div ref={inner} className="dev-inner" style={{width:device==='phone'?'100%':width,transform:scale<1?`scale(${scale})`:undefined}}>
    {chrome&&(device==='desktop'?<div className="dev-chrome"><span className="dev-dots" aria-hidden="true"><i/><i/><i/></span><span className="dev-url">habitat.example.test/aloitus</span></div>:<div className="dev-notch" aria-hidden="true"/>)}
    <div className="dev-screen">{children}</div>
   </div>
  </div>
  {scale<1&&<p className="dev-scale">Tietokoneen näkymä pienennettynä ({Math.round(scale*100)} %).</p>}
 </div>;
}
const DeviceToggle=({value,onChange}:{value:Device;onChange:(d:Device)=>void})=><Segmented data-testid="pv-device" label="Esikatselun laite" size="row" options={[{id:'desktop',label:'Tietokone'},{id:'phone',label:'Puhelin'}]} value={value} onChange={onChange}/>;
const PreviewLabel=({children}:{children?:ReactNode})=><div className="pv-label"><span className="pv-chip"><Icon name="eye" width={14} height={14}/>Henkilön näkymä</span><span className="pv-who">Uusi henkilö, kun GitHub, Repot ja Google on käyty</span>{children}</div>;

// ---------- The administrator: AI-tili as "Kolme tapaa" ----------

function SiteKeyEditor({siteKey,onSave,onCancel}:{siteKey:SiteKey;onSave:(k:NonNullable<SiteKey>)=>void;onCancel:()=>void}){
 const [editing,setEditing]=useState(!siteKey),[provider,setProvider]=useState<KeyProvider>(siteKey?.provider??'openai'),[key,setKey]=useState('');
 const ok=keyShape[provider].test(key);
 const save=()=>{if(!ok)return;onSave({provider,suffix:key.slice(-4)});setKey('');setEditing(false);};
 return <div className="sitekey" data-testid="site-key">
  {siteKey&&!editing&&<div className="sitekey-row" data-testid="site-key-present"><div><strong>{keyNames[siteKey.provider]} API-avain</strong><code data-testid="site-key-suffix">{keyPrefix(siteKey.provider)}{siteKey.suffix}</code><span className="muted">Käytöstä laskutetaan avaimen omistajan tiliä.</span></div><Button data-testid="site-key-replace" size="row" variant="secondary" onPress={()=>{setProvider(siteKey.provider);setEditing(true);}}>Vaihda avain…</Button></div>}
  {editing&&<form className="sitekey-form" onSubmit={e=>{e.preventDefault();save();}}>
   <label className="field"><strong>Palvelu</strong><select data-testid="site-key-provider" value={provider} onChange={e=>setProvider(e.target.value as KeyProvider)}>{(Object.keys(keyNames) as KeyProvider[]).map(p=><option key={p} value={p}>{keyNames[p]}{p==='openai'?'':' (ei vielä tuotannossa)'}</option>)}</select></label>
   <label className="field"><strong>{siteKey?'Uusi API-avain':'API-avain'}</strong><input data-testid="site-key-input" type="password" autoComplete="off" value={key} maxLength={207} onChange={e=>setKey(e.target.value)}/></label>
   <p className="muted">{key&&!ok?<span role="alert" data-testid="site-key-error">Tämä ei näytä {keyNames[provider]}-avaimelta ({keyHint[provider]}).</span>:'Avain lähetetään kerran eikä sitä näytetä uudelleen.'}</p>
   <div className="sitekey-actions"><Button data-testid="site-key-cancel" size="row" variant="secondary" onPress={()=>{setKey('');if(siteKey)setEditing(false);else onCancel();}}>Peruuta</Button><Button data-testid="site-key-save" size="row" variant="primary" isDisabled={!ok} onPress={save}>{siteKey?'Vaihda avain':'Ota avain käyttöön'}</Button></div>
  </form>}
  <p className="proto-note">Prototyyppi ei lähetä avainta minnekään. Avaimen säilytys ja jakelu Unix-käyttäjille ratkaistaan auktoriteettisuunnitelmassa.</p>
 </div>;
}

type AiState={way:Way;offer:Opt;siteKey:SiteKey;keyOpen:boolean};
function AiSettings({s,set,radioName}:{s:AiState;set:(p:Partial<AiState>)=>void;radioName:string}){
 const [leave,setLeave]=useState<Way|undefined>();
 const way:Way=s.siteKey||s.keyOpen?'key':s.way;
 const pick=(w:Way)=>{if(w===way)return;if(s.siteKey){setLeave(w);return;}if(w==='key'){set({keyOpen:true});return;}set({keyOpen:false,way:w});};
 return <section className="config" data-step="ai" aria-label="AI-tilin asetus">
  <p className="eyebrow">Sinun asetuksesi</p><h3>AI-tili</h3>
  <AnnSource n={1}><p className="cfg-lbl">Miten AI-tili tarjotaan<Ann n={1}/></p><Segmented data-testid="ai-way" label="AI-tilin tarjoaminen" size="row" options={[{id:'all',label:'Henkilö valitsee'},{id:'default',label:'Oletus'},{id:'key',label:'Sivuston avain'}]} value={way} onChange={pick}/></AnnSource>
  {way==='all'&&<p className="muted">Henkilö näkee kaikki viisi vaihtoehtoa.</p>}
  {way==='default'&&<AnnSource n={2}><p className="cfg-lbl">Oletuksena tarjottava<Ann n={2}/></p><fieldset className="ai-choices" aria-label="Oletuksena tarjottava AI-tili">{opts.map(c=><label key={c.id} className="ai-choice" data-testid={`ai-${c.id}`}><input type="radio" name={radioName} checked={s.offer===c.id} onChange={()=>set({offer:c.id})}/><span><strong>{c.name} {c.missing&&missingTag}</strong></span></label>)}</fieldset></AnnSource>}
  {way==='key'&&<><p className="muted">Sivusto antaa avaimen, eikä AI-tilin vaihetta näytetä.{!s.siteKey&&' Kunnes avain on annettu, henkilö näkee vaiheen kuten ennen.'}</p><SiteKeyEditor siteKey={s.siteKey} onSave={k=>set({siteKey:k,keyOpen:false})} onCancel={()=>set({keyOpen:false})}/></>}
  {way==='default'&&<AnnSource n={3}><p className="muted">Muut vaihtoehdot jäävät linkin <em>› Käytä muuta AI-palvelua</em> taakse.<Ann n={3}/></p></AnnSource>}
  <ModalOverlay className="ah-overlay" isOpen={!!leave} onOpenChange={o=>!o&&setLeave(undefined)} isDismissable><Modal className="ah-modal"><Dialog className="ah-dialog" aria-label="Poistetaanko sivuston API-avain?"><Heading slot="title">Poistetaanko sivuston API-avain?</Heading><p>Uudet henkilöt kirjautuvat taas omalla tilillään. Avainta ei peruta palvelussa {s.siteKey?keyNames[s.siteKey.provider]:''}.</p><div className="ah-dialog-actions"><Button size="row" onPress={()=>setLeave(undefined)}>Peruuta</Button><Button data-testid="leave-key-confirm" size="row" variant="danger-subtle" onPress={()=>{const w=leave!;setLeave(undefined);set({siteKey:null,keyOpen:false,way:w});}}>Poista avain</Button></div></Dialog></Modal></ModalOverlay>
 </section>;
}
const personOf=(s:AiState):Person=>({siteKey:s.siteKey,offer:s.way==='default'?s.offer:'all'});
const summary=(s:AiState)=>s.siteKey?`AI-tilin vaihetta ei näytetä. Agentit käyttävät sivuston ${keyNames[s.siteKey.provider]}-avainta, ja reitti päättyy Googleen.`:s.way==='default'?`Vain ${opt(s.offer).name} ja linkki › Käytä muuta AI-palvelua.`:'Kaikki viisi vaihtoehtoa: kaksi tilausta ja kolme API-avainta.';
const aiHint=(s:AiState)=>s.siteKey?`Ohitetaan · sivuston ${keyNames[s.siteKey.provider]}-avain`:s.way==='default'?`Oletus: ${opt(s.offer).name}`:'Henkilö valitsee';

// ---------- Settings: Käyttöönotto is its own tab; access lives with the users ----------

type Tab='server'|'onboarding'|'users';
const tabs:[Tab,string][]=[['server','Palvelin'],['onboarding','Käyttöönotto'],['users','Käyttäjät ja pääsy']];
function ServerTab(){return <><h2>Palvelin</h2><div className="facts s-card"><div className="s-row"><strong>Northstar</strong><code>habitat.example.test</code></div><div className="s-row"><strong>Versio</strong><code>v0.0.0-prototype</code></div><div className="s-row"><strong>Käyttäjiä</strong><span>2</span></div></div><p className="muted">Yleiset palvelintiedot. Käyttöönotto ja pääsy ovat omilla välilehdillään.</p></>;}
function UsersTab(){
 const [allowed,setAllowed]=useState(['maija-esim','teppo-esim','northstar-ops']),[name,setName]=useState('');
 const ok=/^[A-Za-z0-9-]{1,39}$/.test(name)&&!allowed.includes(name);
 return <><h2>Käyttäjät ja pääsy</h2>
  <h3>Sallitut GitHub-tunnukset</h3><p className="muted">Vain nämä GitHub-käyttäjät voivat kirjautua. Ensimmäisellä kirjautumisella heille luodaan oma Unix-käyttäjä.</p>
  <div className="s-card allowed" data-testid="allowed">{allowed.map(a=><div className="s-row" key={a}><code>@{a}</code><Button size="row" variant="quiet" onPress={()=>setAllowed(l=>l.filter(x=>x!==a))}>Poista</Button></div>)}</div>
  <form className="addrow" onSubmit={e=>{e.preventDefault();if(ok){setAllowed(l=>[...l,name]);setName('');}}}><label className="field"><strong>Lisää GitHub-tunnus</strong><input data-testid="allowed-input" value={name} onChange={e=>setName(e.target.value.trim())} placeholder="github-tunnus"/></label><Button size="row" variant="secondary" isDisabled={!ok} onPress={()=>{setAllowed(l=>[...l,name]);setName('');}}>Lisää</Button></form>
  <h3>Käyttäjät</h3><div className="s-card"><div className="s-row"><span><strong>@maija-esim</strong> <span className="muted">Unix: maija</span></span><span className="muted">Liittyi 21.10.</span></div><div className="s-row"><span><strong>@teppo-esim</strong> <span className="muted">Unix: teppo</span></span><span className="muted">Ei vielä kirjautunut</span></div></div></>;
}

let reviewTheme='light',reviewPhone=false;
const initial:AiState={way:'default',offer:'openai',siteKey:null,keyOpen:false};
function App({direction}:{direction:number}){
 const p=plan[direction];
 const [theme,setTheme]=useState(reviewTheme),[phone,setPhone]=useState(reviewPhone);
 const [tab,setTab]=useState<Tab>('onboarding');
 const [s,setS]=useState<AiState>(initial),[saved,setSaved]=useState<{way:Way;offer:Opt}>({way:'default',offer:'openai'});
 const [dev,setDev]=useState<Device>(direction===2||reviewPhone?'phone':'desktop');
 const [mode,setMode]=useState(false),[hot,setHot]=useState<number|null>(null),[notice,setNotice]=useState('');
 const set=(patch:Partial<AiState>)=>{setNotice('');setS(x=>({...x,...patch}));};
 const dirty=s.way!==saved.way||(s.way==='default'&&s.offer!==saved.offer);
 const person=personOf(s);
 const screen=<PersonScreen key={`${person.offer}|${person.siteKey?.provider??''}|${p.layout}`} person={person} layout={p.layout} clones={p.clones}/>;
 const settings=<div className="s-card cfg-card"><AiSettings s={s} set={set} radioName={`ai-offer-${direction}${mode?'-mode':''}`}/>{p.preview!=='mode'&&<p className="effect" data-testid="effect"><strong>Henkilö näkee:</strong> {summary(s)}</p>}</div>;
 const rows:[string,string,string][]=[['github','GitHub','Kirjautuminen'],['repos','Repot','2 esivalittuna'],['google','Google','Voi ohittaa'],['add','Lisää integraatio','Uusi vaihe ennen AI-tiliä']];
 const stepList=<div className="s-card listcol"><p className="eyebrow">Uuden henkilön reitti</p><ol className="steplist route-like" aria-label="Käyttöönoton vaiheet, kiinteä järjestys">{rows.map(([k,name,hint],i)=><li key={k} className={k==='add'?'add':undefined}><button type="button" disabled title="Kierros 4 näyttää vain AI-tilin"><span className="num">{k==='add'?<Icon name="plus" width={14} height={14}/>:i+1}</span><span className="txt"><strong>{name}</strong><small>{hint}</small></span></button></li>)}
  <li className={s.siteKey?'skipped':undefined}><button type="button" data-testid="step-ai" aria-current="step"><span className="num">{s.siteKey?'–':'4'}</span><span className="txt"><strong>AI-tili</strong><small data-testid="step-ai-hint">{aiHint(s)}</small></span></button></li></ol></div>;
 const stage=()=><div className="pv-stage">{screen}</div>;
 let body:ReactNode;
 if(p.preview==='window')body=<div className="layout l-window"><div className="leftcol">{stepList}{settings}</div>
  <aside className="preview" aria-label="Henkilön näkymä"><PreviewLabel><DeviceToggle value={dev} onChange={setDev}/></PreviewLabel><DeviceStage device={dev}>{stage()}</DeviceStage></aside></div>;
 else if(p.preview==='mode')body=<div className="layout l-mode">{stepList}<div className="stepcol">{mode?<div className="s-card cfg-card cfg-away"><p className="muted">Asetukset ovat esikatselun sivupaneelissa.</p></div>:settings}
  <div className="s-card pv-summary"><div><p className="eyebrow">Henkilön näkymä</p><p data-testid="pv-summary">{summary(s)}</p></div><Button data-testid="pv-open" size="page" variant="primary" onPress={()=>setMode(true)}><Icon name="eye" width={16} height={16}/>Näytä henkilön näkymä</Button></div></div>
  <ModalOverlay className="pm-overlay" isOpen={mode} onOpenChange={setMode} isDismissable={false}><Modal className="pm-modal" data-theme={theme}><Dialog className="pm" aria-label="Esikatselu: uuden henkilön näkymä">
   <header className="pm-bar"><span className="pm-title"><Icon name="eye" width={16} height={16}/><strong>Esikatselu</strong><span>Näin uusi henkilö näkee käyttöönoton. Mitään ei tallenneta.</span></span><DeviceToggle value={dev} onChange={setDev}/><Button data-testid="pv-close" size="row" variant="secondary" onPress={()=>setMode(false)}>Sulje esikatselu</Button></header>
   <div className="pm-body"><div className="pm-stage"><DeviceStage device={dev}>{stage()}</DeviceStage></div><aside className="pm-drawer" aria-label="Asetuksesi">{settings}<p className="muted">Muutos näkyy esikatselussa heti. Tallenna käyttöönotto -painike on asetussivulla.</p></aside></div>
  </Dialog></Modal></ModalOverlay></div>;
 else body=<Annot.Provider value={{on:true,hot,setHot}}><div className="layout l-annot"><div className="leftcol">{stepList}{settings}<p className="muted legend">Numerot yhdistävät asetuksen siihen kohtaan, jota se muuttaa henkilön näkymässä. Vie osoitin asetuksen päälle.</p></div>
  <aside className="preview" aria-label="Henkilön näkymä"><PreviewLabel><DeviceToggle value={dev} onChange={setDev}/></PreviewLabel><DeviceStage device={dev}>{stage()}</DeviceStage></aside></div></Annot.Provider>;
 const onboarding=<><h2>Käyttöönotto</h2><p className="lede">Mitä uusi henkilö käy läpi ensimmäisellä kirjautumisella. Vaiheiden järjestys on kiinteä: GitHub, repot, integraatiot ja AI-tili.</p>
  {notice&&<p role="status" className="notice">{notice}</p>}
  <div className={`variant-${direction}`}>{body}</div>
  <div className="save"><span>{dirty?'Tallentamattomia muutoksia':'Ei tallentamattomia muutoksia'}</span><Button data-testid="discard" size="row" variant="secondary" isDisabled={!dirty} onPress={()=>{setS(x=>({...x,...saved}));setNotice('Luonnos peruttu.');}}>Peru muutokset</Button><Button data-testid="save" size="page" variant="primary" isDisabled={!dirty} onPress={()=>{setSaved({way:s.way,offer:s.offer});setNotice('Prototyypin malli tallennettu. Oikea palvelin ei muuttunut.');}}>Tallenna käyttöönotto</Button></div></>;
 return <div data-theme={theme} className={phone?'review phone':'review'}><header className="reviewbar"><strong>Käyttöönotto · kierros 4 · esikatselu ja AI-vaihe</strong><label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label><label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);setDev(reviewPhone||direction===2?'phone':'desktop');}}/> 390 px</label><p>Synteettiset tiedot. Ei yhteyttä palvelimeen tai AI-palveluihin.</p></header>
 <p className="axis">Kolme esikatselun esitystä, kukin oman AI-vaiheen asettelun kanssa. Ylläpitäjän asetus on Kolme tapaa. Suositus: Ikkuna vieressä.</p>
 <div className="shell"><div className="hostbar"><strong>Open Habitat</strong><span>Northstar · esimerkkisivusto</span><Icon name="user"/></div><section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>{['Tili','Agentit','Integraatiot','Ulkoasu','Editori'].map(n=><span className="s-nav-i" key={n}>{n}</span>)}<span className="s-nav-h">Palvelimen ylläpito</span>{tabs.map(([id,label])=><button type="button" key={id} className="s-nav-i" data-testid={`tab-${id}`} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{label}</button>)}<span className="s-nav-i">Levytila</span></nav><main className="s-main">
 <nav className="mobiletabs" aria-label="Palvelimen ylläpito"><span className="muted">Asetukset › Palvelimen ylläpito</span><div>{tabs.map(([id,label])=><button type="button" key={id} data-testid={`mtab-${id}`} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{label}</button>)}</div></nav>
 {tab==='onboarding'?onboarding:tab==='users'?<UsersTab/>:<ServerTab/>}
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
directions.forEach((name,i)=>{const button=document.createElement('button');button.className='proto-picker-item';button.textContent=name.replaceAll(' ','\u00a0');if(i===0){button.setAttribute('data-active','');button.setAttribute('aria-current','true');}picker.append(button);});
document.body.append(picker);
new Function('stage','variants',pickerSource)(stageSink,variants);
