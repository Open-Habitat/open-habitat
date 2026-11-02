import React, {useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon, type IconName} from '../../../../web/src/components/Icon';
import {InlineNotice, StatusMark} from '../../../../web/src/components/Status';
import {Checkbox} from '../../../../web/src/components/Primitives';
import {LoginCard} from '../../../../web/src/components/LoginCard';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/ServerAccess.css';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// Asetukset › Käyttäjät ja pääsy with a GitHub team or organisation as an
// admission source beside individually allowed people (proto-org-admission).
// The axis is where the group lives on the page: as a row of the people list,
// as its own source card above a list sectioned by source, or only as a reason
// on each person's row. What leaving does is the same in every direction and is
// what today's Poista pääsy already does: sign-in is refused, open sessions end,
// the Unix account and its files stay. Everything is synthetic.
const directions=['Ryhmä listassa','Lähteet erikseen','Syy riveillä'];
const LINES=[
 'Ryhmä listassa: tiimi on yksi rivi henkilölistan alussa, ja jokaisen rivin tiedoissa lukee, tuliko hän tiimin kautta.',
 'Lähteet erikseen: oma Pääsyn lähteet -kortti tiimille ja yksittäisille, ja henkilölista jaettu osiin lähteen mukaan.',
 'Syy riveillä: ei erillistä tiimiosiota; Salli-kenttä ottaa myös organisaation tai tiimin, rivien sirut kertovat pääsyn syyt ja lähtijä nousee ilmoitukseksi.',
];
const LIST=0,SOURCES=1,REASON=2;

// ---------- Synthetic site ----------

const ORG='northstar-demo',TEAM='kehitys',GROUP=`${ORG}/${TEAM}`;
type Team='member'|'left'|undefined;
type Person={id:string;login:string;name:string;username?:string;
 /** Allowed one by one (site_admin) or from site.json (operator). */
 individual:boolean;operator?:boolean;admin?:boolean;
 /** Removed one by one by an administrator. */
 removed?:string;
 team:Team;leftAt?:string;signedIn:boolean;lastSeen?:string;allowedAt?:string};
type Scenario='before'|'connected'|'left';
const scenarios:Record<Scenario,{label:string;hint:string}>={
 before:{label:'Ennen tiimiä',hint:'Kuten tänään: jokainen on sallittu yksitellen. Kokeile yhdistää tiimi.'},
 connected:{label:'Tiimi yhdistetty',hint:`Tiimi ${GROUP} on pääsyn lähde. Neljä jäsentä on kirjautunut, kaksi ei vielä.`},
 left:{label:'Tuuli lähti tiimistä',hint:`Tuuli poistettiin GitHubissa tiimistä 1.11. Habitat huomasi sen tunnin välein tehtävässä tarkistuksessa.`},
};
function people(s:Scenario):Person[]{
 const t=(x:Team)=>s==='before'?undefined:x;
 const ps:Person[]=[
  {id:'1001',login:'kaisa-admin',name:'Kaisa Admin',username:'kaisa',individual:true,operator:true,admin:true,team:undefined,signedIn:true,lastSeen:'2026-11-02'},
  {id:'1002',login:'aino-v',name:'Aino Virtanen',username:'aino',individual:true,team:t('member'),signedIn:true,lastSeen:'2026-11-02',allowedAt:'2026-10-14'},
  {id:'1003',login:'maija-esim',name:'Maija Esimerkki',username:'maija',individual:s==='before',team:t('member'),signedIn:true,lastSeen:'2026-11-01'},
  {id:'1004',login:'mikko-k',name:'Mikko Korhonen',username:'mikko',individual:s==='before',team:t('member'),signedIn:true,lastSeen:'2026-10-31'},
  {id:'1005',login:'tuuli-h',name:'Tuuli Heikkinen',username:'tuuli',individual:s==='before',team:s==='left'?'left':t('member'),leftAt:'2026-11-01',signedIn:true,lastSeen:'2026-10-30'},
  {id:'1006',login:'olli-p',name:'Olli Peltonen',username:'olli',individual:true,team:undefined,signedIn:true,lastSeen:'2026-10-29',allowedAt:'2026-10-20'},
  {id:'1007',login:'eero-s',name:'Eero Saari',individual:true,team:undefined,signedIn:false,allowedAt:'2026-10-28'},
  {id:'1009',login:'ville-vanha',name:'Ville Vanha',username:'ville',individual:true,removed:'2026-10-20',team:undefined,signedIn:true},
 ];
 // Team members who have not signed in yet: known from the team's member
 // list, admitted, but no account exists before their first sign-in.
 if(s!=='before')ps.splice(5,0,
  {id:'1010',login:'lauri-k',name:'Lauri Koskinen',individual:false,team:'member',signedIn:false},
  {id:'1011',login:'noora-t',name:'Noora Toivonen',individual:false,team:'member',signedIn:false});
 return ps;
}
type Stage='joined'|'allowed'|'ended';
const hasAccess=(p:Person)=>!p.removed&&(p.individual||p.team==='member');
const stage=(p:Person):Stage=>!hasAccess(p)?'ended':p.signedIn?'joined':'allowed';
const viaTeam=(p:Person)=>p.team==='member';
const leaver=(p:Person)=>p.team==='left'&&!hasAccess(p);
const day=(iso?:string)=>{if(!iso)return '';const d=new Date(iso+'T12:00:00Z');return `${d.getUTCDate()}.${d.getUTCMonth()+1}.`;};

type Group={connected:boolean;kind:'team'|'org';name:string;members:number;checked:string};

// ---------- Shared pieces: the row as production draws it ----------

function StateMark({p}:{p:Person}){
 const st=stage(p);
 if(st==='ended')return <StatusMark tone="warning" label={leaver(p)?'Pääsy päättyi':'Pääsy poistettu'}/>;
 if(st==='allowed')return <StatusMark tone="neutral" label="Ei vielä kirjautunut"/>;
 return <StatusMark tone="success" label={p.admin?'Ylläpitäjä':'Käyttäjä'}/>;
}
/** Where the person's access comes from, in words, for the facts line. */
function source(p:Person){
 if(p.operator)return 'Palvelimen asetuksista';
 if(viaTeam(p)&&p.individual)return `Tiimin ${TEAM} kautta ja henkilönä`;
 if(viaTeam(p))return `Tiimin ${TEAM} kautta`;
 if(p.individual&&!p.removed)return 'Sallittu henkilönä'+(p.allowedAt?` ${day(p.allowedAt)}`:'');
 return '';
}
function Facts({p,showSource}:{p:Person;showSource:boolean}){
 const items:React.ReactNode[]=[];
 if(showSource&&source(p))items.push(<span key="src" data-testid={`source-${p.login}`}>{source(p)}</span>);
 if(p.username)items.push(<span key="u">Unix: <code>{p.username}</code></span>);
 if(p.lastSeen&&stage(p)!=='ended')items.push(<span key="s">Viimeksi {day(p.lastSeen)}</span>);
 if(p.removed)items.push(<span key="r">Poistettu {day(p.removed)}</span>);
 if(leaver(p))items.push(<span key="l" data-testid={`left-${p.login}`}>Lähti tiimistä {TEAM} {day(p.leftAt)}</span>);
 return items.length?<span className="sa-facts">{items}</span>:null;
}
function Kept({p}:{p:Person}){
 if(stage(p)!=='ended'||!p.username)return null;
 return <span className="sa-muted" data-testid={`kept-${p.login}`}>{leaver(p)?<>Kirjautuminen estetty, istunnot päättyivät ja agentit pysäytettiin. Unix-tili <code>{p.username}</code> ja tiedostot jäivät palvelimelle.</>:<>Unix-tili <code>{p.username}</code> jää palvelimelle.</>}</span>;
}
function Reasons({p}:{p:Person}){
 const chips:[string,IconName,string][]=[];
 if(p.operator)chips.push(['server','server','palvelimen asetukset']);
 if(viaTeam(p))chips.push(['team','github',GROUP]);
 if(p.team==='left')chips.push(['left','github',`${GROUP} – lähti ${day(p.leftAt)}`]);
 if(p.individual&&!p.operator)chips.push(['individual','user',p.removed?'henkilönä – poistettu':'henkilönä']);
 return <span className="oa-chips" data-testid={`reasons-${p.login}`}>{chips.map(([k,i,t])=><span key={k} className="oa-chip" data-kind={k}><Icon name={i}/>{t}</span>)}</span>;
}
function PersonRow({p,showSource,reasons,onAllow,onRemove}:{p:Person;showSource:boolean;reasons?:boolean;onAllow:(p:Person)=>void;onRemove:(p:Person)=>void}){
 const st=stage(p);
 return <li className="sa-row" data-testid={`row-${p.login}`} data-state={st} data-left={leaver(p)?'':undefined}>
  <span className="sa-main">
   <span className="sa-who"><span className="sa-login">@{p.login}</span><span className="sa-muted">{p.name}</span><StateMark p={p}/></span>
   {reasons&&<Reasons p={p}/>}
   <Facts p={p} showSource={showSource}/>
   <Kept p={p}/>
  </span>
  <span className="sa-act">
   {p.operator?<span className="sa-note">Palvelimen asetuksista</span>
   :st==='ended'?<Button data-testid={`allow-${p.login}`} size="row" variant="secondary" onPress={()=>onAllow(p)}>{leaver(p)?'Salli henkilönä':'Palauta pääsy'}</Button>
   :p.individual?<Button size="row" variant="quiet" onPress={()=>onRemove(p)}><Icon name="cross"/>{st==='joined'?'Poista pääsy':'Poista'}</Button>
   :<span className="sa-note" title="Pääsy tulee tiimistä. Poista hänet tiimistä GitHubissa.">Tiimin jäsen</span>}
  </span>
 </li>;
}

function AddField({label,placeholder,hint,onSubmit}:{label:string;placeholder:string;hint:string;onSubmit?:(v:string)=>void}){
 const [v,setV]=useState('');
 return <form className="sa-add" data-testid="add-form" onSubmit={e=>{e.preventDefault();onSubmit?.(v.trim());}}>
  <label className="sa-field"><strong>{label}</strong>
   <span className="sa-inline"><textarea data-testid="add-input" rows={1} value={v} placeholder={placeholder} spellCheck={false} onChange={e=>setV(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.currentTarget.form?.requestSubmit();}}}/>
    <Button data-testid="add-check" size="row" type="submit" variant="secondary" isDisabled={!v.trim()}>Tarkista</Button></span>
   <span className="sa-muted">{hint}</span></label>
 </form>;
}

function groupFacts(g:Group,ps:Person[]){
 const signed=ps.filter(p=>viaTeam(p)&&p.signedIn).length;
 const members=g.name===GROUP?ps.filter(viaTeam).length:g.members;
 return `${members} jäsentä · ${signed} kirjautunut · tarkistettu ${g.checked}`;
}

// ---------- Dialogs ----------

const ORGS:{org:string;members:number;teams:{slug:string;members:number}[]}[]=[
 {org:ORG,members:14,teams:[{slug:'kehitys',members:6},{slug:'myynti',members:5},{slug:'johto',members:3}]},
 {org:'northstar-labs',members:4,teams:[{slug:'tutkimus',members:4}]},
];
function ConnectDialog({theme,initial,ps,onClose,onConnect}:{theme:string;initial?:string;ps:Person[];onClose:()=>void;onConnect:(g:Group,move:boolean)=>void}){
 const [move,setMove]=useState(true);
 const [org,setOrg]=useState(initial?.split('/')[0]&&ORGS.some(o=>o.org===initial.split('/')[0])?initial.split('/')[0]:ORG);
 const o=ORGS.find(x=>x.org===org)!;
 const [scope,setScope]=useState(initial?.split('/')[1]??'kehitys');
 const team=o.teams.find(t=>t.slug===scope);
 const name=team?`${org}/${team.slug}`:org;
 const members=team?team.members:o.members;
 // Who in the chosen group is already allowed one by one (synthetic).
 const already=org===ORG&&scope==='kehitys'?ps.filter(p=>p.individual&&!p.operator&&!p.removed&&['aino-v','maija-esim','mikko-k','tuuli-h'].includes(p.login)):[];
 return <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={x=>{if(!x)onClose();}}>
  <Modal className="ah-modal" data-theme={theme}><Dialog className="ah-dialog oa-dialog" data-testid="connect-dialog" aria-label="Yhdistä GitHub-ryhmä">
   <Heading slot="title">Yhdistä GitHub-ryhmä pääsyn lähteeksi</Heading>
   <p className="sa-muted">Organisaatiot, joihin kuulut GitHubissa. Habitat näkee ne kirjautumisesi luvalla (<code>read:org</code>).</p>
   <div className="oa-field"><strong>Organisaatio</strong>
    <Segmented data-testid="connect-org" label="Organisaatio" size="row" value={org} onChange={x=>{setOrg(x);setScope(x===ORG?'kehitys':'tutkimus');}} options={ORGS.map(x=>({id:x.org,label:x.org}))}/></div>
   <fieldset className="oa-scope" data-testid="connect-scope"><legend><strong>Ketkä pääsevät</strong></legend>
    <label><input type="radio" name="scope" checked={!team} onChange={()=>setScope('')}/> Koko organisaatio <span className="sa-muted">{o.members} jäsentä</span></label>
    {o.teams.map(t=><label key={t.slug}><input type="radio" name="scope" checked={scope===t.slug} onChange={()=>setScope(t.slug)}/> Tiimi <code>{t.slug}</code> <span className="sa-muted">{t.members} jäsentä</span></label>)}
   </fieldset>
   <ul className="sa-consequences" data-testid="connect-consequences">
    <li><Icon name="users"/><span>{members} jäsentä voi kirjautua ilman erillistä sallimista. Unix-tili luodaan ensimmäisellä kirjautumisella, kuten nytkin.</span></li>
    <li><Icon name="refresh"/><span>Jäsenyys tarkistetaan jokaisella kirjautumisella ja tunnin välein.</span></li>
    <li><Icon name="cross"/><span>Kun joku lähtee ryhmästä, hänen pääsynsä päättyy: kirjautuminen estyy, avoimet istunnot päättyvät ja agentit pysäytetään. Unix-tili ja tiedostot jäävät; tilin voi poistaa komentorivillä.</span></li>
    <li><Icon name="user"/><span>Henkilönä sallittu pitää pääsynsä, vaikka lähtisi ryhmästä.</span></li>
   </ul>
   {already.length>0&&<div className="oa-already" data-testid="connect-already"><p>{already.map(p=>'@'+p.login).join(', ')} on jo sallittu henkilönä ja kuuluu ryhmään.</p>
    <Checkbox data-testid="connect-move" label="Siirrä heidät tulemaan ryhmän kautta" checked={move} onChange={setMove}/>
    <p className="sa-muted">{move?'Heidän pääsynsä päättyy, kun he lähtevät ryhmästä. Voit sallia jonkun myöhemmin myös henkilönä.':'He pitävät pääsynsä, vaikka lähtisivät ryhmästä, kunnes poistat sen täältä.'}</p></div>}
   <div className="ah-dialog-actions"><Button size="page" variant="secondary" onPress={onClose}>Peruuta</Button>
    <Button data-testid="connect-confirm" size="page" variant="primary" onPress={()=>onConnect({connected:true,kind:team?'team':'org',name,members,checked:'juuri nyt'},move)}>Yhdistä {team?'tiimi':'organisaatio'}</Button></div>
  </Dialog></Modal></ModalOverlay>;
}
function DisconnectDialog({theme,g,ps,onClose,onConfirm}:{theme:string;g:Group;ps:Person[];onClose:()=>void;onConfirm:(keep:boolean)=>void}){
 const [keep,setKeep]=useState(false);
 const only=ps.filter(p=>viaTeam(p)&&!p.individual);
 return <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={x=>{if(!x)onClose();}}>
  <Modal className="ah-modal" data-theme={theme}><Dialog className="ah-dialog oa-dialog" data-testid="disconnect-dialog" aria-label="Irrota ryhmä">
   <Heading slot="title">Irrota {g.name}?</Heading>
   <ul className="sa-consequences">
    <li><Icon name="cross"/><span>{keep?`${only.length} henkilöä siirtyy sallituiksi henkilöinä ja pitää pääsynsä.`:`${only.length} henkilön pääsy päättyy: ${only.map(p=>'@'+p.login).join(', ')}. Unix-tilit ja tiedostot jäävät.`}</span></li>
    <li><Icon name="user"/><span>Henkilönä sallitut pitävät pääsynsä.</span></li>
   </ul>
   <Checkbox data-testid="disconnect-keep" label="Salli nykyiset jäsenet henkilöinä" checked={keep} onChange={setKeep}/>
   <div className="ah-dialog-actions"><Button size="page" variant="secondary" onPress={onClose}>Peruuta</Button>
    <Button data-testid="disconnect-confirm" size="page" variant={keep?'primary':'danger'} onPress={()=>onConfirm(keep)}>Irrota</Button></div>
  </Dialog></Modal></ModalOverlay>;
}

// ---------- The page ----------

type View='admin'|'signin-never'|'signin-left';
const adminNav:[string,string,IconName][]=[['palvelin','Palvelin','server'],['palvelinintegraatiot','Palvelinintegraatiot','plug'],['aiavain','AI-avain','key'],['kayttoonotto','Käyttöönotto','steer'],['kayttajat','Käyttäjät ja pääsy','users'],['levy','Levytila','disk']];
const ownNav:[string,IconName][]=[['Tili','user'],['Laitteet','devices'],['Agentit','agent'],['Yhteydet','link'],['Integraatiot','plug']];
let reviewTheme='light',reviewPhone=false,reviewScenario:Scenario='left',reviewView:View='admin';

function SignIn({left}:{left:boolean}){
 return <div className="oa-signin" data-testid={left?'signin-left':'signin-never'}>
  <LoginCard onLogin={()=>{}} notice={left
   ?<InlineNotice data-testid="signin-notice" tone="warning" title="Pääsysi tälle palvelimelle päättyi 1.11." description={`Pääsy tuli GitHub-tiimin ${GROUP} kautta, etkä enää kuulu siihen. Tilisi ja tiedostosi ovat tallessa palvelimella, mutta et voi kirjautua. Jos tämä on virhe, pyydä palvelimen ylläpitäjää palauttamaan pääsy.`}/>
   :<InlineNotice data-testid="signin-notice" tone="warning" title="Tunnuksellasi ei ole pääsyä tälle palvelimelle" description="Kirjauduit GitHub-tunnuksella @ville-x. Pyydä palvelimen ylläpitäjää sallimaan se. Jos pääsysi tulee organisaation kautta, tarkista, että kirjauduit oikealla GitHub-tilillä ja että organisaatio on hyväksynyt Open Habitatin."/>}/>
 </div>;
}

function App({direction}:{direction:number}){
 const [theme,setTheme]=useState(reviewTheme),[phone,setPhone]=useState(reviewPhone);
 const [view,setView]=useState<View>(reviewView);
 const [scenario,setScenario]=useState<Scenario>(reviewScenario);
 const [ps,setPs]=useState(()=>people(reviewScenario));
 const [group,setGroup]=useState<Group>(()=>({connected:reviewScenario!=='before',kind:'team',name:GROUP,members:6,checked:'10.05'}));
 const [connecting,setConnecting]=useState<string|undefined|false>(false);
 const [disconnecting,setDisconnecting]=useState(false);
 const [filter,setFilter]=useState('all');
 const [ack,setAck]=useState(false);
 const reset=(s:Scenario)=>{reviewScenario=s;setScenario(s);setPs(people(s));setGroup({connected:s!=='before',kind:'team',name:GROUP,members:6,checked:'10.05'});setAck(false);setFilter('all');};
 const allow=(p:Person)=>setPs(xs=>xs.map(x=>x.id===p.id?{...x,individual:true,removed:undefined,allowedAt:'2026-11-02'}:x));
 const remove=(p:Person)=>setPs(xs=>xs.map(x=>x.id===p.id?(x.team==='member'?{...x,individual:false}:{...x,removed:'2026-11-02'}):x));
 const connect=(g:Group,move:boolean)=>{setConnecting(false);setGroup(g);
  // Connecting kehitys: its members now come through the team. Moved, the
  // ones allowed one by one only for being in the team stop being individual
  // (the synthetic data keeps Aino as both); kept, they stay individual too.
  const before=new Set(ps.filter(p=>p.individual).map(p=>p.id));
  setPs(people(scenario==='left'?'left':'connected').map(p=>move?p:{...p,individual:p.individual||before.has(p.id)}));
  if(scenario==='before'){reviewScenario='connected';setScenario('connected');}};
 const disconnect=(keep:boolean)=>{setDisconnecting(false);setGroup(g=>({...g,connected:false}));
  setPs(xs=>xs.filter(p=>p.signedIn||!viaTeam(p)||keep).map(p=>p.team==='member'?{...p,team:undefined,individual:p.individual||keep,removed:p.individual||keep?p.removed:'2026-11-02'}:p.team==='left'?{...p,team:undefined,removed:p.removed??p.leftAt}:p));};
 const onAdd=(v:string)=>{if(v.includes('/')||ORGS.some(o=>o.org===v))setConnecting(v);};

 const rowProps={onAllow:allow,onRemove:remove};
 const count=(st:Stage)=>ps.filter(p=>stage(p)===st).length;
 const filterBar=(opts:{id:string;label:string}[])=><Segmented data-testid="access-filter" label="Näytä" size="row" value={filter} onChange={setFilter} options={opts}/>;
 const stdFilter=[{id:'all',label:'Kaikki'},{id:'joined',label:`Liittyneet ${count('joined')}`},{id:'allowed',label:`Ei kirjautuneet ${count('allowed')}`},{id:'ended',label:`Poistetut ${count('ended')}`}];
 const stdShown=ps.filter(p=>filter==='all'||stage(p)===filter);
 const leavers=ps.filter(leaver);

 // Direction 1: the team is a row at the top of the people list.
 const groupRow=group.connected&&<li className="sa-row oa-grouprow" data-testid="group-row">
  <span className="sa-main"><span className="sa-who"><Icon name="users"/><span className="sa-login">{group.name}</span><StatusMark tone="success" label={group.kind==='team'?'GitHub-tiimi':'GitHub-organisaatio'}/></span>
   <span className="sa-facts">{groupFacts(group,ps)}</span>
   <span className="sa-muted">Jäsenet pääsevät sisään ilman erillistä sallimista. Lähtijän pääsy päättyy; Unix-tili ja tiedostot jäävät.</span></span>
  <span className="sa-act"><Button data-testid="group-disconnect" size="row" variant="quiet" onPress={()=>setDisconnecting(true)}>Irrota…</Button></span>
 </li>;
 const listMain=<div className="s-card"><div className="sa">
  <div className="s-row"><AddField label="Salli GitHub-tunnus" placeholder="github-tunnus, toinen-tunnus" hint="Useita nimiä voi erottaa pilkulla, välilyönnillä tai rivinvaihdolla."/>
   {!group.connected&&<div className="oa-connect-line"><Button data-testid="connect-open" size="row" variant="secondary" onPress={()=>setConnecting(undefined)}><Icon name="users"/>Yhdistä GitHub-tiimi tai organisaatio…</Button></div>}</div>
  <div className="s-row sa-head"><strong>Henkilöt <span className="sa-muted">{ps.length}</span></strong>{filterBar(stdFilter)}</div>
  <ul className="sa-list" data-testid="access-list">{filter==='all'&&groupRow}{stdShown.map(p=><PersonRow key={p.id} p={p} showSource={group.connected} {...rowProps}/>)}</ul>
 </div></div>;

 // Direction 2: a source card above, the list in sections by source.
 const sections:[string,string,Person[]][]=group.connected?[
  ['team',`Tiimin ${group.name} kautta`,ps.filter(p=>hasAccess(p)&&viaTeam(p))],
  ['individual','Henkilöinä',ps.filter(p=>hasAccess(p)&&!viaTeam(p))],
  ['ended','Pääsy päättynyt',ps.filter(p=>!hasAccess(p))],
 ]:[['individual','Henkilöinä',ps.filter(hasAccess)],['ended','Pääsy päättynyt',ps.filter(p=>!hasAccess(p))]];
 const sourcesMain=<div className="oa-stack">
  <div className="s-card sa" data-testid="sources-card">
   <div className="s-row oa-cardhead"><strong>Pääsyn lähteet</strong><span className="sa-muted">Kuka tahansa näistä voi kirjautua. Jäsenyys tarkistetaan kirjautuessa ja tunnin välein.</span></div>
   {group.connected?<div className="s-row oa-source" data-testid="source-group">
    <div className="s-lbl"><strong><Icon name="github"/> {group.kind==='team'?'GitHub-tiimi':'GitHub-organisaatio'} <code>{group.name}</code></strong>
     <span className="s-desc">{groupFacts(group,ps)}. Lähtijän pääsy päättyy; Unix-tili ja tiedostot jäävät.</span></div>
    <div className="s-val"><StatusMark tone="success" label="Yhdistetty"/><Button data-testid="group-disconnect" size="row" variant="quiet" onPress={()=>setDisconnecting(true)}>Irrota…</Button></div>
   </div>:<div className="s-row oa-source"><div className="s-lbl"><strong>GitHub-tiimi tai organisaatio</strong><span className="s-desc">Ryhmän jäsenet pääsevät sisään ilman, että sallit heidät yksitellen.</span></div>
    <div className="s-val"><Button data-testid="connect-open" size="row" variant="secondary" onPress={()=>setConnecting(undefined)}>Yhdistä…</Button></div></div>}
   <div className="s-row"><AddField label="Salli yksittäinen GitHub-tunnus" placeholder="github-tunnus, toinen-tunnus" hint="Esimerkiksi ulkopuolinen konsultti. Henkilönä sallittu pitää pääsynsä, vaikka lähtisi ryhmästä."/></div>
  </div>
  <div className="s-card sa" data-testid="access-list">
   <div className="s-row sa-head"><strong>Henkilöt <span className="sa-muted">{ps.length}</span></strong></div>
   {sections.filter(([,,xs])=>xs.length).map(([k,title,xs])=><div key={k} className="oa-section" data-testid={`section-${k}`}>
    <h3 className="oa-subhead">{title} <span className="sa-muted">{xs.length}</span></h3>
    <ul className="sa-list">{xs.map(p=><PersonRow key={p.id} p={p} showSource={k==='team'&&p.individual||p.operator===true} {...rowProps}/>)}</ul></div>)}
  </div>
 </div>;

 // Direction 3: one field for people and groups, reasons as chips, the
 // leaver raised as a notice above the list.
 const rFilter=[{id:'all',label:'Kaikki'},{id:'team',label:'Tiimin kautta'},{id:'individual',label:'Henkilöinä'},{id:'ended',label:`Päättyneet ${count('ended')}`}];
 const rShown=ps.filter(p=>filter==='all'||(filter==='team'?viaTeam(p):filter==='individual'?p.individual&&!p.removed:stage(p)==='ended'));
 const reasonMain=<div className="oa-stack">
  {leavers.length>0&&!ack&&<div data-testid="leaver-notice"><InlineNotice tone="warning" title={`${leavers.map(p=>p.name).join(', ')} lähti tiimistä ${TEAM} ${day(leavers[0].leftAt)}`} description={`Pääsy päättyi automaattisesti: kirjautuminen estetty, istunnot päättyivät ja agentit pysäytettiin. Unix-tili ${leavers.map(p=>p.username).join(', ')} ja tiedostot jäivät palvelimelle.`} actions={[{label:'Salli henkilönä',onPress:()=>leavers.forEach(allow)},{label:'Selvä',onPress:()=>setAck(true)}] as never}/></div>}
  <div className="s-card"><div className="sa">
   <div className="s-row"><AddField label="Salli GitHub-tunnus, organisaatio tai tiimi" placeholder="github-tunnus tai organisaatio/tiimi" hint={`Esimerkiksi aino-v tai ${GROUP}. Ryhmän jäsenet pääsevät sisään niin kauan kuin kuuluvat siihen.`} onSubmit={onAdd}/>
    {group.connected&&<p className="sa-muted oa-groupline" data-testid="group-line"><Icon name="github"/><span>Yhdistetty: <code>{group.name}</code> · {groupFacts(group,ps)}</span><Button data-testid="group-disconnect" size="inline" variant="quiet" onPress={()=>setDisconnecting(true)}>Irrota…</Button></p>}</div>
   <div className="s-row sa-head"><strong>Henkilöt <span className="sa-muted">{ps.length}</span></strong>{filterBar(rFilter)}</div>
   <ul className="sa-list" data-testid="access-list">{rShown.map(p=><PersonRow key={p.id} p={p} showSource={false} reasons {...rowProps}/>)}</ul>
  </div></div>
 </div>;

 const adminMain=<><p className="muted mobilecrumb">Asetukset › Käyttäjät ja pääsy</p><h2>Käyttäjät ja pääsy</h2>
  {direction===LIST?listMain:direction===SOURCES?sourcesMain:reasonMain}</>;
 const viewOpts:[View,string][]=[['admin','Ylläpitäjän pääsysivu'],['signin-never','Kirjautuminen: ei pääsyä'],['signin-left','Kirjautuminen: lähti tiimistä']];
 return <div data-theme={theme} className={phone?'review phone':'review'}>
  <header className="reviewbar"><strong>Pääsy organisaation kautta</strong>
   <label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
   <label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);}}/> 390 px</label>
   <p>Synteettiset henkilöt ja ryhmät. Mitään ei lähetetä.</p></header>
  <ol className="oa-lines" data-testid="direction-lines">{LINES.map((l,i)=><li key={i} aria-current={i===direction?'true':undefined}>{l}</li>)}</ol>
  <p className="axis">Akseli: missä ryhmä elää pääsysivulla. Lähteminen toimii kaikissa samoin kuin nykyinen Poista pääsy: kirjautuminen estyy, tili ja tiedostot jäävät. Suositus: Lähteet erikseen.</p>
  <div className="scenario"><span className="muted">Näkymä</span><Segmented data-testid="view" label="Näkymä" size="row" options={viewOpts.map(([id,label])=>({id,label}))} value={view} onChange={v=>{reviewView=v;setView(v);}}/></div>
  {view==='admin'&&<div className="scenario"><span className="muted">Tilanne</span><Segmented data-testid="scenario" label="Tilanne" size="row" options={(Object.keys(scenarios) as Scenario[]).map(s=>({id:s,label:scenarios[s].label}))} value={scenario} onChange={reset}/>
   <span className="muted" data-testid="scenario-hint">{scenarios[scenario].hint}</span></div>}
  <div className={`shell variant-${direction}`}>
   {view==='admin'?<><div className="hostbar"><strong>Open Habitat</strong><span>Kaisa Admin · ylläpitäjä</span><Icon name="user"/></div>
    <section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>
     {ownNav.map(([n,i])=><span className="s-nav-i" key={n}><Icon name={i}/>{n}</span>)}
     <span className="s-nav-h">Palvelimen ylläpito</span>{adminNav.map(([id,n,i])=><span className="s-nav-i" key={id} aria-current={id==='kayttajat'?'page':undefined}><Icon name={i}/>{n}</span>)}
    </nav><main className="s-main">{adminMain}</main></section></>
   :<SignIn left={view==='signin-left'}/>}
  </div>
  {connecting!==false&&<ConnectDialog theme={theme} initial={connecting} ps={ps} onClose={()=>setConnecting(false)} onConnect={connect}/>}
  {disconnecting&&<DisconnectDialog theme={theme} g={group} ps={ps} onClose={()=>setDisconnecting(false)} onConfirm={disconnect}/>}
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
