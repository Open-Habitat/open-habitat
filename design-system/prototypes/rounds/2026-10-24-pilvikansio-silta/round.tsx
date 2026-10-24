import React, {type ReactNode, useEffect, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {InlineNotice} from '../../../../web/src/components/Status';
import {AccountCard, IntegrationsOverview, ProviderMark} from '../../../../web/src/components/Integrations';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer} from '../../../../web/src/components/composer/Composer';
import {Markdown} from '../../../../web/src/components/Markdown';
import type {Account, IntegrationList, Provider} from '../../../../web/src/app/integrations';
import {OnboardingFrame, type RouteStep} from './frame';
import {BridgeLine, BridgeProvider, type Cloud, ConnectChoices, HowTo, cloudGen, cloudIn, cloudName, folder, person, serverPath, useBridge} from './bridge';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/Settings.css';
import '../../../../web/src/components/Integrations.css';
import './round.css';

// Where and when a person learns that a synced OneDrive or Dropbox folder is
// the bridge between their own computer and the agent. Four places, the same
// person, folder and instructions in each. Production components run with
// synthetic data; nothing leaves the page.
const directions = ['Aloitus','Liitä','Kortti','Agentti'];
const axes = [
 'Käyttöönotossa: oma vaihe "Oma kone", jonka sivusto voi lisätä reitille. Yhdistä, avaa kansio koneellasi ja kokeile yhdellä tiedostolla.',
 'Tarpeen hetkellä: Liitä-valikko näyttää kansion, ja liian iso tiedosto ohjaa sinne.',
 'Tilikortissa: Integraatioiden ylimpänä "Oma kone", ja Dropbox-kortti kertoo, miten sama kansio avataan koneella.',
 'Agentin vastauksessa: ei opastusta etukäteen. Kun agentti tuo tiedoston koneellesi tai hakee sieltä, vastaus näyttää, mistä sen löytää.',
];
const noop = () => {};
let reviewTheme = 'light', reviewPhone = false, reviewConnected = true;

const checked = '2026-10-24T07:43:00Z';
const microsoftProvider: Provider = {id:'microsoft',available:true,login:'device_code',services:['mail','calendar','contacts','onedrive']};
const googleProvider: Provider = {id:'google',available:true,login:'pasted_redirect',services:['mail','calendar','contacts','drive']};
const imapProvider: Provider = {id:'imap',available:true,login:'app_password',services:['mail']};
const googleAccount: Account = {provider:'google',address:'aino.home@example.test',checked_at:checked,services:[{id:'mail',state:'ok'},{id:'calendar',state:'ok'},{id:'contacts',state:'ok'},{id:'drive',state:'ok',directory:'~/cloud/google-drive/aino.home@example.test'}]};
const cloudAccount = (c: Cloud): Account => c==='dropbox'
 ? {provider:'dropbox',address:person,checked_at:checked,services:[{id:'dropbox',state:'ok',directory:`~/cloud/dropbox/${person}`}]}
 : {provider:'microsoft',address:person,checked_at:checked,services:[{id:'onedrive',state:'ok',directory:`~/cloud/onedrive/${person}`}]};
const newest = 'Näyttökuva 2026-10-24 10.41.png';

// ---------- Direction Aloitus: an onboarding step ----------

const route: RouteStep[] = [{id:'github'},{id:'repositories',note:'3 repoa'},{id:'google',skipped:true},{id:'cloud'},{id:'ai'}];

function CloudStep(){
 const b = useBridge();
 const [connecting,setConnecting] = useState<Cloud|null>(null);
 const [arrived,setArrived] = useState(false);
 const name = cloudName[b.cloud];
 const pick = (c: Cloud) => {setConnecting(c);setTimeout(()=>{setConnecting(null);b.connect(c);},700);};
 return <section className="ah-onboarding-step hb-step" data-testid="cloud-step" aria-labelledby="cloud-title">
  <header>
   <p className="ah-eyebrow">Käyttöönotto</p>
   <h1 id="cloud-title" data-testid="cloud-title" tabIndex={-1}>Tiedostot omalta koneelta</h1>
   <p>Agentti ei näe konettasi. Pilvikansio on silta: mitä laitat sinne, agentti näkee, ja se voi tuoda sinne tiedostoja sinulle.</p>
  </header>
  <BridgeLine cloud={b.connected?b.cloud:(connecting??'dropbox')} state={b.connected?'ok':'off'}/>
  {!b.connected?<div className="hb-block">
   {connecting?<p className="hb-wait" role="status" data-testid="connecting"><span className="ig-spin" aria-hidden="true"/>Yhdistetään {cloudName[connecting]}…</p>:<ConnectChoices onPick={pick}/>}
  </div>:<>
   <div className="hb-block">
    <h2>Avaa sama kansio koneellasi</h2>
    <HowTo cloud={b.cloud}/>
   </div>
   <div className="hb-block hb-try" data-testid="try" data-arrived={arrived}>
    <h2>Kokeile</h2>
    {arrived
     ?<p className="hb-ok" role="status" data-testid="arrived"><Icon name="check"/><span><b>{newest}</b> tuli kansioon. Agentti näkee sen.</span></p>
     :<>
      <p>Tallenna koneellasi jokin tiedosto kansioon <b>{name} › {folder}</b>.</p>
      <p className="hb-wait" role="status"><span className="ig-spin" aria-hidden="true"/>Odotetaan tiedostoa…</p>
      <div className="proto-sim"><span>Prototyyppi</span><Button size="row" variant="quiet" data-testid="simulate-arrival" onPress={()=>setArrived(true)}>Tiedosto saapuu</Button></div>
     </>}
   </div>
  </>}
  <div className="ah-onboarding-actions">
   <Button data-testid="cloud-back" size="page" variant="quiet" onPress={()=>b.leave('Takaisin Google-vaiheeseen.')}>Takaisin Googleen</Button>
   <Button data-testid="cloud-continue" data-connected={b.connected} size="page" variant={b.connected?'primary':'secondary'} onPress={()=>b.leave('Seuraavaksi AI-tili. Ei tämän kierroksen aihe.')}>{b.connected?'Jatka AI-tiliin':'Jatka ilman'}</Button>
  </div>
 </section>;
}

// ---------- Conversation scaffolding (directions Liitä and Agentti) ----------

function Conversation({items,notice,menu}:{items:{id:string;content:ReactNode}[];notice?:ReactNode;menu:boolean}){
 const b = useBridge();
 const [value,setValue] = useState('');
 return <BridgeProvider value={{...b,menu,mention:t=>setValue(v=>v?`${v} ${t}`:t)}}>
  <main className="ah-conversation-frame hb-convo">
   <div className="ah-conversation-stream">
    <ConversationTimeline state="ready" items={items} historyMode="virtualized" onJumpToLatest={noop}/>
    {notice}
   </div>
   <Composer value={value} onChange={setValue} csrf="prototype" activity="idle" selectedWorkingMode="steer" onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop}/>
  </main>
 </BridgeProvider>;
}
const user = (id: string, text: string) => ({id,content:<UserMessage sourceText={text} time="10.40" onCopy={noop}/>});
const agent = (id: string, body: ReactNode) => ({id,content:<AssistantMessage streamState="complete" time="10.42" onCopy={noop}>{body}</AssistantMessage>});

// ---------- Direction Liitä: the moment of need ----------

function AttachView({big}:{big:boolean}){
 const b = useBridge();
 const [how,setHow] = useState(false);
 const name = cloudName[b.cloud];
 const items = [
  user('u1','Miksi myyntiraportti näyttää tyhjältä?'),
  agent('a1',<Markdown text={'Raportti lukee tiedoston `data/myynti-q3.csv`, jota työtilassa ei ole. Onko se koneellasi? Lähetä se minulle.'}/>),
 ];
 const notice = big?<div className="hb-composer-notice" data-testid="big-file">
  <InlineNotice tone="warning" title="myynti-q3.csv on liian suuri liitteeksi (48 Mt, raja 20 Mt)"
   description={b.connected?`Laita se koneellasi kansioon ${name} › ${folder}. Agentti näkee sen, kun ${name} on synkronoinut.`:'Isot tiedostot kulkevat Dropboxin tai OneDriven kansion kautta.'}
   actions={b.connected?[{label:how?'Piilota ohje':'Ohje koneelle',onPress:()=>setHow(v=>!v)}]:[{label:'Yhdistä Dropbox',onPress:()=>b.connect('dropbox')},{label:'Yhdistä OneDrive',onPress:()=>b.connect('microsoft')}]}/>
  {b.connected&&how&&<HowTo cloud={b.cloud} compact/>}
 </div>:undefined;
 return <Conversation items={items} notice={notice} menu/>;
}

// ---------- Direction Kortti: Asetukset › Integraatiot ----------

function BridgeCard(){
 const b = useBridge();
 const [test,setTest] = useState<'idle'|'sent'|'seen'|'missing'>('idle');
 const name = cloudName[b.cloud];
 return <section className="hb-card" data-testid="bridge-card" data-connected={b.connected} aria-labelledby="bridge-title">
  <header><h3 id="bridge-title">Oma kone</h3><BridgeLine cloud={b.cloud} state={b.connected?'ok':'off'}/></header>
  {!b.connected?<>
   <p>Agentti ei näe konettasi. Yhdistä Dropbox tai OneDrive: sen kansio kuljettaa tiedostoja kumpaankin suuntaan.</p>
   <ConnectChoices onPick={c=>b.connect(c)}/>
  </>:<>
   <AccountCard account={cloudAccount(b.cloud)} checking={false} onCheck={noop} onRemove={noop}/>
   <div className="hb-panel" data-testid="bridge-panel">
    <dl className="hb-facts">
     <div><dt>Koneellasi</dt><dd><b>{name} › {folder}</b></dd></div>
     <div><dt>Palvelimella</dt><dd><code>{serverPath(b.cloud)}</code></dd></div>
     <div><dt>Uusin tiedosto</dt><dd data-testid="newest">{newest} · klo 10.41</dd></div>
    </dl>
    <HowTo cloud={b.cloud}/>
    <div className="hb-test" data-testid="bridge-test" data-state={test}>
     {test==='idle'&&<Button size="row" data-testid="test-bridge" onPress={()=>setTest('sent')}>Kokeile siltaa</Button>}
     {test==='sent'&&<><p><code>Tervetuloa.txt</code> kirjoitettiin kansioon klo 10.43. Näkyykö se koneellasi?</p>
      <div className="hb-row"><Button size="row" data-testid="test-seen" onPress={()=>setTest('seen')}>Näkyy</Button><Button size="row" variant="quiet" data-testid="test-missing" onPress={()=>setTest('missing')}>Ei näy</Button></div></>}
     {test==='seen'&&<p className="hb-ok" role="status"><Icon name="check"/><span>Silta toimii.</span></p>}
     {test==='missing'&&<ul className="hb-help" data-testid="test-help"><li>Onko {name} käynnissä koneellasi?</li><li>Kirjauduitko tilillä {person}?</li><li>Synkronointi kestää noin minuutin.</li></ul>}
    </div>
   </div>
  </>}
 </section>;
}

function SettingsView(){
 const b = useBridge();
 const others: IntegrationList = {schema_version:1,skill:'current',providers:[googleProvider,imapProvider,...(b.connected&&b.cloud==='microsoft'?[]:[microsoftProvider])],accounts:[googleAccount]};
 return <div className="hb-settings"><div className="hostbar"><strong>Open Habitat</strong><span>habitat.example.test</span><Icon name="user"/></div>
  <section className="ah-account-settings s-page detail"><nav className="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>{['Tili','Agentit','Integraatiot','Ulkoasu','Editori'].map(n=><span className="s-nav-i" key={n} aria-current={n==='Integraatiot'?'page':undefined}>{n}</span>)}</nav>
   <main className="s-main" data-testid="settings-main">
    <h2>Integraatiot</h2>
    <p className="ig-intro">Liitä muiden palvelujen tilisi, niin agenttisi voivat käyttää niiden tiedostoja, postia ja kalentereita.</p>
    <BridgeCard/>
    <h3 className="ig-h3">Muut tilit</h3>
    <IntegrationsOverview list={others} compact checking={new Set()} onCheck={noop} onConnect={p=>b.leave(`Avaisi: Yhdistä ${p.id}.`)} onSignInAgain={noop} onRemove={noop}/>
   </main>
  </section></div>;
}

// ---------- Direction Agentti: the agent's own reply ----------

const bills = [['Lasku-1043-Sähkö.pdf','182 kt'],['Lasku-1044-Vakuutus.pdf','96 kt'],['Lasku-1047-Puhelin.pdf','64 kt']];

function Delivery(){
 const b = useBridge();
 const [how,setHow] = useState(false);
 const name = cloudName[b.cloud];
 return <aside className="hb-delivery" data-testid="delivery" aria-label={`Koneellesi ${cloudGen[b.cloud]} kautta`}>
  <header><ProviderMark provider={b.cloud} small/><b>Koneellesi {cloudGen[b.cloud]} kautta</b></header>
  <p className="hb-path">{name} › {folder} › Laskut 10-2026</p>
  <ul>{bills.map(([n,s])=><li key={n}><Icon name="file"/><span>{n}</span><small>{s}</small></li>)}</ul>
  <p className="hb-meta" data-testid="delivery-state"><Icon name="check"/>{cloudIn[b.cloud]} klo 10.42. Näkyy koneellasi, kun {name} on siellä käynnissä.</p>
  <Button size="row" variant="quiet" data-testid="delivery-how" aria-expanded={how} onPress={()=>setHow(v=>!v)}>{how?'Piilota ohje':'Eikö näy koneellasi?'}</Button>
  {how&&<HowTo cloud={b.cloud} compact/>}
 </aside>;
}
function NoBridge(){
 const b = useBridge();
 return <aside className="hb-delivery off" data-testid="no-bridge" aria-label="Ei yhteyttä koneellesi">
  <BridgeLine cloud="dropbox" state="off"/>
  <p>Saat tiedostot koneellesi Dropboxin tai OneDriven kansion kautta. Yhdistä toinen, niin agentti laittaa ne sinne.</p>
  <ConnectChoices onPick={c=>b.connect(c)}/>
 </aside>;
}
function Inbound(){
 const b = useBridge();
 return <p className="hb-inbound" data-testid="inbound"><ProviderMark provider={b.cloud} small/><span>Koneeltasi {cloudGen[b.cloud]} kautta · <b>{folder}/{newest}</b> · klo 10.41</span></p>;
}

function AgentView({wasConnected}:{wasConnected:boolean}){
 const b = useBridge();
 const name = cloudName[b.cloud];
 const items = wasConnected?[
  user('u1','Laita tämän kuun laskut koneelleni.'),
  agent('a1',<><Markdown text={`Laitoin kolme laskua ${cloudGen[b.cloud]} kansioon.`}/><Delivery/></>),
  user('u2','Katso kuvakaappaus, jonka otin äsken. Mikä virhe tuo on?'),
  agent('a2',<><Inbound/><Markdown text={'Kuvassa on kirjautumisen virhe `401 invalid_client`: sovelluksen tunnus on väärä. Korjaan sen `config/auth.toml`-tiedostoon, jos haluat.'}/></>),
 ]:[
  user('u1','Laita tämän kuun laskut koneelleni.'),
  agent('a1',<><Markdown text={'En pääse koneellesi. Laskut ovat palvelimella kansiossa `~/laskut/2026-10/`.'}/>{b.connected
   ?<p className="hb-ok" role="status" data-testid="now-connected"><Icon name="check"/><span>{name} yhdistetty. Pyydä uudelleen, niin agentti laittaa laskut sinne.</span></p>
   :<NoBridge/>}</>),
 ];
 return <Conversation items={items} menu={false}/>;
}

// ---------- Review page ----------

function App({direction}:{direction:number}){
 const [theme,setTheme] = useState(reviewTheme),[phone,setPhone] = useState(reviewPhone);
 const [connected,setConnected] = useState(reviewConnected);
 const [cloud,setCloud] = useState<Cloud>('dropbox');
 const [left,setLeft] = useState('');
 const [big,setBig] = useState(false);
 const [epoch,setEpoch] = useState(0);
 useEffect(()=>{document.documentElement.dataset.theme=theme;},[theme]);
 const scenario = (on: boolean) => {reviewConnected=on;setConnected(on);setCloud('dropbox');setLeft('');setBig(false);setEpoch(e=>e+1);};
 const bridge = {connected,cloud,connect:(c:Cloud)=>{setCloud(c);setConnected(true);setLeft(`${cloudName[c]} yhdistetty (synteettinen).`);},leave:setLeft};
 const view = direction===0
  ?<OnboardingFrame route={route} step="cloud" host="habitat.example.test"><CloudStep/></OnboardingFrame>
  :direction===1?<AttachView big={big}/>
  :direction===2?<SettingsView/>
  :<AgentView wasConnected={reviewConnected}/>;
 return <div className={phone?'review phone':'review'}>
  <header className="reviewbar"><strong>Pilvikansio siltana</strong>
   <label>Teema <select id="theme" value={theme} onChange={e=>{reviewTheme=e.target.value;setTheme(reviewTheme);}}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
   <label><input id="phone" type="checkbox" checked={phone} onChange={e=>{reviewPhone=e.target.checked;setPhone(reviewPhone);}}/> 390 px</label>
   <p>Synteettiset tiedot. Ei yhteyttä palvelimeen, Dropboxiin eikä OneDriveen.</p>
  </header>
  <div className="scenario">
   <Segmented data-testid="scenario" label="Lähtötilanne" size="row" value={reviewConnected?'on':'off'} onChange={v=>scenario(v==='on')} options={[{id:'on',label:'Dropbox yhdistetty'},{id:'off',label:'Ei vielä pilveä'}]}/>
   {direction===1&&<Button size="row" variant="quiet" data-testid="drop-big" onPress={()=>setBig(true)}>Pudota 48 Mt tiedosto</Button>}
   {left&&<span className="hb-left" role="status" data-testid="left">{left}</span>}
  </div>
  <p className="axis" data-testid="axis">{axes[direction]}</p>
  <div className={`shell variant-${direction}`} key={epoch}><BridgeProvider value={bridge}>{view}</BridgeProvider></div>
 </div>;
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: React.ReactNode){flushSync(()=>root.render(view===''?null:view));}};
const variants = directions.map((_,direction)=>()=> <App direction={direction}/>);
const picker = document.createElement('nav');
picker.className = 'proto-picker';picker.setAttribute('aria-label','Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n,i)=>{const button=document.createElement('button');button.className='proto-picker-item';button.textContent=n.replaceAll(' ',' ');if(i===0){button.setAttribute('data-active','');button.setAttribute('aria-current','true');}picker.append(button);});
document.body.append(picker);
new Function('stage','variants',pickerSource)(stageSink,variants);
