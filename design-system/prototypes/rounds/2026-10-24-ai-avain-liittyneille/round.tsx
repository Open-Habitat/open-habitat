import React, {useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon, type IconName} from '../../../../web/src/components/Icon';
import {StatusMark} from '../../../../web/src/components/Status';
import {Checkbox} from '../../../../web/src/components/Primitives';
import {SiteKeyEditor, keyNames} from '../../../../web/src/components/SiteKeySettings';
import type {SiteKey} from '../../../../web/src/app/onboardingConfig';
import type {AccessEntry, AccessView, OnboardingReceipt} from '../../../../web/src/app/serverAccess';
import {ServerAccess} from './access';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/SiteKeySettings.css';
import './round.css';

// Palvelimen ylläpito: giving the site AI key to people who joined before it
// existed (admin ai-key seed, ADR 0030 "Rotation and removal"). The write is
// the same in every direction: the person's own daemon writes the key only
// where their Pi has no entry for that provider, or exactly a copy the site
// gave earlier, decided under Pi's lock. The axis is where the administrator
// does it: on the person's row in Käyttäjät ja pääsy, on the AI-avain page
// for many at once, or both with one shared dialog. Everything is synthetic.
const directions=['Rivillä','AI-avain-sivulla','Molemmat'];
const ROW=0,PAGE=1;
const hasRow=(d:number)=>d!==PAGE,hasPage=(d:number)=>d!==ROW;

// ---------- Synthetic site and people ----------

const TODAY='2026-10-24T10:00:00Z';
const OLD:SiteKey={provider:'anthropic',suffix:'m4Pz',set_at:'2026-10-20T08:00:00Z'};
const CUR:SiteKey={provider:'anthropic',suffix:'7Q2x',set_at:TODAY};
const prefix=(k:SiteKey)=>k.provider==='anthropic'?'sk-ant-…':'sk-…';
/** What the person's own Pi holds for the site key's provider. The browser
 * never sees this; the person's daemon answers a check with one word. */
type Truth={kind:'none'}|{kind:'site';suffix:string}|{kind:'own'}|{kind:'down'};
/** The gateway's own record: which key it gave whom, as a salted fingerprint
 * (here its suffix), and when. Not a reading of the person's Pi. */
type Given={suffix:string;at:string};
type Person={entry:AccessEntry;name:string;truth:Truth;given?:Given};

const receipt=(at:string,ai:OnboardingReceipt['ai_key']):OnboardingReceipt=>({at,mode:'skip',defaults:[],ai_key:ai});
const person=(id:string,login:string,name:string,username:string,truth:Truth,extra:Partial<AccessEntry>={}):Person=>({name,truth,entry:{id,login_hint:login,username,source:'site_admin',state:'joined',administrator:false,denied:false,last_seen:'2026-10-23T18:00:00Z',onboarding:receipt('2026-10-19T09:00:00Z','not_offered'),...extra}});
type Scenario='none'|'first'|'rotated';
const scenarios:Record<Scenario,{label:string;hint:string;key?:SiteKey;history:string[]}>={
 none:{label:'Ei avainta',hint:'Sivustolla ei ole AI-avainta. Aseta se AI-avain-sivulla (esim. sk-ant-api03-synteettinen-avain-0000), sitten anna se jo liittyneille.',history:[]},
 first:{label:'Avain juuri asetettu',hint:'Anthropic-avain asetettiin tänään. Kaikki liittyivät ennen sitä, joten kukaan ei saanut kopiota.',key:CUR,history:[CUR.suffix]},
 rotated:{label:'Avain vaihdettu',hint:'Aiempi avain …m4Pz annettiin Tuulille liittyessä ja Ainolle myöhemmin. Tänään avain vaihdettiin …7Q2x:ään.',key:CUR,history:[OLD.suffix,CUR.suffix]},
};
function people(s:Scenario):Person[]{
 const rotated=s==='rotated';
 return [
  {...person('1001','kaisa-admin','Kaisa Admin','kaisa',{kind:'own'},{source:'operator',administrator:true,onboarding:undefined}),},
  {...person('1002','aino-v','Aino Virtanen','aino',rotated?{kind:'site',suffix:OLD.suffix}:{kind:'none'}),given:rotated?{suffix:OLD.suffix,at:'2026-10-21T12:00:00Z'}:undefined},
  person('1003','mikko-k','Mikko Korhonen','mikko',{kind:'own'}),
  // A Claude subscription is Pi's anthropic entry too, so it is "own".
  person('1004','sanna-l','Sanna Laine','sanna',{kind:'own'}),
  // Has an OpenAI key of her own, nothing for Anthropic.
  person('1005','olli-p','Olli Peltonen','olli',{kind:'none'}),
  rotated
   ?{...person('1006','tuuli-h','Tuuli Heikkinen','tuuli',{kind:'site',suffix:OLD.suffix},{onboarding:receipt('2026-10-20T15:00:00Z','seeded')}),given:{suffix:OLD.suffix,at:'2026-10-20T15:00:00Z'}}
   :person('1006','tuuli-h','Tuuli Heikkinen','tuuli',{kind:'none'}),
  person('1007','ville-r','Ville Rantanen','ville',{kind:'down'}),
  {name:'Eero Saari',truth:{kind:'none'},entry:{id:'1008',login_hint:'eero-s',source:'site_admin',state:'allowed',administrator:false,denied:false,at:'2026-10-22T09:00:00Z'}},
  {name:'Olli Mäki',truth:{kind:'own'},entry:{id:'1009',login_hint:'pekka-m',username:'pekka',source:'site_admin',state:'withdrawn',administrator:false,denied:true,at:'2026-10-18T09:00:00Z'}},
 ];
}
const joined=(p:Person)=>p.entry.state==='joined';
const at=(p:Person)=>`@${p.entry.login_hint}`;
const day=(iso:string)=>{const d=new Date(iso);return `${d.getDate()}.${d.getMonth()+1}.`;};
const list=(xs:string[])=>xs.length<2?xs.join(''):xs.slice(0,-1).join(', ')+' ja '+xs[xs.length-1];

// ---------- The check and the write (the person's daemon, under Pi's lock) ----------

/** One word from the person's daemon about the site key's provider. It never
 * names or describes a credential the person added. */
type Check='absent'|'earlier'|'current'|'own'|'unknown';
const checkOf=(t:Truth,key:SiteKey):Check=>t.kind==='none'?'absent':t.kind==='own'?'own':t.kind==='down'?'unknown':t.suffix===key.suffix?'current':'earlier';
const writable=(c?:Check)=>c==='absent'||c==='earlier';
const checkText=(c:Check,key:SiteKey):{label:string;tone:'neutral'|'info'|'success'|'warning';effect:string}=>({
 absent:{label:`Ei ${keyNames[key.provider]}-tunnusta`,tone:'info' as const,effect:'Saa avaimen'},
 earlier:{label:'Sivuston aiempi avain',tone:'info' as const,effect:'Kopio vaihtuu uuteen'},
 current:{label:'On jo tämä avain',tone:'success' as const,effect:'Ei muutosta'},
 own:{label:`Oma ${keyNames[key.provider]}-tunnus`,tone:'neutral' as const,effect:'Ei koskaan korvata'},
 unknown:{label:'Ei vastausta',tone:'warning' as const,effect:'Ei tarkistettu'},
})[c];
type Outcome='written'|'replaced'|'kept'|'failed';
const outcomeText:Record<Outcome,string>={written:'Avain kirjoitettu',replaced:'Kopio vaihdettu uuteen',kept:'Oma tunnus, ei muutettu',failed:'Ei vastausta, ei kirjoitettu'};
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));

// ---------- The giving dialog, shared by every direction ----------

function GiveDialog({targets,siteKey,theme,check,write,onClose}:{targets:Person[];siteKey:SiteKey;theme:string;check:(p:Person)=>Promise<Check>;write:(ids:string[])=>Promise<Record<string,Outcome>>;onClose:()=>void}){
 const one=targets.length===1;
 const [checks,setChecks]=useState<Record<string,Check>>({});
 const [chosen,setChosen]=useState<Set<string>>(new Set());
 const [phase,setPhase]=useState<'checking'|'review'|'writing'|'done'>('checking');
 const [outcomes,setOutcomes]=useState<Record<string,Outcome>>({});
 useEffect(()=>{let live=true;
  void Promise.all(targets.map(async p=>{const c=await check(p);if(live){setChecks(x=>({...x,[p.entry.id]:c}));if(writable(c))setChosen(s=>new Set(s).add(p.entry.id));}})).then(()=>{if(live)setPhase('review');});
  return()=>{live=false;};
 // The targets are fixed for the dialog's life.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 const picked=targets.filter(p=>chosen.has(p.entry.id)&&writable(checks[p.entry.id]));
 const confirm=async()=>{setPhase('writing');setOutcomes(await write(picked.map(p=>p.entry.id)));setPhase('done');};
 const name=keyNames[siteKey.provider];
 const title=one?`Anna sivuston AI-avain ${at(targets[0]!)}:lle`:'Anna sivuston AI-avain liittyneille';
 return <ModalOverlay className="ah-overlay" isOpen isDismissable={phase!=='writing'} onOpenChange={o=>{if(!o)onClose();}}>
  <Modal className="ah-modal" data-theme={theme}>
   <Dialog className="ah-dialog sk-give" aria-label={title} data-testid="give-dialog" data-phase={phase}>
    <Heading slot="title">{title}</Heading>
    <p className="sk-terms"><strong>{name} API-avain</strong> <code>{prefix(siteKey)}{siteKey.suffix}</code>. {phase==='checking'?'Tarkistetaan henkilön omasta palvelusta, mitä hänen Pi:llään on…':phase==='done'?'Valmis.':'Tarkistettu henkilön omasta palvelusta juuri nyt. Kirjoitushetkellä tarkistus tehdään uudelleen.'}</p>
    <ul className="sk-targets" data-testid="give-targets">
     {targets.map(p=>{const c=checks[p.entry.id],o=outcomes[p.entry.id],t=c&&checkText(c,siteKey);
      return <li key={p.entry.id} data-testid={`give-${p.entry.login_hint}`} data-check={c} data-outcome={o}>
       <span className="sk-who">{!one&&c&&writable(c)&&phase==='review'
        ?<Checkbox data-testid={`give-pick-${p.entry.login_hint}`} label={at(p)} checked={chosen.has(p.entry.id)} onChange={v=>setChosen(s=>{const n=new Set(s);if(v)n.add(p.entry.id);else n.delete(p.entry.id);return n;})}/>
        :<strong>{at(p)}</strong>}
        <span className="sk-muted">{p.name} · Unix <code>{p.entry.username}</code></span></span>
       <span className="sk-state">{o?<StatusMark tone={o==='failed'?'warning':o==='kept'?'neutral':'success'} kind={o==='failed'?'unknown':o==='kept'?'neutral':'success'} label={outcomeText[o]}/>
        :t?<><StatusMark tone={t.tone} label={t.label}/><span className="sk-muted" data-testid="give-effect">{t.effect}</span></>
        :<StatusMark tone="info" animated="running" label="Tarkistetaan…"/>}</span>
      </li>;})}
    </ul>
    {phase!=='done'&&<ul className="sa-consequences" data-testid="give-consequences">
     <li><Icon name="key"/><span>Kirjoitat toisen henkilön omiin tunnuksiin. Avain menee {one?'hänen':'heidän'} Pi:hinsä, {one?'hänen':'heidän'} agenttinsa käyttävät sitä, ja {name} laskuttaa sivuston tiliä.</span></li>
     <li><Icon name="lock"/><span>Kopio on {one?'hänen':'heidän'}. {one?'Hän ja hänen':'He ja heidän'} agenttinsa voivat lukea avaimen. Kopiota ei voi perua täältä; käytön estää vain avaimen mitätöinti palvelussa {name}.</span></li>
     <li><Icon name="shield"/><span>Oma avain tai tilaus ei koskaan korvaudu. Aiemmin annettu sivuston kopio vaihtuu uuteen.</span></li>
     <li><Icon name="info"/><span>{one?'Hän näkee':'He näkevät'} Asetukset › Yhteydet -osiossa, että avain on sivuston antama, ja voi vaihtaa sen omaansa.</span></li>
    </ul>}
    <div className="ah-dialog-actions">
     <Button data-testid="give-cancel" size="page" variant="secondary" isDisabled={phase==='writing'} onPress={onClose}>{phase==='done'?'Sulje':'Peruuta'}</Button>
     {phase!=='done'&&<Button data-testid="give-confirm" size="page" variant="primary" isDisabled={phase!=='review'||!picked.length} onPress={()=>void confirm()}>
      {phase==='writing'?'Kirjoitetaan…':one?`Kirjoita avain ${at(targets[0]!)}:n tunnuksiin`:`Kirjoita avain ${picked.length} henkilölle`}</Button>}
    </div>
   </Dialog>
  </Modal>
 </ModalOverlay>;
}

/** The proposed removal question: it names who keeps a copy. */
function RemoveKey({siteKey,holders,theme,onClose,onConfirm}:{siteKey:SiteKey;holders:Person[];theme:string;onClose:()=>void;onConfirm:()=>void}){
 const name=keyNames[siteKey.provider];
 return <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={o=>{if(!o)onClose();}}>
  <Modal className="ah-modal" data-theme={theme}><Dialog className="ah-dialog" aria-label="Poistetaanko sivuston avain?" data-testid="site-key-remove-dialog">
   <Heading slot="title">Poistetaanko sivuston avain?</Heading>
   <p>Uudet henkilöt valitsevat AI-tilin taas itse.</p>
   <p data-testid="remove-holders">{holders.length?<>Sivusto on antanut avaimen {holders.length} henkilölle: {list(holders.map(at))}. Kopiot jäävät heille. Niiden käytön estää vain avaimen mitätöinti palvelussa {name}.</>:'Avainta ei ole annettu kenellekään jo liittyneelle.'}</p>
   <div className="ah-dialog-actions"><Button size="row" onPress={onClose}>Peruuta</Button><Button data-testid="site-key-remove-confirm" size="row" variant="danger-subtle" onPress={onConfirm}>Poista avain</Button></div>
  </Dialog></Modal>
 </ModalOverlay>;
}

// ---------- The person's own view (the same in every direction) ----------

function PersonKey({p,siteKey,history,onOwn,onRemove}:{p:Person;siteKey?:SiteKey;history:string[];onOwn:()=>void;onRemove:()=>void}){
 const [editing,setEditing]=useState(false),[value,setValue]=useState('');
 const t=p.truth,site=t.kind==='site'?t:undefined;
 const stale=site&&siteKey?.suffix!==site.suffix&&history.includes(site.suffix);
 return <div className="s-row" data-testid="person-key" data-kind={t.kind}>
  <div className="s-lbl"><strong>Anthropic API-avain</strong>
   <span className="s-desc" data-testid="person-key-desc">{site
    ?<>Sivuston avain. Ylläpitäjä antoi sen {p.given?day(p.given.at):''} Käyttö laskutetaan sivuston tililtä. {stale?'Sivusto on sittemmin vaihtanut avaimensa, joten tämä kopio voi lakata toimimasta.':'Voit vaihtaa sen omaan avaimeesi.'}</>
    :'Pi:n omat tunnukset tällä palvelimella. Anthropic laskuttaa käytöstä.'}</span></div>
  <div className="s-val"><span data-testid="person-key-value">{t.kind==='none'?'Ei avainta':site?`sk-ant-…${site.suffix}`:'sk-ant-…k9Lw'}</span>
   {site&&<StatusMark tone={stale?'warning':'info'} label={stale?'Sivuston aiempi avain':'Sivuston avain'}/>}
   <Button size="row" data-testid="person-key-own" onPress={()=>setEditing(true)}>{t.kind==='none'?'Lisää avain':site?'Vaihda omaan…':'Vaihda'}</Button>
   {t.kind!=='none'&&<Button size="row" variant="quiet" onPress={onRemove}>Poista avain…</Button>}
  </div>
  {editing&&<form className="s-editor" onSubmit={e=>{e.preventDefault();if(/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(value)){onOwn();setEditing(false);setValue('');}}}>
   <label className="ah-key-embedded-field"><strong>Oma Anthropic API-avain</strong><span className="ah-inline-field">
    <input data-testid="person-key-input" type="password" autoComplete="off" value={value} placeholder="sk-ant-…" onChange={e=>setValue(e.target.value)}/>
    <Button data-testid="person-key-save" size="row" variant="primary" type="submit">Tallenna</Button>
    <Button size="row" variant="quiet" onPress={()=>setEditing(false)}>Peruuta</Button></span></label>
  </form>}
 </div>;
}

// ---------- The page ----------

// Glasspad's sandboxed frame blocks native form submission; hand React the
// submit event directly (as the apple-icloud round).
const submitInSandbox=(e:React.MouseEvent)=>{
 const b=(e.target as HTMLElement).closest('button[type=submit]'),form=b?.closest('form');
 if(!form||(b as HTMLButtonElement).disabled)return;
 e.preventDefault();form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
};

type Tab='aiavain'|'kayttajat';
const adminNav:[Tab|string,string,IconName][]=[['palvelin','Palvelin','server'],['palvelinintegraatiot','Palvelinintegraatiot','plug'],['aiavain','AI-avain','key'],['kayttoonotto','Käyttöönotto','steer'],['kayttajat','Käyttäjät ja pääsy','users'],['levy','Levytila','disk']];
const ownNav:[string,IconName][]=[['Tili','user'],['Laitteet','devices'],['Agentit','agent'],['Yhteydet','link'],['Integraatiot','plug']];
let reviewTheme='light',reviewPhone=false,reviewScenario:Scenario='first',reviewView:'admin'|'person'='admin';

function App({direction}:{direction:number}){
 const [theme,setTheme]=useState(reviewTheme),[phone,setPhone]=useState(reviewPhone);
 const [scenario,setScenario]=useState<Scenario>(reviewScenario),[view,setView]=useState(reviewView);
 const [siteKey,setSiteKey]=useState<SiteKey|undefined>(scenarios[reviewScenario].key);
 const [history,setHistory]=useState<string[]>(scenarios[reviewScenario].history);
 const [ps,setPs]=useState<Person[]>(()=>people(reviewScenario));
 const latest=useRef(ps);latest.current=ps;
 const [tab,setTab]=useState<Tab>(direction===ROW?'kayttajat':'aiavain');
 const [giving,setGiving]=useState<Person[]|null>(null),[removing,setRemoving]=useState(false);
 const [notice,setNotice]=useState<React.ReactNode>(null);
 const reset=(s:Scenario)=>{reviewScenario=s;setScenario(s);setSiteKey(scenarios[s].key);setHistory(scenarios[s].history);setPs(people(s));setNotice(null);setGiving(null);};
 // Dialogs render in a portal outside the review frame: the theme goes on the root.
 useEffect(()=>{document.documentElement.dataset.theme=theme;},[theme]);
 const aino=ps.find(p=>p.entry.id==='1002')!;
 const holders=ps.filter(p=>p.given&&joined(p));
 const oldHolders=siteKey?holders.filter(p=>p.given!.suffix!==siteKey.suffix):[];
 const patch=(id:string,f:(p:Person)=>Person)=>setPs(xs=>xs.map(p=>p.entry.id===id?f(p):p));
 const check=async(p:Person)=>{await wait(350+Number(p.entry.id.slice(-1))*60);return siteKey?checkOf(latest.current.find(x=>x.entry.id===p.entry.id)!.truth,siteKey):'unknown' as Check;};
 // The write re-decides under the person's Pi lock; it never trusts the check.
 const write=async(ids:string[])=>{await wait(500);const out:Record<string,Outcome>={};
  const next=latest.current.map(p=>{if(!ids.includes(p.entry.id)||!siteKey)return p;const c=checkOf(p.truth,siteKey);
   out[p.entry.id]=c==='absent'?'written':c==='earlier'?'replaced':c==='unknown'?'failed':'kept';
   return writable(c)?{...p,truth:{kind:'site',suffix:siteKey.suffix} as Truth,given:{suffix:siteKey.suffix,at:TODAY}}:p;});
  setPs(next);return out;};
 const openGive=(targets:Person[])=>{setNotice(null);setGiving(targets);};
 const actions={
  set:async(provider:SiteKey['provider'],key:string)=>{await wait(200);const next={provider,suffix:key.slice(-4),set_at:TODAY};
   const had=siteKey;setSiteKey(next);setHistory(h=>[...h,next.suffix]);
   const old=ps.filter(p=>p.given&&joined(p)&&p.given.suffix!==next.suffix);
   setNotice(had&&old.length?<span data-testid="replaced-notice">Avain vaihdettu. Aiempi avain annettiin {old.length} henkilölle: {list(old.map(at))}. Heidän kopionsa jäävät ennalleen, kunnes annat heille uuden.</span>
    :<span data-testid="set-notice">Avain otettu käyttöön. Uudet henkilöt saavat siitä kopion. {joinedCount} jo liittynyttä eivät saa sitä itsestään.</span>);
   return true;},
  remove:async()=>true,
 };
 const joinedCount=ps.filter(joined).length;
 const accessView:AccessView={schema_version:1,mode:'allowlist',runtime_admission:true,entries:ps.map(p=>p.entry)};
 const goUsers=<Button size="row" variant="secondary" data-testid="go-users" onPress={()=>setTab('kayttajat')}>Käyttäjät ja pääsy</Button>;
 const giveOld=oldHolders.length>0&&(hasPage(direction)
  ?<Button size="row" variant="secondary" data-testid="give-old" onPress={()=>openGive(oldHolders)}>Anna uusi avain heille…</Button>:goUsers);

 const aiPage=<div className="s-card sk-page" data-testid="site-key-page">
  <p className="sk-terms" data-testid="site-key-terms">Uusi henkilö saa avaimesta kopion omiin tunnuksiinsa, jos hänellä ei ole omaa, eikä näe AI-vaihetta. Käyttö laskutetaan avaimen tililtä. Jaettua kopiota ei voi perua.{direction===ROW&&' Jo liittyneelle annat avaimen hänen rivillään Käyttäjät ja pääsy -sivulla.'}</p>
  <div onClickCapture={submitInSandbox}><SiteKeyEditor key={siteKey?siteKey.suffix:'new'} siteKey={siteKey} actions={actions} disabled={false} onCancel={()=>{}} onRemove={()=>setRemoving(true)}/></div>
  {notice&&<p role="status" className="sk-notice" data-testid="notice"><Icon name="info"/><span>{notice}{giveOld&&<> {giveOld}</>}{!giveOld&&direction===ROW&&siteKey&&<> {goUsers}</>}</span></p>}
  {!notice&&oldHolders.length>0&&<p className="sk-notice" data-testid="old-copies"><Icon name="warning"/><span>Sivuston aiemman avaimen kopio on {oldHolders.length} henkilöllä: {list(oldHolders.map(at))}. {giveOld}</span></p>}
 </div>;

 // Jo liittyneet: the site's own record of what it gave, and the giving act.
 const joinedCard=hasPage(direction)&&<div className="s-card sk-joined" data-testid="joined-card">
  <div className="s-row"><div className="s-lbl"><strong>Jo liittyneet</strong><span className="s-desc">Henkilöt, jotka liittyivät ennen avainta tai saivat aiemman avaimen. Lista kertoo, mitä sivusto on antanut. Mitä heidän Pi:llään nyt on, tarkistetaan vasta antaessa.</span></div>
   <div className="s-val"><Button data-testid="give-all" size="row" variant="primary" isDisabled={!siteKey} onPress={()=>openGive(ps.filter(joined))}>Anna avain liittyneille…</Button></div></div>
  <ul className="sk-given" data-testid="given-list">{ps.filter(joined).map(p=><li key={p.entry.id} data-testid={`given-${p.entry.login_hint}`}>
   <span><strong>{at(p)}</strong> <span className="sk-muted">{p.name}</span></span>
   <span className="sk-muted">{p.given?<>Annettu {day(p.given.at)} {p.given.suffix===siteKey?.suffix?'':<span className="sk-old">(aiempi avain …{p.given.suffix})</span>}</>:'Ei annettu'}</span>
  </li>)}</ul>
  <p className="s-row sk-muted">{ps.filter(p=>p.entry.state==='allowed').length} sallittua ei ole vielä kirjautunut; he saavat avaimen ensimmäisellä kirjautumisella. Poistetut eivät ole mukana.{!siteKey&&' Aseta avain ensin.'}</p>
 </div>;

 const usersPage=<div className="s-card"><ServerAccess view={accessView} lookup={async()=>({kind:'unavailable'})} onAdd={()=>{}} onRemove={()=>{}} onRefresh={()=>{}}
  aiKey={{given:e=>ps.find(p=>p.entry.id===e.id)?.given?.at,onOpen:hasRow(direction)&&siteKey?e=>openGive([ps.find(p=>p.entry.id===e.id)!]):undefined}}/></div>;

 const adminMain=<>
  <p className="muted mobilecrumb">Asetukset › {tab==='aiavain'?'AI-avain':'Käyttäjät ja pääsy'}</p>
  <h2>{tab==='aiavain'?'AI-avain':'Käyttäjät ja pääsy'}</h2>
  <div className="mobiletabs"><Segmented label="Sivu" size="row" value={tab} onChange={setTab} options={[{id:'aiavain',label:'AI-avain'},{id:'kayttajat',label:'Käyttäjät ja pääsy'}]}/></div>
  {tab==='aiavain'?<div className="sk-stack">{aiPage}{joinedCard}</div>:usersPage}
 </>;
 const personMain=<>
  <p className="muted mobilecrumb">Asetukset › Yhteydet</p><h2>Yhteydet</h2>
  <div className="s-card" data-testid="person-view" onClickCapture={submitInSandbox}>
   <div className="s-row"><div className="s-lbl"><strong>GitHub</strong><span className="s-desc">Kirjautunut palvelimella.</span></div><div className="s-val"><code>aino-v</code><StatusMark tone="success" kind="success" label="Yhdistetty"/></div></div>
   <PersonKey p={aino} siteKey={siteKey} history={history} onOwn={()=>patch('1002',p=>({...p,truth:{kind:'own'},given:p.given}))} onRemove={()=>patch('1002',p=>({...p,truth:{kind:'none'}}))}/>
  </div>
  <p className="muted">Ainon oma näkymä. Kokeile: anna avain ylläpitäjänä, katso tämä, vaihda omaan avaimeen ja anna avain uudelleen: oma avain ei korvaudu.</p>
 </>;
 return <div data-theme={theme} className={phone?'review phone':'review'}>
  <header className="reviewbar"><strong>Sivuston AI-avain jo liittyneille</strong><label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label><label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);}}/> 390 px</label><p>Synteettiset henkilöt ja avaimet. Mitään ei lähetetä.</p></header>
  <div className="scenario"><span className="muted">Tilanne</span><Segmented data-testid="scenario" label="Tilanne" size="row" options={(Object.keys(scenarios) as Scenario[]).map(s=>({id:s,label:scenarios[s].label}))} value={scenario} onChange={reset}/>
   <Segmented data-testid="view" label="Näkymä" size="row" options={[{id:'admin',label:'Ylläpitäjä'},{id:'person',label:'Henkilö: @aino-v'}]} value={view} onChange={v=>{reviewView=v;setView(v);}}/>
   <span className="muted" data-testid="scenario-hint">{scenarios[scenario].hint}</span></div>
  <p className="axis">Missä ylläpitäjä antaa avaimen jo liittyneelle: henkilön rivillä, AI-avain-sivulla monelle kerralla, vai molemmissa samalla dialogilla. Suositus: AI-avain-sivulla.</p>
  <div className={`shell variant-${direction}`}><div className="hostbar"><strong>Open Habitat</strong><span>{view==='admin'?'Kaisa Admin · ylläpitäjä':'Aino Virtanen'}</span><Icon name="user"/></div>
   <section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>
    {ownNav.map(([n,i])=><span className="s-nav-i" key={n} aria-current={view==='person'&&n==='Yhteydet'?'page':undefined}><Icon name={i}/>{n}</span>)}
    {view==='admin'&&<><span className="s-nav-h">Palvelimen ylläpito</span>{adminNav.map(([id,n,i])=>id==='aiavain'||id==='kayttajat'
     ?<button type="button" className="s-nav-i" key={id} data-testid={`nav-${id}`} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id as Tab)}><Icon name={i}/>{n}</button>
     :<span className="s-nav-i" key={id}><Icon name={i}/>{n}</span>)}</>}
   </nav>
    <main className="s-main">{view==='admin'?adminMain:personMain}</main></section></div>
  {giving&&siteKey&&<GiveDialog targets={giving} siteKey={siteKey} theme={theme} check={check} write={write} onClose={()=>setGiving(null)}/>}
  {removing&&siteKey&&<RemoveKey siteKey={siteKey} holders={holders} theme={theme} onClose={()=>setRemoving(false)} onConfirm={()=>{setRemoving(false);setSiteKey(undefined);setNotice(<span data-testid="removed-notice">Avain poistettu. Uudet henkilöt valitsevat AI-tilin itse.{holders.length?` ${holders.length} annettua kopiota jäi.`:''}</span>);}}/>}
 </div>;
}
const root=createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink={set innerHTML(view:React.ReactNode){flushSync(()=>root.render(view===''?null:view));}};
const variants=directions.map((_,direction)=>()=> <App key={direction} direction={direction}/>);
const picker=document.createElement('nav');
picker.className='proto-picker';picker.setAttribute('aria-label','Prototype variants');
picker.innerHTML='<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n,i)=>{const button=document.createElement('button');button.className='proto-picker-item';button.textContent=n.replaceAll(' ',' ').replaceAll('-','\u2011');if(i===0){button.setAttribute('data-active','');button.setAttribute('aria-current','true');}picker.append(button);});
document.body.append(picker);
new Function('stage','variants',pickerSource)(stageSink,variants);
