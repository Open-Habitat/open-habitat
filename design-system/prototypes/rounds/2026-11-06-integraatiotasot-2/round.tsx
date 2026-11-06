import React, {useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay, Radio, RadioGroup} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon, type IconName} from '../../../../web/src/components/Icon';
import {StatusMark} from '../../../../web/src/components/Status';
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

// Integration access levels, round 2 (proto-integration-levels). Jari chose
// round 1's Grid to riff on: its cells without a permission read like the
// granted ones (same label, grey, a slash), and four full grids stacked in
// the administrator's list clog the page. The axis is where and in what
// shape a level's permissions are shown: side by side in one comparison
// table, one grid opening under its row, or a grid in its own window. Every
// riff writes a missing permission as a cross and a negative verb
// ("Ei lähetä"), never the granted label in grey, and drops the hatching of
// merged cells. The levels are round 1's four and the provider limits are
// round 1's result.md: Microsoft cannot separate calendar editing from
// invitations or file editing from sharing links and needs its own
// application per level; Gmail cannot separate any change from sending;
// Dropbox can separate editing from sharing. Everything is synthetic.
const directions=['Vertailutaulukko','Avautuva ruudukko','Erillinen ikkuna'];
const LINES=[
 'Vertailutaulukko: tasot rinnakkain sarakkeina ja oikeudet riveinä, jokaisessa solussa ✓ Kyllä tai ✕ Ei; ylläpitäjän tasorivit ovat yhden rivin mittaisia.',
 'Avautuva ruudukko: tasot ovat yhden rivin mittaisia, ja tason ruudukko avautuu rivin alle yksi kerrallaan.',
 'Erillinen ikkuna: listat pysyvät tiiviinä, ja ruudukko avautuu omaan ikkunaansa, jossa tasoa vaihtamalla näkee, mitkä solut muuttuvat.',
];
const COMMON='Kaikissa: solu, jossa ei ole oikeutta, on ✕ ja kieltomuoto (”Ei lähetä”), ei enää harmaa sama teksti; yhdistettyjen solujen vinoviivoitus on poistettu.';
const TABLE=0,OPEN=1,WINDOW=2;

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

// The grid's columns: which abilities a provider can separate. A cell that
// spans two columns is two steps the provider grants only together; its
// warning says what cannot be prevented.
type Col='read'|'edit'|'send';
const COLS:[Col,string][]=[['read','Lukee'],['edit','Muokkaa'],['send','Lähettää tai jakaa']];
type Cell={cols:Col[];ab:Ab;on:string;off:string;warn?:string}|null;
function cells(p:Prov,s:Svc):Cell[]{
 const r:Cell={cols:['read'],ab:'read',on:s==='calendar'||s==='contacts'?'Näkee':'Lukee',off:'Ei näe'};
 if(s==='mail')return p==='microsoft'
  ?[r,{cols:['edit'],ab:'drafts',on:'Järjestelee ja luonnostelee',off:'Ei järjestele eikä luonnostele'},{cols:['send'],ab:'full',on:'Lähettää',off:'Ei lähetä'}]
  :[r,{cols:['edit','send'],ab:'full',on:'Muuttaa ja lähettää',off:'Ei muuta eikä lähetä',warn:'Gmail ei erota muutoksia lähettämisestä'}];
 if(s==='calendar')return [r,{cols:['edit','send'],ab:'full',on:'Muokkaa tapahtumia',off:'Ei muokkaa eikä lähetä kutsuja',warn:p==='microsoft'?'Osallistujat saavat aina kutsun':'Voi lähettää osallistujille kutsun'}];
 if(s==='contacts')return [r,{cols:['edit'],ab:'edit',on:'Muokkaa',off:'Ei muokkaa'},null];
 if(p==='dropbox')return [r,{cols:['edit'],ab:'edit',on:'Muokkaa',off:'Ei muokkaa'},{cols:['send'],ab:'full',on:'Jakaa',off:'Ei jaa'}];
 return [r,{cols:['edit','send'],ab:'full',on:'Muokkaa ja voi jakaa',off:'Ei muokkaa eikä jaa',warn:p==='microsoft'?'Jakolinkki voi avautua kenelle tahansa, jos organisaatio sallii':'Jakaminen sisältyy muokkaukseen'}];
}
const rank:Record<Ab,number>={read:0,drafts:1,edit:1,app:1,full:2};
/** Whether a combination grants a cell, and the words the cell then says.
 * The Dropbox app folder grants reading and editing of one folder only. */
function cellState(p:Prov,s:Svc,c:Exclude<Cell,null>,a:Ab):{on:boolean;text:string;part?:boolean}{
 if(a==='app'&&c.ab!=='full')return {on:true,part:true,text:c.ab==='read'?'Vain sovelluskansio':'Muokkaa vain sovelluskansiota'};
 const on=rank[a]>=rank[c.ab];
 return {on,text:on?c.on:c.off};
}

// ---------- Levels ----------

type LevelId='full'|'nosend'|'drafts'|'read'|'app'|'gnomail';
type Level={id:LevelId;name:string;sum:string;combo:Combo;
 /** Microsoft and Dropbox App folder: its own application, so its own credentials. */
 ownApp:boolean;notOffered?:string};
const C={
 full:{mail:'full',calendar:'full',contacts:'edit',files:'full'} as Combo,
 nosend:{mail:'drafts',calendar:'full',contacts:'edit',files:'full'} as Combo,
 drafts:{mail:'drafts',calendar:'read',contacts:'read',files:'read'} as Combo,
 read:{mail:'read',calendar:'read',contacts:'read',files:'read'} as Combo,
 gnomail:{mail:'read',calendar:'full',contacts:'edit',files:'full'} as Combo,
};
const GMAIL_NO='Gmailissa jokainen muutosoikeus antaa myös lähetysoikeuden, joten pelkkiä luonnoksia ei voi myöntää.';
function levels(p:Prov):Level[]{
 if(p==='dropbox')return [
  {id:'full',name:'Koko Dropbox',sum:'Lukee, muokkaa, poistaa ja jakaa kaikkia tiedostojasi.',combo:{files:'full'},ownApp:false},
  {id:'nosend',name:'Kaikki paitsi jakaminen',sum:'Muokkaa ja poistaa tiedostojasi, mutta ei jaa niitä eikä luo linkkejä.',combo:{files:'edit'},ownApp:false},
  {id:'app',name:'Vain sovelluskansio',sum:'Näkee vain sovelluksen oman kansion. Muu Dropbox ei näy.',combo:{files:'app'},ownApp:true},
  {id:'read',name:'Vain luku',sum:'Lukee kaikkia tiedostojasi, mutta ei muuta, poista eikä jaa niitä.',combo:{files:'read'},ownApp:false},
 ];
 const ms=p==='microsoft';
 return [
  {id:'full',name:'Täysi',sum:'Lukee, muokkaa ja lähettää nimissäsi.',combo:C.full,ownApp:ms},
  ms?{id:'nosend',name:'Kaikki paitsi postin lähetys',sum:'Kuten Täysi, mutta posti jää luonnoksiksi, jotka lähetät itse.',combo:C.nosend,ownApp:true}
   :{id:'gnomail',name:'Kaikki paitsi Gmailin muutokset',sum:'Muokkaa kalenteria, yhteystietoja ja Drivea; Gmail on vain luettavissa.',combo:C.gnomail,ownApp:false},
  {id:'drafts',name:'Luonnokset, muu vain luku',sum:'Kirjoittaa postiluonnoksia ja lukee kaikkea muuta. Tililtä ei lähde mitään.',combo:C.drafts,ownApp:ms,notOffered:ms?undefined:GMAIL_NO},
  {id:'read',name:'Vain luku',sum:'Lukee kaiken, mutta ei muuta mitään.',combo:C.read,ownApp:ms},
 ];
}
// Column headers break at syllables on a phone, not mid-letter.
const SOFT:Record<string,string>={Luonnokset:'Luon\u00adnok\u00adset',sovelluskansio:'sovellus\u00adkansio',jakaminen:'jaka\u00adminen',muutokset:'muu\u00adtok\u00adset',tunnuksia:'tun\u00adnuk\u00adsia',luonnostelee:'luonnos\u00adtelee',Järjestelee:'Järjes\u00adtelee'};
const soft=(t:string)=>t.replace(/[A-Za-zÄÖäö]+/g,w=>SOFT[w]??w);
const offered=(p:Prov)=>levels(p).filter(l=>!l.notOffered);

// ---------- The server's state ----------

/** Microsoft's full and read applications are set; drafts and the new level
 * are not (as in round 1). */
type Apps=Record<string,boolean>;
const initialApps:Apps={'microsoft:full':true,'microsoft:read':true,'microsoft:drafts':false,'microsoft:nosend':false,'dropbox:full':true,'dropbox:app':false,'google:full':true};
const available=(apps:Apps,p:Prov,l:Level)=>!l.notOffered&&(p==='google'?apps['google:full']:p==='dropbox'?(l.ownApp?apps['dropbox:app']:apps['dropbox:full']):!!apps[`microsoft:${l.id}`]);
const sharedBy=(p:Prov,l:Level)=>!l.ownApp?(p==='dropbox'?'Koko Dropbox -sovelluksella':p==='google'?'Google-sovelluksella':undefined):(p==='microsoft'&&l.id==='full'?'Yllä oleva sovellus':undefined);

// ---------- The grid (riffs 2 and 3) ----------

function Grid({p,combo,testid}:{p:Prov;combo:Combo;testid:string}){
 return <div className="il-grid" role="table" aria-label="Oikeudet palveluittain" data-testid={testid}>
  <div className="il-grid-head" role="row"><span role="columnheader">Palvelu</span>{COLS.map(([c,l])=><span key={c} role="columnheader">{l}</span>)}</div>
  {SVCS[p].map(s=>{const a=combo[s]??'read';return <div className="il-grid-row" role="row" key={s} data-testid={`grid-${s}`}>
   <span className="il-grid-svc" role="rowheader"><Icon name={SICON[s]}/>{SNAME[p][s]}</span>
   {cells(p,s).map((c,i)=>{
    if(c===null)return <span key={i} role="cell" className="il-cell na"><span aria-hidden="true">–</span><span className="sr">ei lähetettävää</span></span>;
    const st=cellState(p,s,c,a);
    return <span key={i} role="cell" data-testid={`cell-${s}-${c.ab}`} data-on={st.on?'yes':'no'} className={`il-cell ${st.on?'on':'off'}${st.part?' part':''}${c.cols.length>1?' merged':''}`} style={{gridColumn:c.cols.length>1?'span 2':undefined}}>
     <span className="il-cell-main"><Icon name={st.on?'check':'cross'}/><span>{soft(st.text)}</span></span>
     {st.on&&c.warn&&<span className="il-cell-warn"><Icon name="warning"/>{c.warn}</span>}
    </span>;})}
  </div>;})}
 </div>;
}
function GridLegend({p}:{p:Prov}){
 return <p className="muted il-legend"><span><Icon name="check"/> sallittu</span><span><Icon name="cross"/> ei sallittu</span><span>Kahden sarakkeen solu: {PNAME[p]} myöntää nämä vain yhdessä.</span></p>;
}

// ---------- The comparison table (riff 1) ----------

/** The provider's levels side by side: one row per ability, Kyllä or Ei
 * in every cell. A chooser column header is a button; a chosen column is
 * outlined. */
function Compare({p,ls,apps,chosen,onChoose,testid,showState}:{p:Prov;ls:Level[];apps:Apps;chosen?:LevelId;onChoose?:(l:LevelId)=>void;testid:string;showState?:boolean}){
 return <div className="il-cmp-wrap"><table className={`il-cmp cols-${ls.length}`} data-testid={testid}>
  <thead><tr><th scope="col" className="il-cmp-corner"><span className="sr">Oikeus</span></th>{ls.map(l=>{const ok=available(apps,p,l);return <th scope="col" key={l.id} className={chosen===l.id?'sel':undefined} data-testid={`col-${l.id}`}>
   {onChoose?<button type="button" className="il-cmp-pick" disabled={!ok} aria-pressed={chosen===l.id} onClick={()=>onChoose(l.id)} data-testid={`pick-${l.id}`}><span className="il-cmp-dot" aria-hidden="true"/><span>{soft(l.name)}</span></button>:<span className="il-cmp-name">{soft(l.name)}</span>}
   {onChoose&&!ok&&<span className="il-cmp-state">Ei käytössä</span>}
   {showState&&<span className="il-cmp-state">{sharedBy(p,l)&&p!=='microsoft'?'':available(apps,p,l)?'Tarjolla':soft('Ei tunnuksia')}</span>}
  </th>;})}</tr></thead>
  {SVCS[p].map(s=><tbody key={s}>
   {SVCS[p].length>1&&<tr className="il-cmp-svc"><th scope="colgroup" colSpan={ls.length+1}><Icon name={SICON[s]}/>{SNAME[p][s]}</th></tr>}
   {cells(p,s).filter((c):c is Exclude<Cell,null>=>c!==null).map(c=><tr key={c.ab} data-testid={`row-${s}-${c.ab}`}>
    <th scope="row"><span>{c.on}</span>{c.warn&&<span className="il-cmp-warn"><Icon name="warning"/>{c.warn}</span>}</th>
    {ls.map(l=>{const st=cellState(p,s,c,l.combo[s]??'read');return <td key={l.id} className={`${st.on?'on':'off'}${st.part?' part':''}${chosen===l.id?' sel':''}`} data-on={st.on?'yes':'no'}>
     <span className="il-cmp-val"><Icon name={st.on?'check':'cross'}/><span>{st.part?'Vain sovelluskansio':st.on?'Kyllä':'Ei'}</span></span></td>;})}
   </tr>)}
  </tbody>)}
 </table></div>;
}

// ---------- Administrator: Palvelinintegraatiot ----------

function SetDialog({theme,p,level,onClose,onSet}:{theme:string;p:Prov;level:Level;onClose:()=>void;onSet:()=>void}){
 return <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={o=>!o&&onClose()}>
  <Modal className="ah-modal il-dialog" data-theme={theme}><Dialog className="ah-dialog" data-testid="set-dialog" aria-label="Aseta tunnukset">
   <Heading slot="title" className="il-dh">Aseta tunnukset: {PNAME[p]}, taso {level.name}</Heading>
   <p>Tällä tasolla yhdistetyt tilit saavat palveluittain:</p>
   <Grid p={p} combo={level.combo} testid="set-grid"/><GridLegend p={p}/>
   <p className="muted">Microsoft antaa jokaiselle sovelluksen kirjautumiselle kaikki sovellukselle hyväksytyt oikeudet, joten taso on raja vain omana sovelluksenaan. Sovelluksen luonti on ohjatun asetuksen oma prototyyppi.</p>
   <div className="ah-dialog-actions"><Button size="page" variant="secondary" onPress={onClose}>Peruuta</Button>
    <Button data-testid="set-confirm" size="page" variant="primary" onPress={onSet}>Merkitse asetetuksi</Button></div>
  </Dialog></Modal></ModalOverlay>;
}

/** Riff 3's window: one grid, a level switch above it, and the action the
 * level needs below. */
function GridWindow({theme,p,apps,start,onClose,action}:{theme:string;p:Prov;apps:Apps;start:LevelId;onClose:()=>void;action:(l:Level,close:()=>void)=>React.ReactNode}){
 const ls=offered(p);
 const [id,setId]=useState<LevelId>(start);
 const l=ls.find(x=>x.id===id)??ls[0];
 return <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={o=>!o&&onClose()}>
  <Modal className="ah-modal il-dialog il-window" data-theme={theme}><Dialog className="ah-dialog" data-testid="grid-window" aria-label="Mitä tasot sallivat">
   <Heading slot="title" className="il-dh">Mitä tasot sallivat: {PNAME[p]}</Heading>
   <Segmented data-testid="window-level" label="Taso" size="row" value={id} onChange={v=>setId(v as LevelId)} options={ls.map(x=>({id:x.id,label:x.name}))}/>
   <p className="il-window-sum"><b>{l.name}.</b> {l.sum} {!available(apps,p,l)&&<span className="muted">Tällä tasolla ei ole vielä tunnuksia.</span>}</p>
   <Grid p={p} combo={l.combo} testid="window-grid"/><GridLegend p={p}/>
   <div className="ah-dialog-actions"><Button size="page" variant="secondary" onPress={onClose}>Sulje</Button>{action(l,onClose)}</div>
  </Dialog></Modal></ModalOverlay>;
}

function LevelState({p,l,apps,onSet}:{p:Prov;l:Level;apps:Apps;onSet:()=>void}){
 const shared=sharedBy(p,l),on=available(apps,p,l);
 return <>
  <span className="si-state">{shared?<span className="muted">{shared}</span>:on?<StatusMark kind="success" tone="success" label="Tarjolla"/>:<StatusMark label="Ei käytössä"/>}</span>
  <span className="si-act">{!shared&&!on&&<Button data-testid={`set-${p}-${l.id}`} size="row" variant="secondary" onPress={onSet}>Aseta tunnukset…</Button>}
   {!shared&&on&&<Button size="row" variant="quiet">Tunnukset</Button>}</span>
 </>;
}

function AdminList({d,apps,onSet,onWindow}:{d:number;apps:Apps;onSet:(p:Prov,l:Level)=>void;onWindow:(p:Prov,l:LevelId)=>void}){
 // Riff 2: one grid open at a time; the first level without credentials starts open.
 const [open,setOpen]=useState<string|null>('microsoft:nosend');
 const rows:React.ReactNode[]=[];
 for(const p of PROVS){
  const ls=offered(p);
  rows.push(<li key={p} className="si-row" data-testid={`row-${p}`}><ProviderMark provider={p} small/>
   <span className="si-main"><span className="si-name">{PNAME[p]}</span>
    {p!=='microsoft'&&<span className="muted il-provnote">{p==='google'?'Yksi sovellus kaikille tasoille: Google kysyy kirjautuessa vain tason oikeudet.':'Koko Dropbox -sovellus kattaa tasot, joilla ei ole omaa riviä.'}</span>}
   </span>
   <span className="si-state">{apps[`${p}:full`]?<StatusMark kind="success" tone="success" label="Tarjolla"/>:<StatusMark tone="warning" label="Ei tarjolla"/>}</span>
   <span className="si-act"><Button size="row" variant="quiet">Tunnukset</Button></span></li>);
  for(const l of ls){
   const k=`${p}:${l.id}`,isOpen=d===OPEN&&open===k;
   rows.push(<li key={k} className={`si-row si-level il-lrow${isOpen?' open':''}`} data-testid={`level-${p}-${l.id}`}>
    <span className="si-level-indent" aria-hidden="true"/>
    <span className="si-main il-main"><span className="si-name">{l.name}</span>
     {d!==TABLE&&<span className="il-sum">{l.sum}</span>}
     {d===OPEN&&<button type="button" className="il-disclose" aria-expanded={isOpen} aria-controls={`grid-${k}`} data-testid={`open-${p}-${l.id}`} onClick={()=>setOpen(isOpen?null:k)}><Icon name={isOpen?'up':'down'}/>{isOpen?'Piilota oikeudet':'Näytä oikeudet'}</button>}
     {d===WINDOW&&<button type="button" className="il-disclose" data-testid={`window-${p}-${l.id}`} onClick={()=>onWindow(p,l.id)}><Icon name="grid"/>Mitä taso sallii</button>}
    </span>
    <LevelState p={p} l={l} apps={apps} onSet={()=>onSet(p,l)}/>
    {isOpen&&<div className="il-open" id={`grid-${k}`} data-testid="open-grid"><Grid p={p} combo={l.combo} testid={`grid-${p}-${l.id}`}/><GridLegend p={p}/></div>}
   </li>);
  }
  if(d===TABLE)rows.push(<li key={p+'cmp'} className="si-row si-level il-cmprow" data-testid={`compare-${p}`}>
   <span className="si-level-indent" aria-hidden="true"/>
   <div className="il-cmpbox"><b className="il-cmp-title">Mitä tasot sallivat</b>
    <Compare p={p} ls={ls} apps={apps} testid={`cmp-${p}`} showState={p==='microsoft'}/>
    {p==='google'&&<p className="muted il-cmp-foot">Luonnokset, muu vain luku ei ole tarjolla: {GMAIL_NO}</p>}
   </div></li>);
 }
 return <div className="s-card si"><ul className="si-rows" data-testid="admin-list">{rows}</ul></div>;
}

// ---------- The person: choosing a level ----------

function Choice({d,p,apps,value,onChange,onWindow}:{d:number;p:Prov;apps:Apps;value:LevelId;onChange:(l:LevelId)=>void;onWindow:()=>void}){
 const ls=levels(p);
 let body:React.ReactNode;
 if(d===TABLE){
  const cur=ls.find(l=>l.id===value)!;
  body=<><p className="ig-lead">Valitse taso sarakkeen otsikosta.</p>
   <Compare p={p} ls={ls.filter(l=>!l.notOffered)} apps={apps} chosen={value} onChoose={onChange} testid="choice-compare"/>
   {p==='google'&&<p className="muted il-cmp-foot">Luonnokset, muu vain luku ei ole tarjolla: {GMAIL_NO}</p>}
   <p className="il-chosen" data-testid="chosen"><Icon name="check"/><span><b>Valittu: {cur.name}.</b> {cur.sum}</span></p></>;
 }else{
  body=<><p className="ig-lead">Mitä agentit saavat tehdä tällä tilillä?</p>
   <RadioGroup className="ig-levels" aria-label="Taso" value={value} onChange={v=>onChange(v as LevelId)} data-testid="level-cards">
   {ls.map(l=>{const ok=available(apps,p,l);const sel=value===l.id;return <Radio key={l.id} value={l.id} isDisabled={!ok} className="ig-level" data-testid={`card-${l.id}`}>
    <span className="ig-level-dot" aria-hidden="true"/>
    <span className="ig-level-body"><b className="ig-level-name">{l.name}</b>
     <span className="ig-meta">{ok?l.sum:l.notOffered??`Ei käytössä tällä palvelimella. Taso vaatii palvelimelle oman ${PNAME[p]}-sovelluksen, jonka ylläpitäjä lisää.`}</span>
     {d===OPEN&&ok&&sel&&<div className="il-cardgrid" data-testid="card-grid"><Grid p={p} combo={l.combo} testid="choice-grid"/></div>}
    </span></Radio>;})}
   </RadioGroup>
   {d===OPEN&&<GridLegend p={p}/>}
   {d===WINDOW&&<button type="button" className="il-disclose il-compare-link" data-testid="open-window" onClick={onWindow}><Icon name="grid"/>Vertaa tasoja ruudukkona</button>}</>;
 }
 return <div className="il-connect" data-testid="choice">
  <div className="ig-dh"><ProviderMark provider={p}/><h2>Yhdistä {PNAME[p]}-tili</h2></div>
  {body}
  <p className="ig-p muted">Taso pyydetään {p==='microsoft'?'Microsoftin':p==='google'?'Googlen':'Dropboxin'} kirjautumisessa, joten {PNAME[p]} itse valvoo sitä.</p>
  <div className="ig-row"><Button size="page" variant="secondary">Peruuta</Button><Button size="page" variant="primary" data-testid="continue"><Icon name="external"/>Jatka: {PNAME[p]}</Button></div>
 </div>;
}

// ---------- The person: the account card ----------

function Account({d,p,apps,value,onWindow}:{d:number;p:Prov;apps:Apps;value:LevelId;onWindow:()=>void}){
 const l=levels(p).find(x=>x.id===value)??levels(p)[0];
 const [open,setOpen]=useState(false);
 const address=p==='dropbox'?'aino.virtanen@example.com':p==='google'?'aino.virtanen@gmail.com':'aino@yritys.example';
 return <div className="ig-card" data-testid="account">
  <div className="ig-acc"><ProviderMark provider={p}/><div><b>{address}</b><span className="ig-meta">{PNAME[p]} · yhdistetty 6.11.</span></div>
   <span className={`ig-lv ${l.id==='full'?'full':'narrow'}`} data-testid="account-level"><Icon className="ig-lv-icon" name={l.id==='full'?'key':'lock'}/>{l.name}</span>
   <Button size="row" variant="quiet">Vaihda taso…</Button></div>
  <div className="il-acc-body">
   <p className="il-acc-sum" data-testid="account-sum">{l.sum}</p>
   {d===TABLE&&<Compare p={p} ls={[l]} apps={apps} testid="account-compare"/>}
   {d===OPEN&&<><button type="button" className="il-disclose" aria-expanded={open} data-testid="account-open" onClick={()=>setOpen(!open)}><Icon name={open?'up':'down'}/>{open?'Piilota oikeudet':'Näytä oikeudet'}</button>
    {open&&<div className="il-open"><Grid p={p} combo={l.combo} testid="account-grid"/><GridLegend p={p}/></div>}</>}
   {d===WINDOW&&<button type="button" className="il-disclose" data-testid="account-window" onClick={onWindow}><Icon name="grid"/>Mitä taso sallii</button>}
  </div>
 </div>;
}

// ---------- The page ----------

type View='admin'|'choice'|'account';
const initialChoice=():Record<Prov,LevelId>=>({microsoft:'drafts',google:'gnomail',dropbox:'nosend'});
const adminNav:[string,string,IconName][]=[['palvelin','Palvelin','server'],['palvelinintegraatiot','Palvelinintegraatiot','plug'],['aiavain','AI-avain','key'],['kayttoonotto','Käyttöönotto','steer'],['kayttajat','Käyttäjät ja pääsy','users'],['levy','Levytila','disk']];
const ownNav:[string,IconName][]=[['Tili','user'],['Laitteet','devices'],['Agentit','agent'],['Yhteydet','link'],['Integraatiot','plug']];
let reviewTheme='light',reviewPhone=false,reviewView:View='admin',reviewProv:Prov='microsoft';
let reviewApps:Apps={...initialApps};

function App({direction:d}:{direction:number}){
 const [theme,setTheme]=useState(reviewTheme),[phone,setPhone]=useState(reviewPhone);
 const [view,setView]=useState<View>(reviewView),[prov,setProv]=useState<Prov>(reviewProv);
 const [apps,setApps]=useState<Apps>(reviewApps);
 const [choice,setChoice]=useState(initialChoice);
 const [setting,setSetting]=useState<{p:Prov;l:Level}|null>(null);
 const [win,setWin]=useState<{p:Prov;l:LevelId;who:'admin'|'choice'|'account'}|null>(null);
 const [epoch,setEpoch]=useState(0);
 const markSet=()=>{if(!setting)return;reviewApps={...apps,[`${setting.p}:${setting.l.id}`]:true};setApps(reviewApps);setSetting(null);};
 const admin=view==='admin';
 const main=admin?<><p className="muted mobilecrumb">Asetukset › Palvelinintegraatiot</p><h2>Palvelinintegraatiot</h2>
   <p className="muted il-lead">Palvelut, joihin henkilöt voivat yhdistää tilinsä. Katso, mitä kukin taso sallii agenteille, ennen kuin asetat sille tunnukset.</p>
   <AdminList key={epoch} d={d} apps={apps} onSet={(p,l)=>setSetting({p,l})} onWindow={(p,l)=>setWin({p,l,who:'admin'})}/></>
  :<><p className="muted mobilecrumb">Asetukset › Integraatiot</p><h2>Integraatiot</h2>
   <div className="scenario"><Segmented data-testid="provider" label="Palvelu" size="row" value={prov} onChange={v=>{reviewProv=v as Prov;setProv(v as Prov);}} options={PROVS.map(p=>({id:p,label:PNAME[p]}))}/></div>
   {view==='choice'?<div className="ah-dialog il-dialogcard"><Choice d={d} p={prov} apps={apps} value={choice[prov]} onChange={l=>setChoice(c=>({...c,[prov]:l}))} onWindow={()=>setWin({p:prov,l:choice[prov],who:'choice'})}/></div>
    :<Account key={prov+epoch} d={d} p={prov} apps={apps} value={choice[prov]} onWindow={()=>setWin({p:prov,l:choice[prov],who:'account'})}/>}</>;
 const viewOpts:[View,string][]=[['admin','Ylläpitäjä: palvelinintegraatiot'],['choice','Henkilö: tason valinta'],['account','Henkilö: tili']];
 const winAction=(l:Level,close:()=>void)=>{
  if(!win)return null;
  if(win.who==='admin'){const shared=sharedBy(win.p,l);if(shared||available(apps,win.p,l))return null;
   return <Button data-testid="window-set" size="page" variant="primary" onPress={()=>{close();setSetting({p:win.p,l});}}>Aseta tunnukset…</Button>;}
  if(win.who==='choice'){const ok=available(apps,win.p,l);
   return <Button data-testid="window-choose" size="page" variant="primary" isDisabled={!ok} onPress={()=>{setChoice(c=>({...c,[win.p]:l.id}));close();}}>{ok?'Valitse tämä taso':'Ei käytössä tällä palvelimella'}</Button>;}
  return null;
 };
 return <div data-theme={theme} className={phone?'review phone':'review'}>
  <header className="reviewbar"><strong>Integraatioiden tasot, kierros 2</strong>
   <label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
   <label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);}}/> 390 px</label>
   <p>Synteettinen palvelin ja tilit. Mitään ei lähetetä.</p></header>
  <ol className="il-lines" data-testid="direction-lines">{LINES.map((l,i)=><li key={i} aria-current={i===d?'true':undefined}>{l}</li>)}</ol>
  <p className="axis">Akseli: missä ja missä muodossa tason oikeudet näytetään. Riffaa kierroksen 1 Ruudukkoa. {COMMON} Suositus: Vertailutaulukko.</p>
  <div className="scenario"><span className="muted">Näkymä</span><Segmented data-testid="view" label="Näkymä" size="row" options={viewOpts.map(([id,label])=>({id,label}))} value={view} onChange={v=>{reviewView=v as View;setView(v as View);}}/>
   <Button size="row" variant="quiet" data-testid="reset" onPress={()=>{reviewApps={...initialApps};setApps(reviewApps);setChoice(initialChoice());setEpoch(e=>e+1);}}>Palauta alkutila</Button></div>
  <div className={`shell variant-${d}`}>
   <div className="hostbar"><strong>Open Habitat</strong><span>{admin?'Kaisa Admin · ylläpitäjä':'Aino Virtanen'}</span><Icon name="user"/></div>
   <section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>
    {ownNav.map(([n,i])=><span className="s-nav-i" key={n} aria-current={!admin&&n==='Integraatiot'?'page':undefined}><Icon name={i}/>{n}</span>)}
    {admin&&<><span className="s-nav-h">Palvelimen ylläpito</span>{adminNav.map(([id,n,i])=><span className="s-nav-i" key={id} aria-current={id==='palvelinintegraatiot'?'page':undefined}><Icon name={i}/>{n}</span>)}</>}
   </nav><main className="s-main">{main}</main></section>
  </div>
  {setting&&<SetDialog theme={theme} p={setting.p} level={setting.l} onClose={()=>setSetting(null)} onSet={markSet}/>}
  {win&&<GridWindow theme={theme} p={win.p} apps={apps} start={win.l} onClose={()=>setWin(null)} action={winAction}/>}
 </div>;
}

const root=createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink={set innerHTML(view:React.ReactNode){flushSync(()=>root.render(view===''?null:view));}};
const variants=directions.map((_,direction)=>()=> <App key={direction} direction={direction}/>);
const picker=document.createElement('nav');
picker.className='proto-picker';picker.setAttribute('aria-label','Prototype variants');
picker.innerHTML='<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n,i)=>{const button=document.createElement('button');button.className='proto-picker-item';button.textContent=n.replaceAll(' ','\u00a0');if(i===0){button.setAttribute('data-active','');button.setAttribute('aria-current','true');}picker.append(button);});
document.body.append(picker);
new Function('stage','variants',pickerSource)(stageSink,variants);
