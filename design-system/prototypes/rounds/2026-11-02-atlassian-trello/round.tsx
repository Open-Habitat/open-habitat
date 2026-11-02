import React, {useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, controlClassName, ExternalLink, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon, type IconName} from '../../../../web/src/components/Icon';
import {StatusMark} from '../../../../web/src/components/Status';
import {Checkbox, TextField} from '../../../../web/src/components/Primitives';
import {AccountCard, GrantLimits, LetterMark} from '../../../../web/src/components/Integrations';
import type {Account} from '../../../../web/src/app/integrations';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/Integrations.css';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');

// Asetukset › Tiedot agenteille with Jira and Confluence (Atlassian's own
// remote MCP, the person's own OAuth sign-in kept by Pi) and Trello (the
// person's own REST token in a settings form, used by curl), as
// research-atlassian-trello recommends: read and search first, writing a
// separate choice promised only where the provider enforces it, and the
// organisation's approval shown as what it is. The axis is where approval and
// the read/write limit live on the page: inside an ordinary account card, in
// one table that names who enforces each limit, or as a path of steps per
// connection. Dialogs and every fact are the same in all three. Synthetic.
const directions=['Tilikortti','Oikeustaulu','Hyväksyntäpolku'];
const LINES=[
 'Tilikortti: Atlassian ja Trello ovat tavallisia tilikortteja Googlen rinnalla; hyväksyntä on kortin ilmoitus ja raja kortin tasomerkki.',
 'Oikeustaulu: Jira, Confluence ja Trello yhdessä taulukossa, jonka sarakkeet kertovat, mitä agentti voi tehdä ja kuka rajan asettaa.',
 'Hyväksyntäpolku: jokainen yhteys vaiheina – sinä kirjaudut, organisaatio sallii, agentti lukee, kirjoitus erikseen – ja ylläpitäjän pyyntö näkyvissä.',
];
const CARD=0,TABLE=1,PATH=2;

// ---------- Synthetic person and services ----------

const SITE='contoso-demo.atlassian.net',ME='aino.virtanen@contoso.example',TRELLO='@ainovirtanen';
const RETURN='http://localhost:33418/callback',EGRESS='203.0.113.24';
type A='none'|'pending'|'refused'|'read'|'write'|'revoked';
type T='none'|'read'|'write'|'expired';
type Scenario='none'|'pending'|'refused'|'read'|'write'|'expired';
const scenarios:Record<Scenario,{label:string;a:A;t:T;hint:string}>={
 none:{label:'Ei yhdistetty',a:'none',t:'none',hint:'Kokeile yhdistää Atlassian ja Trello. Ensimmäinen Atlassian-kirjautuminen jää odottamaan Contosoia.'},
 pending:{label:'Odottaa hyväksyntää',a:'pending',t:'read',hint:'Aino kirjautui Atlassianiin, mutta Contosoin ylläpitäjä ei ole vielä sallinut yhteyttä. Trello toimii lukuoikeudella. Kokeile Tarkista: ylläpitäjä on nyt sallinut.'},
 refused:{label:'Hylätty',a:'refused',t:'read',hint:'Contosoin ylläpitäjä on sulkenut Atlassianin MCP-yhteyden organisaatiossa. Atlassian kertoo eston, ei syytä.'},
 read:{label:'Vain luku',a:'read',t:'read',hint:'Kumpikin palvelu estää kirjoituksen itse: Atlassian, koska kirjautumisessa myönnettiin vain luku ja haku; Trello, koska tokenin oikeus on read.'},
 write:{label:'Kirjoitus sallittu',a:'write',t:'write',hint:'Aino valitsi kirjoituksen. Contoso sallii sen Jiraan mutta ei Confluenceen; Trello-token on read,write.'},
 expired:{label:'Vanhentunut tai peruttu',a:'revoked',t:'expired',hint:'Atlassian-kirjautuminen on peruttu (Atlassian-tililtä tai 90 päivää käyttämättä). Trello-token vanheni 30 päivän jälkeen.'},
};
const google:Account={provider:'google',address:'aino.koti@example.test',checked_at:'2026-11-02T08:05:00Z',services:[{id:'mail',state:'ok'},{id:'calendar',state:'ok'},{id:'contacts',state:'ok'}]} as Account;

type Product='jira'|'confluence'|'trello';
const productName:Record<Product,string>={jira:'Jira',confluence:'Confluence',trello:'Trello'};
const productIcon:Record<Product,IconName>={jira:'table',confluence:'file',trello:'grid'};
const readText:Record<Product,string>={jira:'Hakee ja lukee työasioita ja niiden kommentteja',confluence:'Hakee ja lukee sivuja ja kommentteja',trello:'Hakee ja lukee tauluja, listoja, kortteja ja kommentteja'};
const writeText:Record<Product,string>={jira:'luo ja muokkaa työasioita, kommentoi ja siirtää tilaa',confluence:'luo ja muokkaa sivuja ja kommentoi',trello:'luo, siirtää ja päivittää kortteja ja kommentoi'};

/** What the agent can do in one product, and who holds the limit. */
type Conn='none'|'ok'|'pending'|'refused'|'revoked'|'expired';
type Cap={conn:Conn;read:boolean;write:'yes'|'self'|'org'|'token'|'none';limit:string};
function cap(a:A,t:T,p:Product):Cap{
 if(p==='trello')switch(t){
  case 'none':return {conn:'none',read:false,write:'none',limit:''};
  case 'read':return {conn:'ok',read:true,write:'token',limit:'Trello: tokenin oikeus on read'};
  case 'write':return {conn:'ok',read:true,write:'yes',limit:'Trello: tokenin oikeus on read,write'};
  case 'expired':return {conn:'expired',read:false,write:'none',limit:'Trello: token vanheni 1.11.'};
 }
 switch(a){
  case 'none':return {conn:'none',read:false,write:'none',limit:''};
  case 'pending':return {conn:'pending',read:false,write:'none',limit:'Contoso: ylläpitäjä ei ole vielä sallinut'};
  case 'refused':return {conn:'refused',read:false,write:'none',limit:'Contoso: MCP-yhteys suljettu organisaatiossa'};
  case 'revoked':return {conn:'revoked',read:false,write:'none',limit:'Atlassian: kirjautuminen peruttu'};
  case 'read':return {conn:'ok',read:true,write:'self',limit:'Atlassian: myönsit vain luvun ja haun'};
  case 'write':return p==='jira'?{conn:'ok',read:true,write:'yes',limit:'Contoso sallii kirjoituksen Jiraan'}:{conn:'ok',read:true,write:'org',limit:'Contoso estää kirjoituksen Confluenceen'};
 }
}
const writeWhy={self:'Et myöntänyt kirjoitusta kirjautuessa',org:'Contosoin ylläpitäjä estää',token:'Token on vain luku',yes:'',none:''};
const connMark=(c:Conn,read?:boolean)=>c==='ok'?<StatusMark kind="success" tone="success" label={read===false?'Ei käytössä':'Toimii'}/>
 :c==='pending'?<StatusMark tone="warning" label="Odottaa Contosoia"/>
 :c==='refused'?<StatusMark kind="error" tone="danger" label="Contoso estää"/>
 :c==='revoked'?<StatusMark kind="error" tone="danger" label="Kirjautuminen peruttu"/>
 :c==='expired'?<StatusMark kind="error" tone="danger" label="Token vanhentunut"/>
 :<StatusMark label="Ei yhdistetty"/>;

// ---------- Shared pieces ----------

const REQUEST=`Hei! Haluan käyttää Jiraa ja Confluencea Open Habitatin agentilla omilla tunnuksillani (${ME}). Atlassian Administrationissa, kohdassa Connectors › Atlassian MCP server:

1. Salli asiakkaan paluuosoitteen domain: localhost (Pi-agentin kirjautuminen, paluuosoite ${RETURN}).
2. Jos IP-rajaus on käytössä, lisää Habitat-palvelimen osoite ${EGRESS}.
3. Permissions: Jira ja Confluence, Read ja Search päälle. Write voi jäädä pois.

Agentti toimii minun oikeuksillani eikä näe mitään, mihin minulla ei ole pääsyä. API-token-kirjautumista ei tarvitse sallia.`;

function CopyRequest({size='row'}:{size?:'row'|'inline'}){
 const [done,setDone]=useState(false);
 return <Button data-testid="copy-request" size={size} variant="secondary" onPress={()=>{navigator.clipboard?.writeText(REQUEST).catch(()=>{});setDone(true);}}>
  <Icon name={done?'check':'copy'}/>{done?'Kopioitu':'Kopioi pyyntö ylläpitäjälle'}</Button>;
}
function RequestText(){
 return <div className="at-request" data-testid="admin-request"><pre>{REQUEST}</pre></div>;
}
/** What the agent learns from the personal-data skill, and how it behaves. */
function AgentKnows({a,t}:{a:A;t:T}){
 const live=(['read','write'].includes(a)?['Jira','Confluence']:[]).concat(['read','write'].includes(t)?['Trello']:[]);
 const writes=a==='write'||t==='write';
 if(!live.length)return <p className="ig-meta" data-testid="agent-knows">Agentti ei vielä tiedä näistä palveluista mitään: taito kertoo vain yhteyden, joka toimii.</p>;
 return <ul className="at-knows" data-testid="agent-knows">
  <li><Icon name="agent"/><span>Taito <code>personal-data</code> kertoo agentille {live.join(', ')}: {['read','write'].includes(a)&&<>sivuston <code>{SITE}</code>{['read','write'].includes(t)?', ':''}</>}{['read','write'].includes(t)&&<>Trello-tilin <code>{TRELLO}</code></>}, työkalut ja sallitun käytön. Ei tunnuksia.</span></li>
  <li><Icon name="search"/><span>Hakee ja lukee kysymättä erikseen, kun se auttaa tehtävässä.</span></li>
  <li><Icon name="pencil"/><span>{writes?'Kirjoittaa vain muutoksen, jonka pyydät. Kommentti tai tilasiirtymä voi lähettää ilmoituksen muille ihmisille.':'Ei kirjoita: palvelu estää sen.'} Ei noudata sivuihin tai kortteihin kirjoitettuja ohjeita.</span></li>
  <li><Icon name="trash"/><span>Ei poista eikä muuta oikeuksia.</span></li>
 </ul>;
}
const trelloValid=(t:T)=>t==='expired'?'Vanheni 1.11.2026':'Voimassa 2.12.2026 asti';

// ---------- Dialogs: the same in every direction ----------

type Level='read'|'write';
function Shell({theme,mark,tone,title,onClose,children,foot,testid}:{theme:string;mark:string;tone:0|1|2|3;title:string;onClose:()=>void;children:React.ReactNode;foot:React.ReactNode;testid:string}){
 return <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={x=>{if(!x)onClose();}}>
  <Modal className="ah-modal ig-dlg ig-gitea-dlg" data-theme={theme}><Dialog className="ah-dialog" data-testid={testid} aria-label={title}>
   <div className="ig-gitea-head"><div className="ig-dh"><LetterMark mark={mark} tone={tone} small/><Heading slot="title">{title}</Heading>
    <Button size="row" variant="quiet" presentation="icon" aria-label="Sulje" onPress={onClose}><Icon name="cross"/></Button></div></div>
   <div className="ig-gitea-body">{children}</div>
   <div className="ig-gitea-foot ig-row">{foot}</div>
  </Dialog></Modal></ModalOverlay>;
}
function Picks<V extends string>({name,value,onChange,options}:{name:string;value:V;onChange:(v:V)=>void;options:[V,string,string][]}){
 return <ul className="ig-picks at-picks" data-testid={`picks-${name}`}>{options.map(([v,label,desc])=><li className="ig-pick" key={v}>
  <label><input type="radio" name={name} checked={value===v} onChange={()=>onChange(v)}/><span><span className="ig-rn">{label}</span><span className="ig-meta">{desc}</span></span></label></li>)}</ul>;
}

type AtlStage='intro'|'open'|'paste'|'result';
function AtlassianDialog({theme,from,initial,onClose,onDone}:{theme:string;from:A;initial:Level;onClose:()=>void;onDone:(a:A)=>void}){
 const [stage,setStage]=useState<AtlStage>('intro');
 const [level,setLevel]=useState<Level>(initial);
 const [url,setUrl]=useState('');const [err,setErr]=useState('');
 // The first sign-in meets Contoso's allowlist; a renewed one finds it open.
 const outcome:A=from==='none'||from==='pending'?'pending':from==='refused'?'refused':level;
 const title=from==='revoked'?'Kirjaudu uudelleen Atlassianiin':from==='read'||from==='write'?'Vaihda Atlassian-yhteyden tasoa':'Yhdistä Jira ja Confluence';
 let body:React.ReactNode,foot:React.ReactNode;
 if(stage==='intro'){
  body=<>
   <p className="ig-p">Kirjaudut Atlassianiin omalla tunnuksellasi. Agentti käyttää Atlassianin omaa MCP-palvelua sinun oikeuksillasi; Habitat ei välitä kutsuja eikä säilytä tunnuksia. Kirjautumisen tallentaa Pi kotihakemistoosi.</p>
   <Picks name="atl-level" value={level} onChange={setLevel} options={[
    ['read','Lue ja hae','Agentti hakee ja lukee työasioita ja sivuja. Et myönnä kirjoitusoikeutta, joten Atlassian estää kirjoituksen.'],
    ['write','Lue, hae ja kirjoita, missä Contoso sallii','Agentti voi myös luoda ja muokata työasioita ja sivuja, kun pyydät. Contosoin ylläpitäjä päättää tuotteittain, sallitaanko kirjoitus.']]}/>
   <div className="ig-expect" role="note" data-testid="atl-approval-note"><Icon name="info"/><div><strong>Contosoin hyväksyntä</strong>Atlassian päästää yhteyden läpi vasta, kun Contosoin ylläpitäjä on sallinut sen. Jos sitä ei ole tehty, näet sen kirjautumisen jälkeen ja saat valmiin pyynnön ylläpitäjälle.</div></div>
   <p className="ig-fine">Haku Atlassianin MCP:n kautta kuluttaa Contosoin Rovo-krediittejä. Agentti ei näe mitään, mihin sinulla ei ole Jirassa tai Confluencessa pääsyä.</p></>;
  foot=<><Button size="page" variant="secondary" onPress={onClose}>Peruuta</Button><Button data-testid="atl-continue" size="page" variant="primary" onPress={()=>setStage('open')}>Jatka Atlassianiin</Button></>;
 }else if(stage==='open'||stage==='paste'){
  body=<form className="ig-flow-form" onSubmit={e=>{e.preventDefault();}}>
   <p className="ig-h">{stage==='open'?'Kirjaudu Atlassianissa':'Liitä Atlassianin viimeisen sivun osoite'}</p>
   <div className="ig-expect" role="note"><Icon name="info"/><div><strong>Viimeinen sivu ei aukea – se kuuluu asiaan.</strong>Atlassian ohjaa lopuksi osoitteeseen <code>{RETURN}</code>, joka ei toimi tässä selaimessa. Kopioi se osoiteriviltä ja liitä tähän.</div></div>
   {stage==='open'?<div className="ig-row start"><a data-testid="atl-open" className={`${controlClassName({variant:'primary',size:'page',text:true})} ig-open`} href="#atlassian" onClick={e=>{e.preventDefault();setStage('paste');}}><Icon name="external"/>Avaa Atlassian</a></div>
   :<><ol className="ig-how"><li>Hyväksy Atlassianin välilehdellä {level==='read'?'luku- ja hakuoikeudet':'luku-, haku- ja kirjoitusoikeudet'} sivustolle {SITE}.</li><li>Kopioi avautumattoman sivun osoite.</li></ol>
    <TextField data-testid="atl-return" label="Paluuosoite" value={url} onChange={v=>{setUrl(v);setErr('');}} mono/>
    {err&&<p className="ig-err" role="alert"><Icon name="warning"/><span>{err}</span></p>}</>}
  </form>;
  foot=<><Button size="page" variant="secondary" onPress={onClose}>Peruuta</Button>{stage==='paste'&&<Button data-testid="atl-submit" size="page" variant="primary" onPress={()=>{if(!url.startsWith(RETURN))return setErr(`Osoitteen pitää alkaa ${RETURN}`);setStage('result');}}>Yhdistä</Button>}</>;
 }else{
  body=outcome==='pending'?<>
   <p className="ig-result bad" role="status" data-testid="atl-result" data-outcome="pending"><Icon name="warning"/><span><b>Kirjauduit, mutta Contoso ei vielä päästä yhteyttä läpi.</b> Atlassian vastasi, ettei tätä asiakasta ole sallittu organisaation MCP-asetuksissa.</span></p>
   <p className="ig-p">Kirjautumisesi on tallessa. Lähetä pyyntö Contosoin Atlassian-ylläpitäjälle; kun hän on sallinut yhteyden, paina kortissa Tarkista.</p>
   <RequestText/><div className="ig-row start"><CopyRequest/></div></>
  :outcome==='refused'?<p className="ig-result bad" role="status" data-testid="atl-result" data-outcome="refused"><Icon name="warning"/><span>Contoso on yhä estänyt Atlassianin MCP-yhteyden.</span></p>
  :<><p className="ig-result ok" role="status" data-testid="atl-result" data-outcome={outcome}><Icon name="check"/><span><b>{ME}</b> · {SITE}</span></p>
   <dl className="gl-done at-dl"><dt>Jira</dt><dd>{outcome==='write'?'Lukee, hakee ja kirjoittaa':'Lukee ja hakee'}</dd><dt>Confluence</dt><dd>{outcome==='write'?'Lukee ja hakee – Contoso estää kirjoituksen':'Lukee ja hakee'}</dd></dl>
   <p className="ig-p">Uudet keskustelut näkevät yhteyden heti.</p></>;
  foot=<Button data-testid="atl-done" size="page" variant="primary" onPress={()=>onDone(outcome)}>Valmis</Button>;
 }
 return <Shell theme={theme} mark="A" tone={2} title={title} onClose={onClose} foot={foot} testid="atl-dialog">{body}</Shell>;
}

function TrelloDialog({theme,replace,initial,onClose,onDone}:{theme:string;replace:boolean;initial:Level;onClose:()=>void;onDone:(t:T)=>void}){
 const [level,setLevel]=useState<Level>(initial);
 const [token,setToken]=useState('');const [show,setShow]=useState(false);
 const [err,setErr]=useState('');const [done,setDone]=useState(false);
 const scope=level==='read'?'read':'read,write';
 const href=`https://trello.com/1/authorize?expiration=30days&name=Open%20Habitat&scope=${scope}&response_type=token&key=…`;
 const title=done?'Trello yhdistetty':replace?'Anna uusi Trello-token':'Yhdistä Trello';
 const body=done?<>
  <p className="ig-result ok" role="status" data-testid="trello-result" data-level={level}><Icon name="check"/><span><b>{TRELLO}</b> · Trello</span></p>
  <dl className="gl-done at-dl" data-testid="trello-facts"><dt>Oikeus</dt><dd>{level==='read'?'Vain luku – Trello vahvisti tokenin oikeudeksi read':'Luku ja kirjoitus – Trello vahvisti read,write'}</dd>
   <dt>Voimassa</dt><dd>2.12.2026 asti (30 päivää). Sen jälkeen annat uuden tokenin.</dd><dt>Taulut</dt><dd>12 taulua kahdessa Workspacessa</dd></dl>
  <p className="ig-p">Token on vain kotihakemistossasi. Agentti käyttää sitä curlin kautta eikä näe itse tokenia.</p></>
 :<form className="ig-flow-form" noValidate onSubmit={e=>e.preventDefault()}>
  <p className="ig-h">1. Mitä agentti saa tehdä</p>
  <Picks name="trello-level" value={level} onChange={setLevel} options={[
   ['read','Vain luku','Trello antaa tokenin oikeudella read ja estää kirjoituksen.'],
   ['write','Luku ja kirjoitus','Oikeus read,write. Agentti luo, siirtää ja päivittää kortteja ja kommentoi, kun pyydät.']]}/>
  <p className="ig-h">2. Hae token Trellosta</p>
  <p className="ig-p"><ExternalLink data-testid="trello-authorize" href={href} target="_blank" rel="noreferrer">Avaa Trellon hyväksyntäsivu <Icon name="external" width={13} height={13}/></ExternalLink></p>
  <p className="ig-fine">Sivu pyytää lupaa nimellä Open Habitat, oikeudella <code>{scope}</code>, voimassa 30 päivää. Hyväksy ja kopioi sivun näyttämä token.</p>
  <p className="ig-h">3. Liitä token</p>
  <label className="s-field" data-field="token"><span>Trello-token</span>
   <span className="ig-gitea-line"><input data-testid="trello-token" className="ah-mono" type={show?'text':'password'} autoComplete="off" spellCheck={false} placeholder="ATTA…" value={token} onChange={e=>{setToken(e.target.value);setErr('');}} aria-invalid={err?true:undefined}/>
    <Button size="row" variant="quiet" onPress={()=>setShow(s=>!s)}>{show?'Piilota':'Näytä'}</Button></span></label>
  {err&&<p className="ig-err" role="alert" data-testid="trello-error"><Icon name="warning"/><span>{err}</span></p>}
  <div className="ig-warn" role="note"><Icon name="shield"/><div><strong>Token avaa kaikki Trello-taulusi.</strong> Se toimii sinun oikeuksillasi kaikissa tauluissa, joihin sinulla on pääsy, ei vain valituissa. Token tallennetaan vain kotihakemistoosi tiedostoon, jota vain sinä voit lukea. Älä liitä sitä keskusteluun: agentti ei tarvitse sitä.</div></div>
 </form>;
 const foot=done?<Button data-testid="trello-done" size="page" variant="primary" onPress={()=>onDone(level)}>Valmis</Button>
  :<><Button size="page" variant="secondary" onPress={onClose}>Peruuta</Button><Button data-testid="trello-submit" size="page" variant="primary" onPress={()=>{if(!token.trim())return setErr('Liitä token Trellon hyväksyntäsivulta.');setToken('');setDone(true);}}>{replace?'Vaihda token':'Yhdistä'}</Button></>;
 return <Shell theme={theme} mark="T" tone={1} title={title} onClose={onClose} foot={foot} testid="trello-dialog">{body}</Shell>;
}

function RemoveDialog({theme,what,onClose,onConfirm}:{theme:string;what:'atl'|'trello';onClose:()=>void;onConfirm:()=>void}){
 const [revoke,setRevoke]=useState(true);
 const atl=what==='atl';
 return <Shell theme={theme} mark={atl?'A':'T'} tone={atl?2:1} title={atl?'Poista Atlassian-yhteys?':'Poista Trello-yhteys?'} onClose={onClose} testid="remove-dialog"
  foot={<><Button size="page" variant="secondary" onPress={onClose}>Peruuta</Button><Button data-testid="remove-confirm" size="page" variant="danger" onPress={onConfirm}>Poista</Button></>}>
  {atl?<><p className="ig-p">Pi:n tallentama Atlassian-kirjautuminen poistetaan kotihakemistostasi, eikä agentti enää pääse Jiraan eikä Confluenceen.</p>
   <p className="ig-p">Atlassian muistaa myönnetyn luvan, kunnes perut sen Atlassian-tililläsi: <ExternalLink href="https://id.atlassian.com/manage-profile/apps" target="_blank" rel="noreferrer">Atlassian-tili › Yhdistetyt sovellukset <Icon name="external" width={13} height={13}/></ExternalLink></p></>
  :<><p className="ig-p">Token poistetaan kotihakemistostasi, eikä agentti enää pääse Trelloon.</p>
   <div data-testid="remove-revoke"><Checkbox label="Peru token myös Trellossa" checked={revoke} onChange={setRevoke}/></div>
   <p className="ig-fine">{revoke?'Habitat pyytää Trelloa mitätöimään tokenin, joten sitä ei voi käyttää enää mistään.':'Token toimii Trellossa vanhenemiseensa asti 2.12.2026, jos se on tallessa muualla.'}</p></>}
 </Shell>;
}

// ---------- The page ----------

const ownNav:[string,IconName][]=[['Tili','user'],['Laitteet','devices'],['Avaimet','key'],['Tekoäly','agent'],['Tilannekatsaus','recap'],['Sanelu','mic'],['Koodipalvelut','code'],['Tiedot agenteille','plug'],['Omat koneet','laptop'],['Ulkoasu','eye'],['Editori','editor'],['Tallennustila','disk'],['Kokeelliset ominaisuudet','flask']];
let reviewTheme='light',reviewPhone=false,reviewScenario:Scenario='pending';
type Open={kind:'atl';initial:Level}|{kind:'trello';replace:boolean;initial:Level}|{kind:'remove';what:'atl'|'trello'}|null;

function App({direction}:{direction:number}){
 const [theme,setTheme]=useState(reviewTheme),[phone,setPhone]=useState(reviewPhone);
 const [scenario,setScenario]=useState<Scenario>(reviewScenario);
 const [a,setA]=useState<A>(scenarios[reviewScenario].a),[t,setT]=useState<T>(scenarios[reviewScenario].t);
 const [aLevel,setALevel]=useState<Level>(scenarios[reviewScenario].a==='write'?'write':'read');
 const [checked,setChecked]=useState('klo 10.05');
 const [open,setOpen]=useState<Open>(null);
 const reset=(s:Scenario)=>{reviewScenario=s;setScenario(s);setA(scenarios[s].a);setT(scenarios[s].t);setALevel(scenarios[s].a==='write'?'write':'read');setChecked('klo 10.05');};
 // In the pending story, the administrator has meanwhile allowed it.
 const check=()=>{setChecked('juuri nyt');if(a==='pending')setA(aLevel);};
 const act={
  connectAtl:()=>setOpen({kind:'atl',initial:'read'}),
  levelAtl:()=>setOpen({kind:'atl',initial:a==='write'?'read':'write'}),
  reauthAtl:()=>setOpen({kind:'atl',initial:aLevel}),
  removeAtl:()=>setOpen({kind:'remove',what:'atl'}),
  connectTrello:()=>setOpen({kind:'trello',replace:false,initial:'read'}),
  replaceTrello:()=>setOpen({kind:'trello',replace:true,initial:t==='write'?'write':'read'}),
  removeTrello:()=>setOpen({kind:'remove',what:'trello'}),
 };
 const atlActions=(where:string)=><>
  {a==='revoked'&&<Button data-testid={`atl-reauth-${where}`} size="row" variant="primary" onPress={act.reauthAtl}>Kirjaudu uudelleen</Button>}
  {(a==='read'||a==='write')&&<Button data-testid={`atl-level-${where}`} size="row" variant="secondary" onPress={act.levelAtl}>{a==='read'?'Salli kirjoitus…':'Vain luku…'}</Button>}
  {a!=='revoked'&&<Button data-testid={`atl-check-${where}`} size="row" variant="quiet" onPress={check}><Icon name="refresh"/>Tarkista</Button>}
  <Button data-testid={`atl-remove-${where}`} size="row" variant="quiet" onPress={act.removeAtl}>Poista…</Button></>;
 const trelloActions=(where:string)=><>
  {t==='expired'?<Button data-testid={`trello-replace-${where}`} size="row" variant="primary" onPress={act.replaceTrello}>Anna uusi token</Button>
   :<Button data-testid={`trello-replace-${where}`} size="row" variant="secondary" onPress={act.replaceTrello}>Vaihda token…</Button>}
  <Button data-testid={`trello-remove-${where}`} size="row" variant="quiet" onPress={act.removeTrello}>Poista…</Button></>;
 const atlNotice=a==='pending'?<div className="ig-notice at-notice" role="status" data-testid="atl-pending"><Icon name="clock"/><div>
   <span><b>Odottaa Contosoin hyväksyntää.</b> Kirjauduit {direction===PATH?'':'2.11. '}ja kirjautumisesi on tallessa, mutta Atlassian ei päästä yhteyttä läpi, ennen kuin Contosoin ylläpitäjä sallii sen MCP-asetuksissa. Tarkistettu {checked}.</span>
   <div className="ig-row start"><CopyRequest/></div></div></div>
  :a==='refused'?<div className="ig-notice" role="status" data-testid="atl-refused"><Icon name="warning"/><span><b>Contoso on estänyt yhteyden.</b> Organisaation ylläpitäjä on sulkenut Atlassianin MCP-yhteyden, joten agentti ei pääse Jiraan eikä Confluenceen. Habitat ei voi ohittaa tätä. Kysy ylläpitäjältä, jos tarvitset yhteyttä; muuten poista se.</span></div>
  :a==='revoked'?<div className="ig-notice" role="status" data-testid="atl-revoked"><Icon name="warning"/><span><b>Atlassian ei enää hyväksy kirjautumista.</b> Lupa on peruttu Atlassian-tililläsi tai sitä ei käytetty 90 päivään. Kirjaudu uudelleen; mitään ei kirjoitettu yhteyden ollessa poikki.</span></div>:null;
 const trelloNotice=t==='expired'?<div className="ig-notice" role="status" data-testid="trello-expired"><Icon name="warning"/><span><b>Trello-token vanheni 1.11.</b> Trellon tokeneilla ei ole uusimista: hae uusi token Trellosta. Agentti ei pääse Trelloon sillä välin.</span></div>:null;

 // ---- Direction 1: account cards beside Google's ----
 const pill=(full:boolean,text:string,id:string)=><span className={`ig-lv ${full?'full':'narrow'}`} data-testid={id}><Icon className="ig-lv-icon" name={full?'key':'lock'}/>{text}</span>;
 const svcRow=(p:Product)=>{const c=cap(a,t,p);return <div className="ig-svc" key={p} data-testid={`svc-${p}`} data-conn={c.conn}>
  <span className="ig-ic sm"><Icon name={productIcon[p]}/></span>
  <div><span className="ig-rn">{p==='trello'?'Taulut ja kortit':productName[p]}</span>
   <span className="ig-meta">{c.read?readText[p]+(c.write==='yes'?`; ${writeText[p]}, kun pyydät.`:'.'):c.conn==='pending'?'Agentti pääsee tähän, kun Contoso on sallinut yhteyden.':c.conn==='none'?'':'Agentti ei pääse tähän nyt.'}</span>
   {c.read&&c.write!=='yes'&&<span className="ig-meta">Ei kirjoita: {writeWhy[c.write].toLowerCase()}.</span>}
   {p==='trello'&&c.conn==='ok'&&<span className="ig-meta">Kaikki 12 taulua, joihin sinulla on pääsy.</span>}</div>
  <div className="ig-sv">{connMark(c.conn)}{c.conn==='ok'&&<span className="ig-meta">{p==='trello'?trelloValid(t):`Tarkistettu ${checked}`}</span>}</div></div>;};
 const cardMain=<>
  <h3 className="ig-h3">Yhdistetyt tilit</h3>
  <AccountCard account={google} checking={false} onCheck={()=>{}} onRemove={()=>{}}/>
  {a!=='none'&&<article className="ig-card" data-testid="atl-card" data-state={a}>
   <div className="ig-acc"><LetterMark mark="A" tone={2}/><div><span className="ig-rn">Atlassian</span><span className="ig-meta">{ME} · {SITE}</span></div>
    {a==='read'?pill(false,'Vain luku ja haku','atl-pill'):a==='write'?pill(true,'Lukee ja kirjoittaa','atl-pill'):null}
    {atlActions('card')}</div>
   {atlNotice}{svcRow('jira')}{svcRow('confluence')}
   {a==='pending'&&<details className="ig-grant"><summary>Pyyntö ylläpitäjälle</summary><RequestText/></details>}
   <details className="ig-grant" data-testid="atl-knows-details"><summary>Mitä agentti tietää</summary><AgentKnows a={a} t="none"/></details>
  </article>}
  {t!=='none'&&<article className="ig-card" data-testid="trello-card" data-state={t}>
   <div className="ig-acc"><LetterMark mark="T" tone={1}/><div><span className="ig-rn">Trello</span><span className="ig-meta">{TRELLO} · token {t==='expired'?'vanhentunut':'30 päivää'}</span></div>
    {t==='read'?pill(false,'Vain luku','trello-pill'):t==='write'?pill(true,'Lukee ja kirjoittaa','trello-pill'):null}
    {trelloActions('card')}</div>
   {trelloNotice}{svcRow('trello')}
   <div className="ig-svc"><span className="ig-ic sm"><Icon name="key"/></span><div><span className="ig-rn">Token</span><span className="ig-meta"><span className="ah-mono">{t==='write'?'read,write':'read'}</span> · {trelloValid(t)}</span></div>
    <div className="ig-sv">{t==='expired'?<StatusMark kind="error" tone="danger" label="Vanhentunut"/>:<StatusMark kind="success" tone="success" label="Voimassa"/>}</div></div>
   <details className="ig-grant"><summary>Mitä agentti tietää</summary><AgentKnows a="none" t={t}/></details>
  </article>}
 </>;

 // ---- Direction 2: one table, who enforces each limit ----
 const cell=(ok:boolean|'na',text:string,id?:string)=><span className="at-cell" data-ok={String(ok)} data-testid={id}><Icon name={ok===true?'check':ok==='na'?'clock':'cross'}/>{text}</span>;
 const tableRow=(p:Product)=>{const c=cap(a,t,p);if(c.conn==='none')return null;
  const write=c.write==='yes'?cell(true,'Kun pyydät'):c.read?cell(false,writeWhy[c.write]):cell('na','–');
  return <div className="at-tr" role="row" key={p} data-testid={`row-${p}`} data-conn={c.conn}>
   <span role="cell" className="at-prod"><Icon name={productIcon[p]}/><span className="ig-rn">{productName[p]}</span></span>
   <span role="cell" data-label="Yhteys">{connMark(c.conn)}</span>
   <span role="cell" data-label="Lukee ja hakee">{c.read?cell(true,'Kyllä'):cell(c.conn==='pending'?'na':false,c.conn==='pending'?'Hyväksynnän jälkeen':'Ei nyt')}</span>
   <span role="cell" data-label="Kirjoittaa">{write}</span>
   <span role="cell" data-label="Kuka rajaa" className="at-who" data-testid={`limit-${p}`}>{c.limit}</span></div>;};
 const tableMain=<>
  <h3 className="ig-h3">Yhdistetyt tilit</h3>
  <AccountCard account={google} checking={false} onCheck={()=>{}} onRemove={()=>{}}/>
  {(a!=='none'||t!=='none')&&<><h3 className="ig-h3">Työtilat ja tehtävät</h3>
  <section className="ig-card at-table-card" data-testid="perm-table">
   <div className="at-table" role="table" aria-label="Mitä agentti voi tehdä">
    <div className="at-tr at-th" role="row"><span role="columnheader">Palvelu</span><span role="columnheader">Yhteys</span><span role="columnheader">Lukee ja hakee</span><span role="columnheader">Kirjoittaa</span><span role="columnheader">Kuka rajaa</span></div>
    {tableRow('jira')}{tableRow('confluence')}{tableRow('trello')}
   </div>
   {atlNotice&&<div className="at-pad">{atlNotice}</div>}{trelloNotice&&<div className="at-pad">{trelloNotice}</div>}
   {a!=='none'&&<div className="ig-svc at-acct" data-testid="atl-card" data-state={a}><LetterMark mark="A" tone={2} small/><div><span className="ig-rn">Atlassian</span><span className="ig-meta">{ME} · {SITE} · Pi:n kirjautuminen</span></div><div className="at-acts">{atlActions('table')}</div></div>}
   {t!=='none'&&<div className="ig-svc at-acct" data-testid="trello-card" data-state={t}><LetterMark mark="T" tone={1} small/><div><span className="ig-rn">Trello</span><span className="ig-meta">{TRELLO} · token <span className="ah-mono">{t==='write'?'read,write':'read'}</span> · {trelloValid(t)} · 12 taulua</span></div><div className="at-acts">{trelloActions('table')}</div></div>}
   <div className="at-pad at-knowsbox"><span className="ig-rn">Mitä agentti tietää</span><AgentKnows a={a} t={t}/></div>
  </section></>}
 </>;

 // ---- Direction 3: a path of steps per connection ----
 type Step={id:string;state:'done'|'now'|'wait'|'bad'|'off';title:string;body?:React.ReactNode};
 const atlSteps:Step[]=[
  {id:'signin',state:a==='revoked'?'bad':'done',title:a==='revoked'?'Kirjautuminen peruttu':'Kirjauduit Atlassianiin',body:a==='revoked'?'Lupa on peruttu Atlassian-tililläsi tai sitä ei käytetty 90 päivään. Kirjaudu uudelleen.':<>{ME} · {SITE} · 2.11. Myönsit {aLevel==='read'?'luvun ja haun':'luvun, haun ja kirjoituksen'}.</>},
  {id:'org',state:a==='pending'?'now':a==='refused'?'bad':a==='revoked'?'off':'done',title:a==='pending'?'Contosoin ylläpitäjä sallii yhteyden':a==='refused'?'Contoso on estänyt yhteyden':'Contoso sallii yhteyden',
   body:a==='pending'?<><span>Atlassian ei päästä yhteyttä läpi ennen kuin Contosoin ylläpitäjä sallii sen. Lähetä hänelle tämä pyyntö. Tarkistettu {checked}.</span><RequestText/><div className="ig-row start"><CopyRequest/></div></>
   :a==='refused'?'Organisaation ylläpitäjä on sulkenut Atlassianin MCP-yhteyden. Habitat ei voi ohittaa tätä; kysy ylläpitäjältä tai poista yhteys.'
   :a==='write'?'Read ja Search sallittu Jiraan ja Confluenceen; Write vain Jiraan.':'Read ja Search sallittu Jiraan ja Confluenceen.'},
  {id:'read',state:a==='read'||a==='write'?'done':'off',title:'Agentti hakee ja lukee Jiraa ja Confluencea',body:a==='read'||a==='write'?`Tarkistettu ${checked}.`:'Kun edelliset vaiheet ovat kunnossa.'},
  {id:'write',state:a==='write'?'done':'off',title:a==='write'?'Kirjoittaa Jiraan, kun pyydät':'Kirjoitus: ei käytössä',
   body:a==='write'?'Confluenceen ei: Contoso estää kirjoituksen.':aLevel==='read'?'Et myöntänyt kirjoitusta, joten Atlassian estää sen. Voit sallia sen kirjautumalla uudelleen; Contoso päättää tuotteittain.':'Valitsit kirjoituksen; se tulee käyttöön, kun Contoso sallii yhteyden.'},
 ];
 const trelloSteps:Step[]=[
  {id:'token',state:t==='expired'?'bad':'done',title:t==='expired'?'Token vanheni 1.11.':'Annoit Trello-tokenin',body:t==='expired'?'Trellon tokeneilla ei ole uusimista: hae uusi token Trellosta.':<>{TRELLO} · {trelloValid(t)}. Token on vain kotihakemistossasi.</>},
  {id:'read',state:t==='expired'?'off':'done',title:'Agentti hakee ja lukee tauluja ja kortteja',body:t==='expired'?'Kun token on uusittu.':'Kaikki 12 taulua, joihin sinulla on pääsy – token ei rajaa tauluja.'},
  {id:'write',state:t==='write'?'done':'off',title:t==='write'?'Kirjoittaa kortteja, kun pyydät':'Kirjoitus: ei käytössä',body:t==='write'?'Trello vahvisti tokenin oikeudeksi read,write.':'Trello vahvisti tokenin oikeudeksi read ja estää kirjoituksen. Kirjoitus vaatii uuden tokenin.'},
 ];
 const stepIcon=(s:Step['state'],i:number)=>s==='done'?<Icon name="check"/>:s==='bad'?<Icon name="warning"/>:s==='now'?<Icon name="clock"/>:<span>{i+1}</span>;
 const path=(id:string,steps:Step[])=><ol className="at-path" data-testid={`path-${id}`}>{steps.map((s,i)=><li key={s.id} data-state={s.state} data-testid={`step-${id}-${s.id}`} aria-current={s.state==='now'?'step':undefined}>
  <span className="at-dot">{stepIcon(s.state,i)}</span><div><span className="ig-rn">{s.title}</span>{s.body&&<span className="ig-meta at-stepbody">{s.body}</span>}</div></li>)}</ol>;
 const pathMain=<>
  <h3 className="ig-h3">Yhdistetyt tilit</h3>
  <AccountCard account={google} checking={false} onCheck={()=>{}} onRemove={()=>{}}/>
  {(a!=='none'||t!=='none')&&<h3 className="ig-h3">Työtilat ja tehtävät</h3>}
  {a!=='none'&&<article className="ig-card" data-testid="atl-card" data-state={a}>
   <div className="ig-acc"><LetterMark mark="A" tone={2}/><div><span className="ig-rn">Jira ja Confluence</span><span className="ig-meta">Atlassian · {SITE}</span></div>{atlActions('path')}</div>
   {path('atl',atlSteps)}</article>}
  {t!=='none'&&<article className="ig-card" data-testid="trello-card" data-state={t}>
   <div className="ig-acc"><LetterMark mark="T" tone={1}/><div><span className="ig-rn">Trello</span><span className="ig-meta">{TRELLO}</span></div>{trelloActions('path')}</div>
   {path('trello',trelloSteps)}</article>}
  {(a!=='none'||t!=='none')&&<div className="ig-card at-pad at-knowsbox" data-testid="path-knows"><span className="ig-rn">Mitä agentti tietää nyt</span><AgentKnows a={a} t={t}/></div>}
 </>;

 const tiles=<>{(a==='none'||t==='none')&&<h3 className="ig-h3">Lisää tili</h3>}
  <div className="ig-tiles">
   {a==='none'&&<div className="ig-tile" data-testid="tile-atl"><LetterMark mark="A" tone={2}/><div><span className="ig-rn">Atlassian</span><span className="ig-meta">Jira · Confluence · organisaation hyväksyntä</span></div><Button data-testid="atl-connect" size="row" variant="secondary" onPress={act.connectAtl}>Yhdistä…</Button></div>}
   {t==='none'&&<div className="ig-tile" data-testid="tile-trello"><LetterMark mark="T" tone={1}/><div><span className="ig-rn">Trello</span><span className="ig-meta">Taulut ja kortit · oma token</span></div><Button data-testid="trello-connect" size="row" variant="secondary" onPress={act.connectTrello}>Yhdistä…</Button></div>}
  </div></>;

 const main=<><p className="muted mobilecrumb">Asetukset › Tiedot agenteille</p><h2>Tiedot agenteille</h2>
  <div className="ig-main">
   <p className="ig-intro">Liitä muiden palvelujen tilisi, niin agenttisi voivat käyttää niiden tiedostoja, postia, kalentereita ja työtehtäviä.</p>
   <GrantLimits/>
   {direction===CARD?cardMain:direction===TABLE?tableMain:pathMain}
   {tiles}
   <p className="ig-foot">Tila luetaan suoraan työkaluilta sinun käyttäjänäsi. Kirjautumistiedot ovat vain kotihakemistossasi; palvelin ei tallenna niitä eikä listaa liitoksiasi muualle.</p>
  </div></>;
 return <div data-theme={theme} className={phone?'review phone':'review'}>
  <header className="reviewbar"><strong>Jira, Confluence ja Trello</strong>
   <label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
   <label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);}}/> 390 px</label>
   <p>Synteettinen henkilö, sivusto ja taulut. Mitään ei lähetetä.</p></header>
  <ol className="at-lines" data-testid="direction-lines">{LINES.map((l,i)=><li key={i} aria-current={i===direction?'true':undefined}>{l}</li>)}</ol>
  <p className="axis">Akseli: missä organisaation hyväksyntä ja luku/kirjoitusraja näkyvät. Dialogit ja tosiasiat ovat kaikissa samat. Suositus: Tilikortti, ja siihen Hyväksyntäpolun näkyvä pyyntö ylläpitäjälle.</p>
  <div className="scenario"><span className="muted">Tilanne</span><Segmented data-testid="scenario" label="Tilanne" size="row" options={(Object.keys(scenarios) as Scenario[]).map(s=>({id:s,label:scenarios[s].label}))} value={scenario} onChange={reset}/>
   <span className="muted" data-testid="scenario-hint">{scenarios[scenario].hint}</span></div>
  <div className={`shell variant-${direction}`}>
   <div className="hostbar"><strong>Open Habitat</strong><span>Aino Virtanen</span><Icon name="user"/></div>
   <section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>
    {ownNav.map(([n,i])=><span className="s-nav-i" key={n} aria-current={n==='Tiedot agenteille'?'page':undefined}><Icon name={i}/>{n}</span>)}
   </nav><main className="s-main">{main}</main></section>
  </div>
  {open?.kind==='atl'&&<AtlassianDialog theme={theme} from={a} initial={open.initial} onClose={()=>setOpen(null)} onDone={x=>{setOpen(null);setA(x);if(x==='read'||x==='write')setALevel(x);setChecked('juuri nyt');}}/>}
  {open?.kind==='trello'&&<TrelloDialog theme={theme} replace={open.replace} initial={open.initial} onClose={()=>setOpen(null)} onDone={x=>{setOpen(null);setT(x);}}/>}
  {open?.kind==='remove'&&<RemoveDialog theme={theme} what={open.what} onClose={()=>setOpen(null)} onConfirm={()=>{if(open.what==='atl')setA('none');else setT('none');setOpen(null);}}/>}
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
