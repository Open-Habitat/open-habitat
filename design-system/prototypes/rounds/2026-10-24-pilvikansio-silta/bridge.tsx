import {createContext, type ReactNode, useContext, useState} from 'react';
import {ControlButton as Button, Segmented} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {ProviderMark} from '../../../../web/src/components/Integrations';

// What every direction shares: one synthetic person, one cloud folder and the
// same short instructions for setting it up on their own machine. The folder
// name `Open Habitat` is this round's proposal (result.md asks about it); today
// the agent may write anywhere under the synced root.

export type Cloud = 'dropbox'|'microsoft';
export const person = 'aino@example.test';
export const folder = 'Open Habitat';
export const cloudName: Record<Cloud,string> = {dropbox:'Dropbox',microsoft:'OneDrive'};
export const cloudIn: Record<Cloud,string> = {dropbox:'Dropboxissa',microsoft:'OneDrivessa'};
export const cloudGen: Record<Cloud,string> = {dropbox:'Dropboxin',microsoft:'OneDriven'};
export const serverPath = (c: Cloud) => `~/cloud/${c==='dropbox'?'dropbox':'onedrive'}/${person}/${folder}/`;

export type Bridge = {
 /** Whether the person has connected a cloud folder on the server. */
 connected: boolean;
 cloud: Cloud;
 connect: (c: Cloud) => void;
 /** What a click that would leave the page does here: say where it goes. */
 leave: (where: string) => void;
 /** Direction Liitä: the composer's menu carries the folder. */
 menu?: boolean;
 /** Puts a sentence in the composer, as the person would type it. */
 mention?: (text: string) => void;
};
const Ctx = createContext<Bridge>({connected:true,cloud:'dropbox',connect:()=>{},leave:()=>{}});
export const BridgeProvider = ({value,children}:{value:Bridge;children:ReactNode}) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const useBridge = () => useContext(Ctx);

type OS = 'mac'|'windows'|'phone';
const where: Record<OS,string> = {mac:'Finderissa',windows:'Resurssienhallinnassa',phone:'sovelluksessa'};
const install: Record<Cloud,Record<OS,string>> = {
 dropbox:{mac:'Asenna Dropbox-sovellus',windows:'Asenna Dropbox-sovellus',phone:'Asenna Dropbox-sovellus'},
 microsoft:{mac:'Asenna OneDrive App Storesta',windows:'OneDrive on Windowsissa valmiina',phone:'Asenna OneDrive-sovellus'},
};
// One line per OS that turns screenshots into files in the folder.
const shots = (os: OS, name: string): ReactNode =>
 os==='mac'?<>Kuvakaappaukset suoraan kansioon: <kbd>⇧⌘5</kbd> › Valinnat › Muu sijainti › {folder}.</>
 :os==='phone'?<>Kuva kansioon: Jaa › {name} › {folder}.</>:null;

/** How the same folder appears on the person's own machine. */
export function HowTo({cloud,compact=false}:{cloud:Cloud;compact?:boolean}){
 const [os,setOs] = useState<OS>('mac');
 const name = cloudName[cloud];
 const shot = shots(os,name);
 return <div className={`hb-howto${compact?' compact':''}`} data-testid="howto">
  <Segmented data-testid="howto-os" label="Oma laitteesi" size="row" value={os} onChange={setOs}
   options={[{id:'mac',label:'Mac',icon:<Icon name="laptop"/>},{id:'windows',label:'Windows',icon:<Icon name="laptop"/>},{id:'phone',label:'Puhelin',icon:<Icon name="phone"/>}]}/>
  <ol>
   <li>{install[cloud][os]} ja kirjaudu tilillä <b>{person}</b>.</li>
   <li>Kansio näkyy {where[os]}: <b>{name} › {folder}</b>.</li>
   {shot&&<li className="hb-shot" data-testid="howto-shot">{shot}</li>}
  </ol>
 </div>;
}

/** The bridge as one line: own machine, cloud, agent. */
export function BridgeLine({cloud,state='ok'}:{cloud:Cloud;state?:'ok'|'off'}){
 return <div className="hb-line" data-state={state} aria-label={`Oma kone, ${cloudName[cloud]}, agentti`}>
  <span className="hb-node"><Icon name="laptop"/>Oma kone</span>
  <span className="hb-arrow" aria-hidden="true"><Icon name="swap"/></span>
  <span className="hb-node"><ProviderMark provider={cloud} small/>{cloudName[cloud]} › {folder}</span>
  <span className="hb-arrow" aria-hidden="true"><Icon name="swap"/></span>
  <span className="hb-node"><Icon name="agent"/>Agentti</span>
 </div>;
}

/** Connect choices when no cloud folder exists yet. */
export function ConnectChoices({onPick}:{onPick:(c:Cloud)=>void}){
 return <div className="hb-connect">
  {(['dropbox','microsoft'] as Cloud[]).map(c=><Button key={c} data-testid={`connect-${c}`} size="row" variant="secondary" onPress={()=>onPick(c)}><ProviderMark provider={c} small/>Yhdistä {cloudName[c]}</Button>)}
 </div>;
}
