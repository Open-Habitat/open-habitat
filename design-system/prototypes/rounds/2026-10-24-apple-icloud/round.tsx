import React, {useEffect, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, ExternalLink, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon, type IconName} from '../../../../web/src/components/Icon';
import {Checkbox, TextField} from '../../../../web/src/components/Primitives';
import {AccountCard, AgentWarning, ConnectDialog, type ConnectStage, ProviderMark, RemoveDialog, providerCopy} from '../../../../web/src/components/Integrations';
import type {Account, PasswordAccount, Provider, ProviderId} from '../../../../web/src/app/integrations';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/Integrations.css';
import './round.css';

// An Apple (iCloud) integration in Asetukset › Integraatiot: one Apple ID and
// one app-specific password for iCloud Mail (IMAP/SMTP), Calendar (CalDAV)
// and Contacts (CardDAV). The guide is a stepper ("Vaiheittain", round
// 2026-10-24-palvelin-integraatiot-3). The axis is how much one Apple
// connection bundles: all three at once, the person's choice, or a guide that
// fills the generic IMAP/CalDAV/CardDAV cards. Apple's steps and server
// settings are cited in the issue's result.md. Everything is synthetic.
const directions=['Kaikki kerralla','Valitse palvelut','Yleiset kortit'];

// ---------- What Apple and the daemon need ----------

type Svc='mail'|'calendar'|'contacts';
const SVCS:Svc[]=['mail','calendar','contacts'];
const svcName:Record<Svc,string>={mail:'iCloud Mail',calendar:'iCloud-kalenteri',contacts:'iCloud-yhteystiedot'};
const svcShort:Record<Svc,string>={mail:'posti',calendar:'kalenteri',contacts:'yhteystiedot'};
const svcIcon:Record<Svc,IconName>={mail:'mail',calendar:'calendar',contacts:'contacts'};
const svcProvider:Record<Svc,ProviderId>={mail:'imap',calendar:'caldav',contacts:'carddav'};
// The addresses a person can know; DAV discovery finds the partition host.
const FRONT:Record<Svc,string>={mail:'imap.mail.me.com',calendar:'caldav.icloud.com',contacts:'contacts.icloud.com'};
const ICLOUD=/^[a-z0-9._%+-]{1,64}@(icloud|me|mac)\.com$/;
const EMAIL=/^[a-z0-9._%+-]{1,64}@[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/;
// What Apple's page shows. A hint and a warning, never a blocking rule.
const APP_PW=/^[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}$/;
const APPLE_PAGE='https://account.apple.com';
const list=(xs:string[])=>xs.length<2?xs.join(''):xs.slice(0,-1).join(', ')+' ja '+xs[xs.length-1];

type Conn={state:'ok'|'credentials_rejected';host:string;user:string;smtp?:string};
type Apple={appleId:string;svc:Partial<Record<Svc,Conn>>};
const AT='2026-10-24T09:41:00Z';

/** The synthetic Apple: an app-specific-looking password works, anything
 * else is refused for all three; mail needs an iCloud address. */
function connect(appleId:string,mailAddr:string,pw:string,wanted:Svc[]):{rejected:true}|{ok:Partial<Record<Svc,Conn>>;failed:Partial<Record<Svc,string>>}{
 if(!APP_PW.test(pw.trim().toLowerCase()))return {rejected:true};
 const ok:Partial<Record<Svc,Conn>>={},failed:Partial<Record<Svc,string>>={};
 for(const s of wanted){
  if(s==='mail'){
   const address=ICLOUD.test(appleId)?appleId:mailAddr;
   if(!ICLOUD.test(address)){failed.mail='Ei iCloud Mail -osoitetta. Posti jäi pois.';continue;}
   // Apple: IMAP takes the name part, SMTP the full address.
   ok.mail={state:'ok',host:'imap.mail.me.com',user:address.split('@')[0]!,smtp:address};
  }else ok[s]={state:'ok',host:s==='calendar'?'p42-caldav.icloud.com':'p42-contacts.icloud.com',user:appleId};
 }
 return {ok,failed};
}

// ---------- Synthetic person ----------

type Scenario='fresh'|'contacts'|'revoked';
const ID='aino.virtanen@icloud.com';
const conn=(s:Svc,state:Conn['state']='ok'):Conn=>s==='mail'?{state,host:'imap.mail.me.com',user:'aino.virtanen',smtp:ID}:{state,host:s==='calendar'?'p42-caldav.icloud.com':'p42-contacts.icloud.com',user:ID};
const scenarios:Record<Scenario,{label:string;hint:string;apple:Apple|null}>={
 fresh:{label:'Ei yhdistetty',hint:'Kokeile Apple ID:llä aino.virtanen@icloud.com tai aino@virtanen.example ja salasanalla abcd-efgh-ijkl-mnop; muu salasana hylätään.',apple:null},
 contacts:{label:'Vain yhteystiedot',hint:'Nykyinen CardDAV-liitos contacts.icloud.com, kuten Jarilla nyt.',apple:{appleId:ID,svc:{contacts:conn('contacts')}}},
 revoked:{label:'Salasana mitätöity',hint:'Apple-tilin salasana vaihdettiin, joten Apple mitätöi sovellussalasanan.',apple:{appleId:ID,svc:{mail:conn('mail','credentials_rejected'),calendar:conn('calendar','credentials_rejected'),contacts:conn('contacts','credentials_rejected')}}},
};
const google:Account={provider:'google',address:'aino.virtanen@gmail.com',checked_at:AT,services:[{id:'mail',state:'ok'},{id:'calendar',state:'ok'}]};
const providers:Provider[]=[
 {id:'microsoft',available:false,unavailable_reason:'app_credentials_required',login:'device_code',services:['mail','calendar','contacts','onedrive']},
 {id:'dropbox',available:false,unavailable_reason:'app_credentials_required',login:'pasted_redirect',services:['dropbox']},
 {id:'imap',available:true,login:'app_password',services:['mail']},
 {id:'caldav',available:true,login:'app_password',services:['calendar']},
 {id:'carddav',available:true,login:'app_password',services:['contacts']},
];
const isICloud=(p:ProviderId,a:PasswordAccount)=>p==='imap'?a.server==='imap.mail.me.com':/(^|\.)icloud\.com$/.test(new URL(a.url??'https://x.invalid').hostname);

// ---------- Small shared pieces ----------

function Copy({value,label}:{value:string;label:string}){
 const [done,setDone]=useState(false);
 const copy=async()=>{try{await navigator.clipboard.writeText(value);}catch{/* the value stays selectable */}setDone(true);setTimeout(()=>setDone(false),1400);};
 return <Button size="row" variant="quiet" aria-label={`Kopioi ${label}`} data-testid="copy" onPress={()=>void copy()}><Icon name={done?'check':'copy'} width={14} height={14}/></Button>;
}
const AppleMark=({small}:{small?:boolean})=><span className={`ig-mark ig-tone-3 ap-mark${small?' sm':''}`} aria-hidden="true">iC</span>;
const Status=({c,checking}:{c:Conn;checking?:boolean})=>checking
 ?<span className="ig-st"><span className="ig-spin" aria-hidden="true"/>Tarkistetaan…</span>
 :<span className={`ig-st ${c.state==='ok'?'ok':'bad'}`} data-testid="apple-state" data-state={c.state}><Icon name={c.state==='ok'?'check':'warning'}/>{c.state==='ok'?'Toimii':'Tunnus tai salasana ei kelpaa'}</span>;
const where=(s:Svc,c:Conn)=>s==='mail'?<>Haku <code>{c.host}</code> · {c.user}; lähetys <code>smtp.mail.me.com</code> · {c.smtp}</>:<><code>{c.host}</code>, löytyi osoitteesta <code>{FRONT[s]}</code></>;

// ---------- The guide (stepper), shared by every direction ----------

type Mode={kind:'new';appleId?:string}|{kind:'add';missing:Svc[]}|{kind:'renew';only?:Svc};
type Result={ok:Partial<Record<Svc,Conn>>;failed:Partial<Record<Svc,string>>};
type StepId='choose'|'password'|'enter'|'done';
const stepTitle:Record<StepId,string>={choose:'Palvelut',password:'Sovellussalasana',enter:'Tunnukset',done:'Valmis'};

function Guide({direction,mode,apple,theme,onClose,onSaved}:{direction:number;mode:Mode;apple:Apple|null;theme:string;onClose:()=>void;onSaved:(appleId:string,r:Result,renew:Svc[])=>void}){
 const renew=mode.kind==='renew',add=mode.kind==='add';
 const renewing:Svc[]=renew?(mode.only?[mode.only]:SVCS.filter(s=>apple?.svc[s])):[];
 // Adding services to a bundled Apple card reuses the stored password.
 const steps:StepId[]=add?(direction===1?['choose','enter','done']:['enter','done']):renew?['password','enter','done']:direction===1?['choose','password','enter','done']:['password','enter','done'];
 const [at,setAt]=useState(0),step=steps[at]!;
 const [wanted,setWanted]=useState<Svc[]>(add?mode.missing:SVCS);
 const [appleId,setAppleId]=useState(apple?.appleId??(mode.kind==='new'?mode.appleId??'':''));
 const [mailAddr,setMailAddr]=useState('');
 const [pw,setPw]=useState('');
 const [error,setError]=useState(''),[pending,setPending]=useState(false),[result,setResult]=useState<Result|null>(null);
 const id=appleId.trim().toLowerCase(),idOk=EMAIL.test(id);
 const needsMailAddr=wanted.includes('mail')&&idOk&&!ICLOUD.test(id)&&!renew;
 const mailOk=!needsMailAddr||ICLOUD.test(mailAddr.trim().toLowerCase())||(direction!==1&&mailAddr.trim()==='');
 const ready=(renew||idOk)&&(add||pw.trim()!=='')&&wanted.length>0&&mailOk;
 const looksWrong=pw.trim()!==''&&!APP_PW.test(pw.trim().toLowerCase());
 const title=renew?'Apple: uusi sovellussalasana':add?`Apple: lisää ${list(wanted.map(s=>svcShort[s]))}`:'Yhdistä Apple (iCloud)';
 const submit=()=>{
  if(!ready||pending)return;
  setError('');setPending(true);
  const target=renew?renewing:wanted;
  setTimeout(()=>{
   // A stored password is the one already in the person's tool configs.
   const r=connect(id,mailAddr.trim().toLowerCase(),add?'abcd-efgh-ijkl-mnop':pw,target);
   setPending(false);setPw('');
   if('rejected' in r){setError('Apple ei hyväksynyt Apple ID:tä ja salasanaa. Tarkista, että annoit sovellussalasanan etkä Apple-tilin omaa salasanaa. Mitään ei tallennettu.');return;}
   setResult(r);onSaved(renew?apple!.appleId:id,r,renewing);setAt(steps.indexOf('done'));
  },700);
 };
 const body:Record<StepId,()=>React.ReactNode>={
  choose:()=><>
   <p>Mitä agentit saavat käyttöönsä?</p>
   <div className="ap-choose" data-testid="choose">{(add?mode.missing:SVCS).map(s=><Checkbox key={s} data-testid={`want-${s}`} label={svcName[s]} hint={s==='mail'?' Lukeminen ja luonnokset.':' Lukeminen ja muokkaus.'} checked={wanted.includes(s)} onChange={c=>setWanted(w=>c?SVCS.filter(x=>x===s||w.includes(x)):w.filter(x=>x!==s))}/>)}</div>
   {!add&&<AgentWarning/>}
  </>,
  password:()=><>
   {!renew&&direction!==1&&<p className="ap-gets" data-testid="gets">Agentit saavat käyttöönsä iCloud Mailin, kalenterin ja yhteystiedot.</p>}
   {renew&&<p data-testid="renew-why">Apple mitätöi sovellussalasanat, kun Apple-tilin salasana vaihdetaan. Luo uusi; se vaihtuu {renewing.length>1?`kaikkiin: ${list(renewing.map(s=>svcShort[s]))}`:`palveluun ${svcShort[renewing[0]!]}`}.</p>}
   <ol className="ap-how" data-testid="how">
    <li>Kirjaudu: <ExternalLink href={APPLE_PAGE} target="_blank" rel="noreferrer" data-testid="apple-link">account.apple.com <Icon name="external" width={12} height={12}/></ExternalLink></li>
    <li><span className="ap-path">Sign-In and Security › App-Specific Passwords</span></li>
    <li>Generate an app-specific password. Nimeksi <span className="ap-val"><code>Open Habitat</code><Copy value="Open Habitat" label="nimi"/></span></li>
    <li>Kopioi salasana, joka näyttää tältä: <code>abcd-efgh-ijkl-mnop</code></li>
   </ol>
   <p className="warn-line" data-testid="twofa"><Icon name="warning" width={16} height={16}/><span>Vaatii kaksivaiheisen tunnistuksen. Jos vaihdat myöhemmin Apple-tilin salasanan, tämä salasana lakkaa toimimasta.</span></p>
   {!renew&&direction!==1&&<AgentWarning/>}
  </>,
  enter:()=><form className="ig-flow-form" data-testid="enter" onSubmit={e=>{e.preventDefault();submit();}}>
   {renew||add?<p className="ap-fixed" data-testid="apple-id-fixed"><span className="r-k">Apple ID</span> {apple!.appleId}</p>
    :<TextField data-testid="apple-id" label="Apple ID" autoComplete="email" value={appleId} onChange={setAppleId} hint="Sähköpostiosoite, jolla kirjaudut Appleen."/>}
   {needsMailAddr&&<TextField data-testid="mail-address" label={direction===1?'iCloud Mail -osoite':'iCloud Mail -osoite (jos on)'} autoComplete="email" value={mailAddr} onChange={setMailAddr} hint={direction===1?'…@icloud.com, @me.com tai @mac.com. Posti tarvitsee sen.':'…@icloud.com, @me.com tai @mac.com. Tyhjä: posti jää pois.'}/>}
   {add?<p className="r-quiet" data-testid="reuse">Käyttää samaa sovellussalasanaa kuin {list(SVCS.filter(s=>apple?.svc[s]).map(s=>svcShort[s]))}.</p>
    :<label className="s-field ig-password"><span>Sovellussalasana</span><input type="password" data-testid="app-password" autoComplete="new-password" value={pw} maxLength={1024} onChange={e=>setPw(e.target.value)}/></label>}
   {looksWrong&&<p className="r-quiet ap-soft" data-testid="looks-wrong"><Icon name="info" width={14} height={14}/>Ei näytä sovellussalasanalta. Älä anna Apple-tilin omaa salasanaa.</p>}
   {!add&&<p className="r-quiet" data-testid="saved-where">Yhdistää {list((renew?renewing:wanted).map(s=>FRONT[s]))}. Salasana tallentuu vain kotihakemistosi {(renew?renewing:wanted).includes('mail')?'himalaya- ja curl-asetuksiin':'curl-asetuksiin'}.</p>}
   {error&&<p className="ig-err" role="alert" data-testid="error"><Icon name="warning"/><span>{error}</span></p>}
   <button type="submit" hidden/>
  </form>,
  done:()=>result&&<>
   {direction===2&&!renew&&<p data-testid="cards-note">Lisättiin {Object.keys(result.ok).length} korttia: {list(SVCS.filter(s=>result.ok[s]).map(s=>providerCopy[svcProvider[s]].name))}.</p>}
   <ul className="ap-result" data-testid="result">{SVCS.filter(s=>result.ok[s]||result.failed[s]).map(s=><li key={s} data-testid={`result-${s}`} data-ok={result.ok[s]?'':undefined}>
    <span className="ig-ic sm"><Icon name={svcIcon[s]}/></span>
    <div><b>{svcName[s]}</b><span className="ig-meta">{result.ok[s]?where(s,result.ok[s]!):result.failed[s]}</span></div>
    <span className={`ig-st ${result.ok[s]?'ok':'warn'}`}><Icon name={result.ok[s]?'check':'warning'}/>{result.ok[s]?'Toimii':'Ei yhdistetty'}</span>
   </li>)}</ul>
  </>,
 };
 const last=step==='enter',done=step==='done';
 const shown=steps.filter(s=>s!=='done'),n=shown.length;
 return <ModalOverlay className="ah-overlay" isOpen isDismissable={!pending} onOpenChange={o=>!o&&onClose()}><Modal className="ah-modal ig-dlg" data-theme={theme}><Dialog className="ah-dialog ap-dialog" data-testid="guide" data-direction={direction} data-step={step} aria-label={title}>
  <div className="ig-dh"><AppleMark small/><Heading slot="title">{title}</Heading><Button data-testid="dialog-close" size="row" variant="quiet" presentation="icon" aria-label="Sulje" isDisabled={pending} onPress={onClose}><Icon name="cross"/></Button></div>
  {!done&&n>1&&<div className="r-progress" data-testid="progress" aria-label={`Vaihe ${at+1}/${n}`}>{shown.map((x,j)=><span key={x} data-done={j<at||undefined} data-current={j===at||undefined}/>)}</div>}
  <p className="r-stepname" data-testid="stepname">{!done&&n>1&&<span className="muted">{at+1}/{n}</span>} {stepTitle[step]}</p>
  <div className="r-stepbody" data-testid={`step-${step}`}>{body[step]()}</div>
  <div className="dlg-foot">
   {step==='password'&&!renew&&<Button data-testid="skip" size="row" variant="quiet" onPress={()=>setAt(steps.indexOf('enter'))}>Minulla on jo sovellussalasana</Button>}
   <span className="r-grow"/>
   {done?<Button data-testid="finish" size="page" variant="primary" onPress={onClose}>Valmis</Button>:<>
    {at>0?<Button data-testid="back" size="row" variant="secondary" isDisabled={pending} onPress={()=>{setError('');setAt(at-1);}}>Takaisin</Button>:<Button data-testid="cancel" size="row" variant="secondary" onPress={onClose}>Peruuta</Button>}
    {last?<Button data-testid="connect" size="page" variant="primary" isDisabled={!ready||pending} onPress={submit}>{pending?'Yhdistetään…':renew?'Vaihda salasana':'Yhdistä'}</Button>
     :<Button data-testid="next" size="page" variant="primary" isDisabled={step==='choose'&&wanted.length===0} onPress={()=>setAt(at+1)}>Seuraava</Button>}
   </>}
  </div>
 </Dialog></Modal></ModalOverlay>;
}

// ---------- Directions 1 and 2: one Apple card ----------

function AppleCard({apple,direction,checking,onCheck,onRenew,onAdd,onRemove}:{apple:Apple;direction:number;checking:boolean;onCheck:()=>void;onRenew:()=>void;onAdd:()=>void;onRemove:()=>void}){
 const have=SVCS.filter(s=>apple.svc[s]),missing=SVCS.filter(s=>!apple.svc[s]);
 const rejected=have.some(s=>apple.svc[s]!.state!=='ok');
 return <article className="ig-card" data-testid="apple-card" aria-label={`Apple (iCloud) · ${apple.appleId}`}>
  <div className="ig-acc"><AppleMark/><div><span className="ig-rn">Apple (iCloud)</span><span className="ig-meta">{apple.appleId}</span></div>
   {rejected&&<Button data-testid="apple-renew" size="row" variant="primary" onPress={onRenew}>Anna uusi salasana</Button>}
   <Button data-testid="apple-check" size="row" variant="quiet" isDisabled={checking} onPress={onCheck}><Icon name="refresh"/>Tarkista</Button>
   <Button data-testid="apple-remove" size="row" variant="quiet" onPress={onRemove}>Poista…</Button>
  </div>
  {rejected&&!checking&&<p className="ap-why" data-testid="apple-why">Apple mitätöi sovellussalasanat, kun Apple-tilin salasana vaihdetaan. Yksi uusi salasana korjaa kaikki {have.length>1?have.length:''}.</p>}
  {have.map(s=><div className="ig-svc" key={s} data-testid={`apple-svc-${s}`}>
   <span className="ig-ic sm"><Icon name={svcIcon[s]}/></span>
   <div><span className="ig-rn">{svcName[s]}</span><span className="ig-meta">{s==='mail'?<>Agentit hakevat ja lukevat postia ja tekevät luonnoksia komennolla <code>himalaya</code></>:'Agentit käyttävät tätä taidon personal-data kautta'}</span></div>
   <div className="ig-sv"><Status c={apple.svc[s]!} checking={checking}/>{!checking&&<span className="ig-meta">Tarkistettu klo 12.41</span>}</div>
  </div>)}
  {missing.length>0&&<div className="ig-svc ap-missing" data-testid="apple-missing">
   <span className="ig-ic sm"><Icon name="plus"/></span>
   <div><span className="ig-meta">{direction===0?`${list(missing.map(s=>svcName[s]))} ei ole yhdistetty.`:'Muut iCloud-palvelut'}</span></div>
   <Button data-testid="apple-add" size="row" variant="secondary" onPress={onAdd}>{direction===0?'Yhdistä samalla salasanalla…':'Lisää palvelu…'}</Button>
  </div>}
 </article>;
}

function AppleRemove({apple,theme,onClose,onConfirm}:{apple:Apple;theme:string;onClose:()=>void;onConfirm:()=>void}){
 const have=SVCS.filter(s=>apple.svc[s]);
 return <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={o=>!o&&onClose()}><Modal className="ah-modal" data-theme={theme}><Dialog className="ah-dialog" role="alertdialog" data-testid="apple-remove-dialog" aria-label={`Poistetaanko ${apple.appleId}?`}>
  <Heading slot="title">Poistetaanko Apple-tili {apple.appleId}?</Heading>
  <p>Agentit eivät enää pääse palveluihin {list(have.map(s=>svcName[s]))}. Kirjautuminen poistetaan tältä palvelimelta. Sovellussalasana pysyy voimassa Applella, kunnes poistat sen: <span className="ap-path">account.apple.com › Sign-In and Security › App-Specific Passwords</span>.</p>
  <div className="ah-dialog-actions"><Button data-testid="cancel" size="page" variant="secondary" autoFocus onPress={onClose}>Peruuta</Button><Button data-testid="apple-remove-confirm" size="page" variant="danger" onPress={onConfirm}>Poista</Button></div>
 </Dialog></Modal></ModalOverlay>;
}

// ---------- The page ----------

// Glasspad's sandboxed frame blocks native form submission, which would leave
// the production form's submit button dead there. Hand React the submit event
// directly instead; offline the result is the same.
const submitInSandbox=(e:React.MouseEvent)=>{
 const b=(e.target as HTMLElement).closest('button[type=submit]'),form=b?.closest('form');
 if(!form||(b as HTMLButtonElement).disabled)return;
 e.preventDefault();form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
};

let reviewTheme='light',reviewPhone=false,reviewScenario:Scenario='fresh';
type Others=Account[];
function App({direction}:{direction:number}){
 const [theme,setTheme]=useState(reviewTheme),[phone,setPhone]=useState(reviewPhone);
 const [scenario,setScenario]=useState<Scenario>(reviewScenario);
 const [apple,setApple]=useState<Apple|null>(scenarios[reviewScenario].apple);
 const [others,setOthers]=useState<Others>([]);
 const [guide,setGuide]=useState<{key:number;mode:Mode}|null>(null);
 const [generic,setGeneric]=useState<{provider:Provider;stage:ConnectStage}|null>(null);
 const [removing,setRemoving]=useState<Account|'apple'|null>(null);
 const [checking,setChecking]=useState<string[]>([]),[notice,setNotice]=useState('');
 useEffect(()=>{setGuide(null);setNotice('');setOthers([]);},[scenario]);
 const open=(mode:Mode)=>{setNotice('');setGuide(g=>({key:(g?.key??0)+1,mode}));};
 const check=(k:string)=>{setChecking(c=>[...c,k]);setTimeout(()=>setChecking(c=>c.filter(x=>x!==k)),700);};
 const saved=(appleId:string,r:Result,renewed:Svc[])=>{
  setApple(a=>({appleId:a?.appleId??appleId,svc:{...(a?.appleId===appleId?a.svc:{}),...r.ok}}));
  const names=SVCS.filter(s=>r.ok[s]).map(s=>svcShort[s]);
  if(names.length)setNotice(renewed.length?`Apple: salasana vaihdettu (${list(names)}).`:`Apple: ${list(names)} yhdistetty.`);
 };
 // A generic connection to an iCloud host joins the Apple card: the grouping
 // is read from the stored server, so no new store is needed.
 const genericSaved=(p:ProviderId,a:PasswordAccount)=>{
  const svc=(Object.keys(svcProvider) as Svc[]).find(s=>svcProvider[s]===p)!;
  if(isICloud(p,a)){
   const c:Conn=svc==='mail'?{state:'ok',host:a.server,user:a.username,smtp:a.smtp_server?a.address:undefined}:conn(svc);
   setApple(x=>({appleId:x?.appleId??a.address,svc:{...x?.svc,[svc]:c}}));
  }else setOthers(o=>[...o,{provider:p,address:a.address,checked_at:AT,services:[{id:svc,state:'ok'}]}]);
  setGeneric(g=>g&&{...g,stage:{stage:'connected',address:a.address}});
 };
 // Direction 3 draws the Apple services as the generic cards they are.
 const appleAccounts:Account[]=apple?SVCS.filter(s=>apple.svc[s]).map(s=>({provider:svcProvider[s],address:s==='mail'?apple.svc.mail!.smtp??apple.appleId:apple.appleId,checked_at:AT,services:[{id:s,state:apple.svc[s]!.state}]})):[];
 const accountSvc=(a:Account):Svc=>(Object.keys(svcProvider) as Svc[]).find(s=>svcProvider[s]===a.provider)!;
 const isApple=(a:Account)=>appleAccounts.some(x=>x.provider===a.provider&&x.address===a.address);
 const cards:Account[]=[google,...(direction===2?appleAccounts:[]),...others];
 const card=(a:Account)=><AccountCard key={`${a.provider}:${a.address}`} account={a} checking={checking.includes(`${a.provider}:${a.address}`)} onCheck={()=>check(`${a.provider}:${a.address}`)}
  onSignInAgain={isApple(a)?()=>open({kind:'renew',only:accountSvc(a)}):undefined} onRemove={()=>setRemoving(a)}/>;
 const appleTile=(!apple||direction===2&&SVCS.some(s=>!apple.svc[s]))&&<div className="ig-tile ap-tile" data-testid="apple-tile">
  <AppleMark/><div><span className="ig-rn">Apple (iCloud)</span><span className="ig-meta">{direction===2&&apple?`Lisää ${list(SVCS.filter(s=>!apple.svc[s]).map(s=>svcShort[s]))} samalla Apple ID:llä`:'iCloud Mail · Kalenteri · Yhteystiedot. Yksi sovellussalasana.'}</span></div>
  <Button data-testid="apple-open" size="row" variant="secondary" onPress={()=>open({kind:'new',appleId:apple?.appleId})}>Yhdistä…</Button>
 </div>;
 const tile=(p:Provider)=><div data-testid={`tile-${p.id}`} className="ig-tile" key={p.id}><ProviderMark provider={p.id}/><div><span className="ig-rn">{providerCopy[p.id].name}</span><span className="ig-meta">{p.available?p.id==='imap'?'Muu postipalvelu':p.id==='caldav'?'Muu kalenteripalvelu':'Muu yhteystietopalvelu':'Odottaa palvelimen ylläpitäjän sovellusasetuksia'}</span></div>
  <Button data-testid={`open-${p.id}`} size="row" variant="secondary" isDisabled={!p.available} onPress={()=>setGeneric({provider:p,stage:{stage:'intro'}})}>Yhdistä…</Button></div>;
 const page=<div className="ig-main">
  <p className="ig-intro">Liitä muiden palvelujen tilisi, niin agenttisi voivat käyttää niiden tiedostoja, postia ja kalentereita.</p>
  <AgentWarning/>
  {notice&&<p role="status" className="ig-notice ap-done" data-testid="notice"><Icon name="check"/><span>{notice}</span></p>}
  <h3 className="ig-h3">Yhdistetyt tilit</h3>
  {cards.slice(0,1).map(card)}
  {apple&&direction!==2&&<AppleCard apple={apple} direction={direction} checking={checking.includes('apple')} onCheck={()=>check('apple')} onRenew={()=>open({kind:'renew'})} onAdd={()=>open({kind:'add',missing:SVCS.filter(s=>!apple.svc[s])})} onRemove={()=>setRemoving('apple')}/>}
  {cards.slice(1).map(card)}
  <h3 className="ig-h3">Lisää tili</h3>
  <div className="ig-tiles" data-testid="tiles">{appleTile}{providers.filter(p=>!p.available).map(tile)}</div>
  <h3 className="ig-h3 ap-h4">Muut palvelut</h3>
  <p className="ig-meta ap-lead">Posti, kalenteri tai yhteystiedot muualta, esimerkiksi Fastmail tai Nextcloud.</p>
  <div className="ig-tiles" data-testid="generic-tiles">{providers.filter(p=>p.available).map(tile)}</div>
 </div>;
 return <div data-theme={theme} className={phone?'review phone':'review'}>
  <header className="reviewbar"><strong>Apple (iCloud) -integraatio</strong><label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label><label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);}}/> 390 px</label><p>Synteettiset tiedot. Ei yhteyttä Appleen.</p></header>
  <div className="scenario"><span className="muted">Esimerkkihenkilö</span><Segmented data-testid="scenario" label="Esimerkkihenkilö" size="row" options={(Object.keys(scenarios) as Scenario[]).map(s=>({id:s,label:scenarios[s].label}))} value={scenario} onChange={s=>{reviewScenario=s;setScenario(s);setApple(scenarios[s].apple);}}/><span className="muted" data-testid="scenario-hint">{scenarios[scenario].hint}</span></div>
  <p className="axis">Kuinka paljon yksi Apple-liitos niputtaa: kaikki kolme kerralla, valitut palvelut, vai ohje joka täyttää yleiset kortit. Suositus: Kaikki kerralla.</p>
  <div className={`shell variant-${direction}`}><div className="hostbar"><strong>Open Habitat</strong><span>Aino Virtanen</span><Icon name="user"/></div>
   <section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>{['Tili','Agentit','Integraatiot','Ulkoasu','Editori'].map(n=><span className="s-nav-i" key={n} aria-current={n==='Integraatiot'?'page':undefined}>{n}</span>)}</nav>
    <main className="s-main"><p className="muted mobilecrumb">Asetukset › Integraatiot</p><h2>Integraatiot</h2>{page}</main></section></div>
  {guide&&<Guide key={guide.key} direction={direction} mode={guide.mode} apple={apple} theme={theme} onClose={()=>setGuide(null)} onSaved={saved}/>}
  {generic&&<div data-theme={theme} onClickCapture={submitInSandbox}><ConnectDialog provider={generic.provider} stage={generic.stage} onContinue={()=>setGeneric(g=>g&&{...g,stage:{stage:'password'}})} onPassword={a=>genericSaved(generic.provider.id,a)} onPaste={()=>{}} onFolders={()=>{}} onRestart={()=>{}} onClose={()=>setGeneric(null)}/></div>}
  {removing==='apple'&&apple&&<AppleRemove apple={apple} theme={theme} onClose={()=>setRemoving(null)} onConfirm={()=>{setApple(null);setRemoving(null);setNotice('Apple-tili poistettu.');}}/>}
  {removing&&removing!=='apple'&&<div data-theme={theme}><RemoveDialog account={removing} onClose={()=>setRemoving(null)} onConfirm={()=>{
   const r=removing;setRemoving(null);
   if(isApple(r)){const s=accountSvc(r);setApple(a=>{if(!a)return a;const svc={...a.svc};delete svc[s];return Object.keys(svc).length?{...a,svc}:null;});}
   else setOthers(o=>o.filter(x=>x!==r));
  }}/></div>}
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
