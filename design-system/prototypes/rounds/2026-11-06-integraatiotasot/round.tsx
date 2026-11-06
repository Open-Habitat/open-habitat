import React, {useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay, Radio, RadioGroup} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon, type IconName} from '../../../../web/src/components/Icon';
import {InlineNotice, StatusMark} from '../../../../web/src/components/Status';
import {Checkbox} from '../../../../web/src/components/Primitives';
import {ProviderMark} from '../../../../web/src/components/Integrations';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/ServerIntegrations.css';
import '../../../../web/src/components/Integrations.css';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// Integration access levels and what each allows (proto-integration-levels).
// Aino and Jari read "Luonnokset, ei lähetystä" as full access without
// sending mail; it is really read-only except mail drafts. The axis is how a
// level is put together and named: today's three levels; four levels with
// a new "everything but sending mail"; a per-service grid; or a read-only base
// with exceptions. What a provider can enforce is the same in every direction
// and comes from its permission model (result.md): Microsoft cannot separate
// calendar editing from invitations or file editing from sharing links, and
// gives every token all of an application's permissions, so each Microsoft
// combination is its own application; Gmail cannot separate any change from
// sending; Dropbox can separate editing from sharing. Everything is synthetic.
const directions=['Nyt','Neljä tasoa','Ruudukko','Pohja ja poikkeukset'];
const LINES=[
 'Nyt: kolme tasoa, joiden nimi on ainoa kuvaus ylläpitäjän listassa; Luonnokset on todellisuudessa vain luku postin luonnoksia lukuun ottamatta.',
 'Neljä tasoa: uusi taso Kaikki paitsi postin lähetys Täyden ja Luonnosten väliin, ja jokaisen tason rivillä lukee, mitä se sallii, mitä ei ja mitä ei voi estää.',
 'Ruudukko: tasot korvataan palveluittaisella ruudukolla Lukee / Muokkaa / Lähettää; solut, joita palvelu ei osaa erottaa, on yhdistetty.',
 'Pohja ja poikkeukset: kaksi tasoa, Vain luku ja Täysi, ja Vain lukuun valittavat poikkeukset palveluittain lauseina.',
];
const NOW=0,FOUR=1,GRID=2,BASE=3;

// ---------- What providers can grant ----------

type Prov='microsoft'|'google'|'dropbox';
type Svc='mail'|'calendar'|'contacts'|'files';
/** read; drafts = mail organised and drafted; edit = changed without
 * sending or sharing; full = changed and sent or shared; app = Dropbox app folder. */
type Ab='read'|'drafts'|'edit'|'full'|'app';
type Combo=Partial<Record<Svc,Ab>>;
const PROVS:Prov[]=['microsoft','google','dropbox'];
const PNAME:Record<Prov,string>={microsoft:'Microsoft 365',google:'Google',dropbox:'Dropbox'};
const SVCS:Record<Prov,Svc[]>={microsoft:['mail','calendar','contacts','files'],google:['mail','calendar','contacts','files'],dropbox:['files']};
const SNAME:Record<Prov,Record<Svc,string>>={
 microsoft:{mail:'Outlook-posti',calendar:'Outlook-kalenteri',contacts:'Yhteystiedot',files:'OneDrive ja SharePoint'},
 google:{mail:'Gmail',calendar:'Google-kalenteri',contacts:'Google-yhteystiedot',files:'Google Drive'},
 dropbox:{mail:'',calendar:'',contacts:'',files:'Dropbox'},
};
const SICON:Record<Svc,IconName>={mail:'mail',calendar:'calendar',contacts:'contacts',files:'folder'};

/** What agents can do with a service at an ability, in plain words: can,
 * cannot, and what the provider does not let us prevent. */
function says(p:Prov,s:Svc,a:Ab):{can:string;cannot?:string;note?:string}{
 if(s==='mail')return a==='read'?{can:'Lukee postia ja liitteitä.',cannot:'Ei siirrä, poista, kirjoita eikä lähetä mitään.'}
  :a==='drafts'?{can:'Lukee, järjestelee, poistaa ja kirjoittaa luonnoksia. Luonnos odottaa Luonnokset-kansiossa, josta lähetät sen itse.',cannot:'Ei lähetä postia.'}
  :{can:'Lukee, järjestelee, kirjoittaa ja lähettää postia nimissäsi.'};
 if(s==='calendar')return a==='read'?{can:'Näkee tapahtumat.',cannot:'Ei luo eikä muuta tapahtumia eikä lähetä kutsuja.'}
  :{can:'Luo, muuttaa ja poistaa tapahtumia.',note:p==='microsoft'?'Jos tapahtumassa on osallistujia, Microsoft lähettää heille aina kutsun tai peruutuksen. Sitä ei voi erottaa muokkauksesta.':'Google lähettää osallistujille kutsun, kun agentti pyytää sitä. Sitä ei voi erottaa muokkauksesta.'};
 if(s==='contacts')return a==='read'?{can:'Näkee yhteystiedot.',cannot:'Ei muuta niitä.'}:{can:'Lisää, muuttaa ja poistaa yhteystietoja. Kenellekään ei lähde mitään.'};
 if(a==='read')return {can:'Lukee tiedostot. Kansio on peili: omat muutokset eivät palaa palveluun.',cannot:'Ei muokkaa, poista eikä jaa.'};
 if(a==='app')return {can:'Muokkaa sovelluksen omaa kansiota molempiin suuntiin.',cannot:'Muu Dropbox ei näy lainkaan.'};
 if(a==='edit')return {can:'Muokkaa, poistaa ja synkronoi molempiin suuntiin.',cannot:'Ei jaa tiedostoja eikä luo linkkejä.'};
 if(p==='dropbox')return {can:'Muokkaa, poistaa, synkronoi ja jakaa tiedostoja linkillä tai kutsulla.'};
 return {can:'Muokkaa, poistaa ja synkronoi molempiin suuntiin.',note:p==='microsoft'?'Voi myös jakaa tiedoston linkillä, jopa kenelle tahansa, jos organisaatiosi sallii. Microsoft ei erota jakamista muokkauksesta.':'Voi myös jakaa tiedoston. Google ei erota jakamista muokkauksesta.'};
}
/** The same as short list items for the administrator's rows. */
function brief(p:Prov,s:Svc,a:Ab):{yes:string[];no:string[];note:string[]}{
 if(s==='mail')return a==='read'?{yes:['postin luku'],no:['postin järjestely ja luonnokset','postin lähetys'],note:[]}
  :a==='drafts'?{yes:['postin luku, järjestely ja luonnokset'],no:['postin lähetys'],note:[]}:{yes:['postin luku, järjestely ja lähetys'],no:[],note:[]};
 if(s==='calendar')return a==='read'?{yes:['kalenterin luku'],no:['tapahtumien luonti ja muutos'],note:[]}:{yes:['tapahtumien luonti ja muutos'],no:[],note:[p==='microsoft'?'osallistujat saavat aina kutsun':'agentti voi lähettää osallistujille kutsun']};
 if(s==='contacts')return a==='read'?{yes:['yhteystietojen luku'],no:['yhteystietojen muutos'],note:[]}:{yes:['yhteystietojen muutos'],no:[],note:[]};
 if(a==='read')return {yes:['tiedostojen luku'],no:['tiedostojen muokkaus ja jakaminen'],note:[]};
 if(a==='app')return {yes:['sovelluskansion muokkaus'],no:['muu Dropbox'],note:[]};
 if(a==='edit')return {yes:['tiedostojen muokkaus'],no:['jakaminen ja linkit'],note:[]};
 return p==='dropbox'?{yes:['tiedostojen muokkaus ja jakaminen'],no:[],note:[]}:{yes:['tiedostojen muokkaus'],no:[],note:[p==='microsoft'?'tiedostolle voi luoda jakolinkin':'tiedoston voi jakaa']};
}
const merge=(p:Prov,c:Combo)=>{const out={yes:[] as string[],no:[] as string[],note:[] as string[]};
 for(const s of SVCS[p]){const b=brief(p,s,c[s]??'read');out.yes.push(...b.yes);out.no.push(...b.no);out.note.push(...b.note);}return out;};

// ---------- Levels in each direction ----------

type LevelId='full'|'nosend'|'drafts'|'read'|'app'|'gnomail';
type Level={id:LevelId;name:string;sum:string;combo:Combo;
 /** Microsoft and Dropbox App folder: its own application, so its own credentials. */
 ownApp:boolean;notOffered?:string};
const ALL=(a:Ab):Combo=>({mail:a,calendar:a,contacts:a==='full'?'edit':a,files:a});
const C={
 full:{mail:'full',calendar:'full',contacts:'edit',files:'full'} as Combo,
 nosend:{mail:'drafts',calendar:'full',contacts:'edit',files:'full'} as Combo,
 drafts:{mail:'drafts',calendar:'read',contacts:'read',files:'read'} as Combo,
 read:ALL('read'),
 gnomail:{mail:'read',calendar:'full',contacts:'edit',files:'full'} as Combo,
};
const GMAIL_NO='Gmailissa jokainen muutosoikeus antaa myös lähetysoikeuden, joten postia ei voi muuttaa ilman lähetystä.';
function levels(d:number,p:Prov):Level[]{
 if(p==='dropbox'){
  const ls:Level[]=[{id:'full',name:'Koko Dropbox',sum:'Agentit voivat lukea, muokata, poistaa ja jakaa kaikkia tiedostojasi.',combo:{files:'full'},ownApp:false}];
  if(d===FOUR)ls.push({id:'nosend',name:'Kaikki paitsi jakaminen',sum:'Agentit muokkaavat ja poistavat tiedostojasi, mutta eivät jaa niitä kenellekään eivätkä luo linkkejä.',combo:{files:'edit'},ownApp:false});
  ls.push({id:'app',name:'Vain sovelluskansio',sum:'Agentit näkevät vain sovelluksen oman kansion Dropboxin Apps-kansiossa. Muu Dropboxisi ei näy niille lainkaan.',combo:{files:'app'},ownApp:true});
  ls.push({id:'read',name:'Vain luku',sum:'Agentit lukevat kaikkia tiedostojasi, mutta eivät muuta, poista tai jaa niitä.',combo:{files:'read'},ownApp:false});
  return ls;
 }
 const ms=p==='microsoft';
 const full:Level={id:'full',name:'Täysi',sum:'Agentit voivat lukea, muokata ja lähettää sinun nimissäsi.',combo:C.full,ownApp:ms};
 const read:Level={id:'read',name:'Vain luku',sum:ms?'Agentit lukevat postia, kalenteria, yhteystietoja ja tiedostoja, mutta eivät muuta mitään.':'Agentit lukevat Gmailia, kalenteria, yhteystietoja ja Drivea, mutta eivät muuta mitään.',combo:C.read,ownApp:ms};
 if(d===NOW)return [full,{id:'drafts',name:'Luonnokset, ei lähetystä',sum:'Agentit lukevat ja kirjoittavat postiluonnoksia. Tililtä ei lähde mitään: ei postia, kalenterikutsuja eikä jakolinkkejä.',combo:C.drafts,ownApp:ms,notOffered:ms?undefined:'Google ei tarjoa tätä tasoa. Gmailin luonnosoikeus antaa aina myös lähetysoikeuden, joten pelkkiä luonnoksia ei voi myöntää.'},read];
 const nosend:Level=ms?{id:'nosend',name:'Kaikki paitsi postin lähetys',sum:'Agentit tekevät kaiken, mitä Täysi sallii, mutta posti jää luonnoksiksi, jotka lähetät itse.',combo:C.nosend,ownApp:true}
  :{id:'gnomail',name:'Kaikki paitsi Gmailin muutokset',sum:'Agentit muokkaavat kalenteria, yhteystietoja ja Drivea, mutta Gmail on vain luettavissa.',combo:C.gnomail,ownApp:false};
 const drafts:Level={id:'drafts',name:ms?'Luonnokset, muu vain luku':'Luonnokset, muu vain luku',sum:'Agentit kirjoittavat postiluonnoksia ja lukevat kaikkea muuta. Tililtä ei lähde mitään: ei postia, kutsuja eikä jakolinkkejä.',combo:C.drafts,ownApp:ms,notOffered:ms?undefined:GMAIL_NO};
 return [full,nosend,drafts,read];
}
const sameCombo=(p:Prov,a:Combo,b:Combo)=>SVCS[p].every(s=>(a[s]??'read')===(b[s]??'read'));

// ---------- The server's state ----------

/** Which Microsoft applications the administrator has set: the full one
 * and the read one; drafts and the new level not yet (Jari's screenshot had
 * none, which would leave the person nothing to choose). */
type Apps=Record<string,boolean>;
const initialApps:Apps={'microsoft:full':true,'microsoft:read':true,'microsoft:drafts':false,'microsoft:nosend':false,'dropbox:full':true,'dropbox:app':false,'google:full':true};
const available=(apps:Apps,p:Prov,l:Level)=>!l.notOffered&&(p==='google'?apps['google:full']:p==='dropbox'?(l.ownApp?apps['dropbox:app']:apps['dropbox:full']):!!apps[`microsoft:${l.id}`]);

// ---------- Small pieces ----------

function YesNo({p,combo,compact}:{p:Prov;combo:Combo;compact?:boolean}){
 const m=merge(p,combo);
 return <ul className={`il-yn${compact?' compact':''}`} data-testid="level-yesno">
  {m.yes.length>0&&<li className="yes"><Icon name="check"/><span><b>Sallii:</b> {m.yes.join(' · ')}</span></li>}
  {m.no.length>0&&<li className="no"><Icon name="cross"/><span><b>Ei salli:</b> {m.no.join(' · ')}</span></li>}
  {m.note.length>0&&<li className="note"><Icon name="warning"/><span><b>Ei voi estää:</b> {m.note.join(' · ')}</span></li>}
 </ul>;
}
function ServiceLines({p,combo}:{p:Prov;combo:Combo}){
 return <ul className="il-svc">{SVCS[p].map(s=>{const x=says(p,s,combo[s]??'read');return <li key={s} data-testid={`svc-${s}`}>
  <span className="il-svc-name"><Icon name={SICON[s]}/>{SNAME[p][s]}</span>
  <span className="il-svc-text">{x.can}{x.cannot&&<> <span className="il-no">{x.cannot}</span></>}{x.note&&<span className="il-note"><Icon name="warning"/>{x.note}</span>}</span>
 </li>;})}</ul>;
}

// The grid's columns: which abilities a provider can separate. A merged
// cell is two steps the provider grants only together.
type Col='read'|'edit'|'send';
const COLS:[Col,string][]=[['read','Lukee'],['edit','Muokkaa'],['send','Lähettää tai jakaa']];
type Cell={cols:Col[];ab:Ab;label:string}|null;
function cells(p:Prov,s:Svc):Cell[]{
 const r:Cell={cols:['read'],ab:'read',label:'Lukee'};
 if(s==='mail')return p==='microsoft'?[r,{cols:['edit'],ab:'drafts',label:'Järjestelee ja luonnostelee'},{cols:['send'],ab:'full',label:'Lähettää'}]
  :[r,{cols:['edit','send'],ab:'full',label:'Muuttaa ja lähettää'}];
 if(s==='calendar')return [r,{cols:['edit','send'],ab:'full',label:p==='microsoft'?'Muokkaa; osallistujat saavat aina kutsun':'Muokkaa ja voi lähettää kutsuja'}];
 if(s==='contacts')return [r,{cols:['edit'],ab:'edit',label:'Muokkaa'},null];
 if(p==='dropbox')return [r,{cols:['edit'],ab:'edit',label:'Muokkaa'},{cols:['send'],ab:'full',label:'Jakaa'}];
 return [r,{cols:['edit','send'],ab:'full',label:'Muokkaa ja voi jakaa linkillä'}];
}
const rank:Record<Ab,number>={read:0,drafts:1,edit:1,app:1,full:2};
function cellOn(c:Cell,a:Ab){if(!c)return false;return rank[a]>=rank[c.ab];}

function Grid({p,combo,onChange,testid}:{p:Prov;combo:Combo;onChange?:(s:Svc,a:Ab)=>void;testid:string}){
 return <div className={`il-grid${onChange?' edit':''}`} role={onChange?undefined:'table'} data-testid={testid}>
  <div className="il-grid-head" role="row"><span role="columnheader">Palvelu</span>{COLS.map(([c,l])=><span key={c} role="columnheader">{l}</span>)}</div>
  {SVCS[p].map(s=>{const cur=combo[s]??'read';return <div className="il-grid-row" role="row" key={s} data-testid={`grid-${s}`}>
   <span className="il-grid-svc" role="rowheader"><Icon name={SICON[s]}/>{SNAME[p][s]}</span>
   {cells(p,s).map((c,i)=>c===null?<span key={i} className="il-cell none" role="cell">ei lähetettävää</span>
    :<span key={i} role="cell" className={`il-cell${c.cols.length>1?' merged':''}${cellOn(c,cur)?' on':''}${cur===c.ab?' cur':''}`} style={{gridColumn:c.cols.length>1?'span 2':undefined}}>
     {onChange?<button type="button" data-testid={`cell-${s}-${c.ab}`} aria-pressed={cur===c.ab} onClick={()=>onChange(s,c.ab)}><Icon name={cellOn(c,cur)?'check':'slash'}/>{c.label}</button>
      :<><Icon name={cellOn(c,cur)?'check':'slash'}/>{c.label}</>}
    </span>)}
  </div>;})}
 </div>;
}

// ---------- Administrator: Palvelinintegraatiot ----------

function SetDialog({theme,p,level,d,onClose,onSet}:{theme:string;p:Prov;level:Level;d:number;onClose:()=>void;onSet:()=>void}){
 return <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={o=>!o&&onClose()}>
  <Modal className="ah-modal il-dialog" data-theme={theme}><Dialog className="ah-dialog" data-testid="set-dialog" aria-label="Aseta tunnukset">
   <Heading slot="title" className="il-dh">Aseta tunnukset: {PNAME[p]}, taso {level.name}</Heading>
   {d===NOW?<p className="muted">Tasolle tarvitaan oma {PNAME[p]}-sovellus.</p>:<>
    <p>Tällä tasolla yhdistetyt tilit saavat palveluittain:</p>
    {d===GRID?<Grid p={p} combo={level.combo} testid="set-grid"/>:<ServiceLines p={p} combo={level.combo}/>}
    <p className="muted">Microsoft antaa jokaiselle sovelluksen kirjautumiselle kaikki sovellukselle hyväksytyt oikeudet, joten taso on raja vain omana sovelluksenaan. Sovelluksen luonti on ohjatun asetuksen oma prototyyppi.</p></>}
   <div className="ah-dialog-actions"><Button size="page" variant="secondary" onPress={onClose}>Peruuta</Button>
    <Button data-testid="set-confirm" size="page" variant="primary" onPress={onSet}>Merkitse asetetuksi</Button></div>
  </Dialog></Modal></ModalOverlay>;
}

function LevelRowState({on,testid,onSet,shared}:{on:boolean;testid:string;onSet?:()=>void;shared?:string}){
 return <>
  <span className="si-state">{shared?<span className="muted">{shared}</span>:on?<StatusMark kind="success" tone="success" label="Tarjolla"/>:<StatusMark label="Ei käytössä"/>}</span>
  <span className="si-act">{!shared&&!on&&onSet&&<Button data-testid={`set-${testid}`} size="row" variant="secondary" onPress={onSet}>Aseta tunnukset…</Button>}
   {!shared&&on&&<Button size="row" variant="quiet">Tunnukset</Button>}</span>
 </>;
}

function AdminList({d,apps,onSet}:{d:number;apps:Apps;onSet:(p:Prov,l:Level)=>void}){
 const rows:React.ReactNode[]=[];
 for(const p of PROVS){
  const ls=levels(d,p).filter(l=>!l.notOffered);
  const mainOn=p==='microsoft'?apps['microsoft:full']:apps[`${p}:full`];
  // Today the provider's row is the full application, unnamed as a level.
  rows.push(<li key={p} className="si-row" data-testid={`row-${p}`}><ProviderMark provider={p} small/>
   <span className="si-main"><span className="si-name">{PNAME[p]}</span>
    {d!==NOW&&p!=='microsoft'&&<span className="muted il-provnote">{p==='google'?'Yksi sovellus kaikille tasoille: Google kysyy kirjautuessa vain tason oikeudet.':'Koko Dropbox -sovellus kattaa tasot, joilla ei ole omaa riviä.'}</span>}
   </span>
   <span className="si-state">{mainOn?<StatusMark kind="success" tone="success" label="Tarjolla"/>:<StatusMark tone="warning" label="Ei tarjolla"/>}</span>
   <span className="si-act"><Button size="row" variant="quiet">Tunnukset</Button></span></li>);
  if(d===NOW){
   for(const l of ls.filter(l=>l.ownApp&&l.id!=='full'))rows.push(<li key={p+l.id} className="si-row si-level" data-testid={`level-${p}-${l.id}`}>
    <span className="si-level-indent" aria-hidden="true"/><span className="si-main"><span className="si-name">Taso: {l.name}</span></span>
    <LevelRowState on={available(apps,p,l)} testid={`${p}-${l.id}`} onSet={()=>onSet(p,l)}/></li>);
   continue;
  }
  if(d===GRID){
   rows.push(<li key={p+'grid'} className="si-row si-level il-gridrow" data-testid={`gridlist-${p}`}>
    <span className="si-level-indent" aria-hidden="true"/>
    <div className="il-combos">
     {p!=='microsoft'&&<p className="muted">Henkilöt valitsevat oikeudet palveluittain. Mahdolliset yhdistelmät:</p>}
     {p!=='microsoft'?<Grid p={p} combo={p==='dropbox'?{files:'full'}:C.full} testid={`cap-${p}`}/>
      :ls.map(l=><div className="il-combo" key={l.id} data-testid={`level-${p}-${l.id}`}>
       <div className="il-combo-head"><span className="si-name">{l.name}</span><LevelRowState on={available(apps,p,l)} testid={`${p}-${l.id}`} onSet={()=>onSet(p,l)}/></div>
       <Grid p={p} combo={l.combo} testid={`combo-${l.id}`}/></div>)}
     {p==='microsoft'&&<p className="muted">Microsoftilla jokainen yhdistelmä on oma sovelluksensa. Henkilö voi valita vain yhdistelmän, jolle on tunnukset.</p>}
    </div></li>);
   continue;
  }
  // FOUR lists every level with what it allows; BASE nests the exceptions under Vain luku.
  const show=d===BASE?ls.filter(l=>l.id==='full'||l.id==='read').concat(ls.filter(l=>l.id!=='full'&&l.id!=='read')):ls;
  for(const l of show){
   const exc=d===BASE&&l.id!=='full'&&l.id!=='read';
   const name=d===BASE?(l.id==='full'?'Pohja: Täysi':l.id==='read'?'Pohja: Vain luku':baseName(p,l.combo)):`Taso: ${l.name}`;
   const shared=!l.ownApp?(p==='dropbox'&&l.id!=='app'?'Koko Dropbox -sovelluksella':p==='google'?'Google-sovelluksella':undefined):(p==='microsoft'&&l.id==='full'?'Yllä oleva sovellus':undefined);
   rows.push(<li key={p+l.id} className={`si-row si-level il-described${exc?' il-exc':''}`} data-testid={`level-${p}-${l.id}`}>
    <span className="si-level-indent" aria-hidden="true"/>
    <span className="si-main il-main"><span className="si-name">{name}</span>
     {d===BASE?<span className="il-sentence" data-testid="level-sentence">{sentence(p,l.combo)}</span>:<YesNo p={p} combo={l.combo} compact/>}
    </span>
    <LevelRowState on={available(apps,p,l)} testid={`${p}-${l.id}`} onSet={()=>onSet(p,l)} shared={shared}/></li>);
  }
 }
 return <div className="s-card si"><ul className="si-rows" data-testid="admin-list">{rows}</ul></div>;
}

/** "Vain luku + posti luonnoksina, kalenteri muokattavissa" */
const EXC:Record<Svc,Partial<Record<Ab,string>>>={
 mail:{drafts:'posti luonnoksina',full:'postin lähetys'},
 calendar:{full:'kalenteri muokattavissa'},
 contacts:{edit:'yhteystiedot muokattavissa'},
 files:{edit:'tiedostot muokattavissa',full:'tiedostot muokattavissa',app:'sovelluskansio'},
};
const excList=(p:Prov,c:Combo)=>SVCS[p].flatMap(s=>{const a=c[s]??'read';return a==='read'?[]:[EXC[s][a]??''];});
const baseName=(p:Prov,c:Combo)=>`Vain luku + ${excList(p,c).join(', ')}`;
function sentence(p:Prov,c:Combo){
 const ex=excList(p,c);
 if(sameCombo(p,c,p==='dropbox'?{files:'full'}:C.full))return 'Agentit lukevat, muokkaavat, lähettävät ja jakavat nimissäsi.';
 if(!ex.length)return 'Agentit lukevat kaiken, mutta eivät muuta, lähetä eivätkä jaa mitään.';
 const m=merge(p,c);
 return `Agentit lukevat kaiken. Lisäksi: ${ex.join(', ')}.${m.no.length?` Ei: ${m.no.filter(x=>x!=='postin järjestely ja luonnokset').join(', ')}.`:''}${m.note.length?` Ei voi estää: ${m.note.join(', ')}.`:''}`;
}

// ---------- The person: choosing a level ----------

function LevelCards({d,p,apps,value,onChange}:{d:number;p:Prov;apps:Apps;value:LevelId;onChange:(l:LevelId)=>void}){
 return <RadioGroup className="ig-levels" aria-label="Taso" value={value} onChange={v=>onChange(v as LevelId)} data-testid="level-cards">
  {levels(d,p).map(l=>{const ok=available(apps,p,l);const sel=value===l.id;return <Radio key={l.id} value={l.id} isDisabled={!ok} className="ig-level" data-testid={`card-${l.id}`}>
   <span className="ig-level-dot" aria-hidden="true"/>
   <span className="ig-level-body"><b className="ig-level-name">{l.name}</b>
    <span className="ig-meta">{ok?l.sum:l.notOffered??`Ei käytössä tällä palvelimella. Taso vaatii palvelimelle oman ${PNAME[p]}-sovelluksen, jonka palvelimen ylläpitäjä lisää.`}</span>
    {/* Today the services show only under the chosen card; the four-level
        direction keeps every available card's services in view. */}
    {ok&&(d===FOUR||sel)&&(d===NOW?<ul className="ig-level-svc">{SVCS[p].map(s=><li key={s}><b className="ig-level-svc-name">{SNAME[p][s]}</b><span className="ig-level-svc-text">{nowText(p,s,l.combo[s]??'read')}</span></li>)}</ul>
     :<ServiceLines p={p} combo={l.combo}/>)}
   </span></Radio>;})}
 </RadioGroup>;
}
/** Today's per-service words (levelAbility in Integrations.tsx). */
function nowText(p:Prov,s:Svc,a:Ab){
 if(s==='files')return a==='app'?'Vain sovelluksen kansio, synkronoituu molempiin suuntiin. Muu Dropbox ei näy.':a==='read'?'Peili: tiedostot kopioituvat kotihakemistoosi, mutta muutokset eivät palaa. Kansioon tehty muutos kirjoittuu seuraavalla kierroksella yli.':'Synkronoituu kotihakemistoosi molempiin suuntiin. Agentit voivat muokata, poistaa ja jakaa.';
 if(a==='read')return s==='mail'?'Vain luku. Ei voi muuttaa eikä lähettää mitään.':s==='calendar'?'Vain luku. Ei voi luoda tapahtumia eikä lähettää kutsuja.':'Vain luku.';
 if(a==='drafts')return 'Lukee, järjestelee ja kirjoittaa luonnoksia. Ei voi lähettää.';
 return s==='mail'?'Lukee, järjestelee, kirjoittaa luonnoksia ja lähettää.':s==='calendar'?'Lukee ja muokkaa. Tapahtuma osallistujineen lähettää kutsut.':'Lukee ja muokkaa.';
}

/** Microsoft: the registered combination equal to the chosen one, or the
 * broadest one below it. */
function msMatch(apps:Apps,c:Combo){
 const ls=levels(FOUR,'microsoft');
 const exact=ls.find(l=>sameCombo('microsoft',l.combo,c));
 const below=ls.filter(l=>available(apps,'microsoft',l)&&SVCS.microsoft.every(s=>rank[l.combo[s]??'read']<=rank[c[s]??'read']));
 return {exact,ok:!!exact&&available(apps,'microsoft',exact),nearest:below[0]};
}

function Choice({d,p,apps,st,set}:{d:number;p:Prov;apps:Apps;st:PersonState;set:(f:(s:PersonState)=>PersonState)=>void}){
 const combo=st.combo[p];
 const setCombo=(c:Combo)=>set(s=>({...s,combo:{...s.combo,[p]:c}}));
 let body:React.ReactNode;
 if(d===NOW||d===FOUR){
  body=<LevelCards d={d} p={p} apps={apps} value={st.level[d]?.[p]??'read'} onChange={l=>set(s=>({...s,level:{...s.level,[d]:{...s.level[d],[p]:l}}}))}/>;
 }else if(d===GRID){
  const m=p==='microsoft'?msMatch(apps,combo):undefined;
  body=<><p className="ig-lead">Valitse palveluittain, mitä agentit saavat tehdä.</p>
   <Grid p={p} combo={combo} testid="choice-grid" onChange={(s,a)=>setCombo({...combo,[s]:a})}/>
   <p className="muted il-merged-note"><span className="il-swatch" aria-hidden="true"/>Yhdistetty solu: {PNAME[p]} myöntää nämä vain yhdessä.</p>
   {m&&(m.ok?<p className="il-match" data-testid="grid-match"><Icon name="check"/>Palvelimella on tämä yhdistelmä ({m.exact!.name}).</p>
    :<div data-testid="grid-match"><InlineNotice tone="warning" title="Tätä yhdistelmää ei ole tällä palvelimella" description={`${m.exact?`Yhdistelmälle ${m.exact.name} ei ole vielä tunnuksia.`:'Microsoftilla jokainen yhdistelmä on palvelimen ylläpitäjän erikseen lisäämä sovellus.'}${m.nearest?` Lähin suppeampi on ${m.nearest.name}.`:''}`} actions={m.nearest?[{label:`Valitse ${m.nearest.name}`,onPress:()=>setCombo(m.nearest!.combo)}] as never:undefined}/></div>)}
   {p!=='microsoft'&&<p className="il-match" data-testid="grid-match"><Icon name="check"/>{PNAME[p]} kysyy kirjautuessa juuri nämä oikeudet.</p>}
  </>;
 }else{
  const base=sameCombo(p,combo,p==='dropbox'?{files:'full'}:C.full)?'full':combo.files==='app'?'app':'read';
  const ex=(s:Svc,a:Ab)=>combo[s]===a||(a==='drafts'&&combo[s]==='full');
  const toggle=(s:Svc,a:Ab,on:boolean)=>setCombo({...combo,[s]:on?a:'read'});
  const opts:{s:Svc;a:Ab;label:string;hint?:string;off?:string}[]=p==='dropbox'
   ?[{s:'files',a:'edit',label:'Tiedostojen muokkaus ja poisto',hint:'Ei jakamista eikä linkkejä.'},{s:'files',a:'full',label:'Myös jakaminen',hint:'Linkit ja kutsut muille.'}]
   :[{s:'mail',a:'drafts',label:'Postin järjestely ja luonnokset',hint:'Luonnokset lähetät itse.',off:p==='google'?GMAIL_NO:undefined},
     {s:'calendar',a:'full',label:'Kalenterin muokkaus',hint:p==='microsoft'?'Osallistujat saavat aina kutsun.':'Agentti voi lähettää osallistujille kutsun.'},
     {s:'contacts',a:'edit',label:'Yhteystietojen muokkaus'},
     {s:'files',a:'full',label:'Tiedostojen muokkaus',hint:'Voi myös jakaa tiedoston linkillä.'}];
  const m=p==='microsoft'&&base==='read'?msMatch(apps,combo):undefined;
  body=<><RadioGroup className="ig-levels" aria-label="Pohja" value={base} data-testid="base-cards" onChange={v=>setCombo(v==='full'?(p==='dropbox'?{files:'full'}:C.full):v==='app'?{files:'app'}:ALL('read'))}>
   {(p==='dropbox'?[['read','Vain luku','Agentit lukevat kaiken. Voit sallia lisäksi alla olevat.'],['full','Täysi','Agentit voivat lukea, muokata, poistaa ja jakaa kaikkia tiedostojasi.'],['app','Vain sovelluskansio','Agentit näkevät vain sovelluksen oman kansion. Muu Dropbox ei näy.']]
    :[['read','Vain luku','Agentit lukevat kaiken. Voit sallia lisäksi alla olevat.'],['full','Täysi','Agentit voivat lukea, muokata ja lähettää sinun nimissäsi.']]).map(([id,n,sum])=>{
     const off=id==='full'&&p==='microsoft'&&!apps['microsoft:full']||id==='app'&&!apps['dropbox:app'];
     return <Radio key={id} value={id} className="ig-level" isDisabled={off} data-testid={`base-${id}`}><span className="ig-level-dot" aria-hidden="true"/>
     <span className="ig-level-body"><b className="ig-level-name">{n}</b><span className="ig-meta">{off?'Ei käytössä tällä palvelimella.':sum}</span>
      {id==='read'&&base==='read'&&<div className="il-exceptions" data-testid="exceptions"><b>Salli lisäksi</b>
       {opts.map(o=><Checkbox key={o.s+o.a} data-testid={`exc-${o.s}-${o.a}`} label={o.label} hint={o.off??o.hint} checked={ex(o.s,o.a)} onChange={on=>toggle(o.s,o.a,on)} availability={o.off?{state:'disabled',reason:o.off} as never:undefined}/>)}
      </div>}
     </span></Radio>;})}
  </RadioGroup>
  <p className="il-sentence big" data-testid="base-sentence">{sentence(p,combo)}</p>
  {m&&!m.ok&&<div data-testid="base-match"><InlineNotice tone="warning" title="Palvelimella ei ole tätä yhdistelmää" description={`Microsoftilla jokainen yhdistelmä on ylläpitäjän erikseen lisäämä sovellus.${m.nearest?` Lähin suppeampi: ${m.nearest.id==='read'?'Vain luku':baseName(p,m.nearest.combo)}.`:''}`} actions={m.nearest?[{label:'Valitse lähin',onPress:()=>setCombo(m.nearest!.combo)}] as never:undefined}/></div>}
  </>;
 }
 return <div className="il-connect" data-testid="choice">
  <div className="ig-dh"><ProviderMark provider={p}/><h2>Yhdistä {PNAME[p]}-tili</h2></div>
  {d!==BASE&&d!==GRID&&<p className="ig-lead">Mitä agentit saavat tehdä tällä tilillä?</p>}
  {body}
  <p className="ig-p muted">Taso pyydetään {p==='microsoft'?'Microsoftin':p==='google'?'Googlen':'Dropboxin'} kirjautumisessa, joten {PNAME[p]} itse valvoo sitä.</p>
  <div className="ig-row"><Button size="page" variant="secondary">Peruuta</Button><Button size="page" variant="primary" data-testid="continue"><Icon name="external"/>Jatka: {PNAME[p]}</Button></div>
 </div>;
}

// ---------- The person: the account card ----------

function personCombo(d:number,p:Prov,st:PersonState):{combo:Combo;name:string;full:boolean}{
 if(d===NOW||d===FOUR){const l=levels(d,p).find(x=>x.id===(st.level[d]?.[p]??'read'))??levels(d,p)[0];return {combo:l.combo,name:l.name,full:l.id==='full'};}
 const c=st.combo[p];const full=sameCombo(p,c,p==='dropbox'?{files:'full'}:C.full);
 if(d===GRID){const l=levels(FOUR,p).find(x=>sameCombo(p,x.combo,c));return {combo:c,name:l?.name??'Valitut oikeudet',full};}
 const ex=excList(p,c);return {combo:c,name:full?'Täysi':c.files==='app'?'Vain sovelluskansio':ex.length?`Vain luku + ${ex.length} ${ex.length===1?'poikkeus':'poikkeusta'}`:'Vain luku',full};
}
function Account({d,p,st}:{d:number;p:Prov;st:PersonState}){
 const {combo,name,full}=personCombo(d,p,st);
 const address=p==='dropbox'?'aino.virtanen@example.com':p==='google'?'aino.virtanen@gmail.com':'aino@yritys.example';
 return <div className="ig-card" data-testid="account">
  <div className="ig-acc"><ProviderMark provider={p}/><div><b>{address}</b><span className="ig-meta">{PNAME[p]} · yhdistetty 6.11.</span></div>
   <span className={`ig-lv ${full?'full':'narrow'}`} data-testid="account-level"><Icon className="ig-lv-icon" name={full?'key':'lock'}/>{name}</span>
   <Button size="row" variant="quiet">Vaihda taso…</Button></div>
  {d===NOW?SVCS[p].map(s=><div className="ig-svc" key={s}><span className="ig-ic sm"><Icon name={SICON[s]}/></span><div><b>{SNAME[p][s]}</b><span className="ig-meta">{nowText(p,s,combo[s]??'read')}</span></div><StatusMark kind="success" tone="success" label="Käytössä"/></div>)
   :d===GRID?<div className="il-acc-grid"><Grid p={p} combo={combo} testid="account-grid"/></div>
   :<>{d===BASE&&<p className="il-sentence il-acc-sentence" data-testid="account-sentence">{sentence(p,combo)}</p>}<div className="il-acc-lines"><ServiceLines p={p} combo={combo}/></div></>}
 </div>;
}

// ---------- The page ----------

type View='admin'|'choice'|'account';
type PersonState={level:Record<number,Partial<Record<Prov,LevelId>>>;combo:Record<Prov,Combo>};
const initialPerson=():PersonState=>({
 level:{[NOW]:{microsoft:'drafts',google:'read',dropbox:'read'},[FOUR]:{microsoft:'read',google:'read',dropbox:'nosend'}},
 combo:{microsoft:C.nosend,google:C.gnomail,dropbox:{files:'edit'}},
});
const adminNav:[string,string,IconName][]=[['palvelin','Palvelin','server'],['palvelinintegraatiot','Palvelinintegraatiot','plug'],['aiavain','AI-avain','key'],['kayttoonotto','Käyttöönotto','steer'],['kayttajat','Käyttäjät ja pääsy','users'],['levy','Levytila','disk']];
const ownNav:[string,IconName][]=[['Tili','user'],['Laitteet','devices'],['Agentit','agent'],['Yhteydet','link'],['Integraatiot','plug']];
let reviewTheme='light',reviewPhone=false,reviewView:View='admin',reviewProv:Prov='microsoft';
let reviewApps:Apps={...initialApps};

function App({direction:d}:{direction:number}){
 const [theme,setTheme]=useState(reviewTheme),[phone,setPhone]=useState(reviewPhone);
 const [view,setView]=useState<View>(reviewView),[prov,setProv]=useState<Prov>(reviewProv);
 const [apps,setApps]=useState<Apps>(reviewApps);
 const [st,setSt]=useState<PersonState>(initialPerson);
 const [setting,setSetting]=useState<{p:Prov;l:Level}|null>(null);
 const markSet=()=>{if(!setting)return;const k=`${setting.p}:${setting.l.id}`;reviewApps={...apps,[k]:true};setApps(reviewApps);setSetting(null);};
 // The new Microsoft level is not set: in four levels the person sees it
 // greyed out; in the grid and base directions the default choice asks for it.
 const admin=view==='admin';
 const main=admin?<><p className="muted mobilecrumb">Asetukset › Palvelinintegraatiot</p><h2>Palvelinintegraatiot</h2>
   <p className="muted il-lead">Palvelut, joihin henkilöt voivat yhdistää tilinsä. {d===NOW?'':'Jokaisen tason kohdalla lukee, mitä se sallii agenteille, ennen kuin asetat sille tunnukset.'}</p>
   <AdminList d={d} apps={apps} onSet={(p,l)=>setSetting({p,l})}/></>
  :<><p className="muted mobilecrumb">Asetukset › Integraatiot</p><h2>Integraatiot</h2>
   <div className="scenario"><Segmented data-testid="provider" label="Palvelu" size="row" value={prov} onChange={v=>{reviewProv=v as Prov;setProv(v as Prov);}} options={PROVS.map(p=>({id:p,label:PNAME[p]}))}/></div>
   {view==='choice'?<div className="ah-dialog il-dialogcard"><Choice d={d} p={prov} apps={apps} st={st} set={setSt}/></div>:<Account d={d} p={prov} st={st}/>}</>;
 const viewOpts:[View,string][]=[['admin','Ylläpitäjä: palvelinintegraatiot'],['choice','Henkilö: tason valinta'],['account','Henkilö: tili']];
 return <div data-theme={theme} className={phone?'review phone':'review'}>
  <header className="reviewbar"><strong>Integraatioiden tasot</strong>
   <label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
   <label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);}}/> 390 px</label>
   <p>Synteettinen palvelin ja tilit. Mitään ei lähetetä.</p></header>
  <ol className="il-lines" data-testid="direction-lines">{LINES.map((l,i)=><li key={i} aria-current={i===d?'true':undefined}>{l}</li>)}</ol>
  <p className="axis">Akseli: miten taso kootaan ja nimetään. Palvelun tekniset rajat ovat kaikissa samat. Suositus: Neljä tasoa.</p>
  <div className="scenario"><span className="muted">Näkymä</span><Segmented data-testid="view" label="Näkymä" size="row" options={viewOpts.map(([id,label])=>({id,label}))} value={view} onChange={v=>{reviewView=v as View;setView(v as View);}}/>
   <Button size="row" variant="quiet" data-testid="reset" onPress={()=>{reviewApps={...initialApps};setApps(reviewApps);setSt(initialPerson());}}>Palauta alkutila</Button></div>
  <div className={`shell variant-${d}`}>
   <div className="hostbar"><strong>Open Habitat</strong><span>{admin?'Kaisa Admin · ylläpitäjä':'Aino Virtanen'}</span><Icon name="user"/></div>
   <section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>
    {ownNav.map(([n,i])=><span className="s-nav-i" key={n} aria-current={!admin&&n==='Integraatiot'?'page':undefined}><Icon name={i}/>{n}</span>)}
    {admin&&<><span className="s-nav-h">Palvelimen ylläpito</span>{adminNav.map(([id,n,i])=><span className="s-nav-i" key={id} aria-current={id==='palvelinintegraatiot'?'page':undefined}><Icon name={i}/>{n}</span>)}</>}
   </nav><main className="s-main">{main}</main></section>
  </div>
  {setting&&<SetDialog theme={theme} p={setting.p} level={setting.l} d={d} onClose={()=>setSetting(null)} onSet={markSet}/>}
 </div>;
}

const root=createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink={set innerHTML(view:React.ReactNode){flushSync(()=>root.render(view===''?null:view));}};
const variants=directions.map((_,direction)=>()=> <App key={direction} direction={direction}/>);
const picker=document.createElement('nav');
picker.className='proto-picker';picker.setAttribute('aria-label','Prototype variants');
picker.innerHTML='<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n,i)=>{const button=document.createElement('button');button.className='proto-picker-item';button.textContent=n.replaceAll(' ',' ');if(i===0){button.setAttribute('data-active','');button.setAttribute('aria-current','true');}picker.append(button);});
document.body.append(picker);
new Function('stage','variants',pickerSource)(stageSink,variants);
