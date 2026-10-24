import {createContext, type ReactNode, useContext, useState} from 'react';
import {Segmented} from '../../../../../web/src/components/ControlElements';
import {Icon} from '../../../../../web/src/components/Icon';
import {type Cloud, cloudName, person} from '../bridge';

// Round 3 (Jari 2026-10-24): no special folder. The bridge is the person's own
// Documents and Downloads, backed up by OneDrive's folder backup or Dropbox
// Backup. What the services actually do (result.md, Kierros 3, cites them):
// - OneDrive folder backup moves Desktop, Documents, Pictures, Music and
//   Videos (Windows; on a Mac Desktop and Documents, and only with the
//   standalone app) into OneDrive as ordinary two-way folders. It has no
//   Downloads. Their names in OneDrive may be localized; Documents is found by
//   Graph's special folder `documents`, Desktop only by name.
// - Dropbox Backup copies any home folder, Downloads too, one way: computer to
//   cloud. It is listed under the backup's name ("Mac", "PC"), possibly in its
//   own namespace, and what is written there never reaches the computer.
// Two directions follow: keep Jari's Downloads + Documents, or Desktop +
// Documents, which both services back up and where a Mac saves screenshots.

export type Dir = 'downloads'|'desktop';
export type OS = 'mac'|'windows';
export type Folder = 'downloads'|'documents'|'desktop'|'pictures';
const fi: Record<Folder,Record<OS,string>> = {
 downloads:{mac:'Lataukset',windows:'Lataukset'},
 documents:{mac:'Dokumentit',windows:'Tiedostot'},
 desktop:{mac:'Työpöytä',windows:'Työpöytä'},
 pictures:{mac:'Kuvat',windows:'Kuvat'},
};
export const folderName = (f: Folder, os: OS = 'mac') => fi[f][os];
const native: Record<Folder,string> = {downloads:'Downloads',documents:'Documents',desktop:'Desktop',pictures:'Pictures'};
/** The backup's name in Dropbox; Dropbox's help shows backups under "Mac" or "PC". */
export const backupName = (os: OS) => os==='mac'?'Mac':'PC';
export const serverDir = (c: Cloud, f: Folder, os: OS = 'mac') => c==='dropbox'
 ?`~/cloud/dropbox/${person}/${backupName(os)}/${native[f]}/`
 :`~/cloud/onedrive/${person}/${native[f]}/`;

/** The folders the bridge reads from, per direction and service. */
export function bridged(d: Dir, c: Cloud): Folder[] {
 if(d==='downloads')return c==='dropbox'?['downloads','documents']:['documents'];
 return ['desktop','documents'];
}
/** Where the agent delivers. Dropbox Backup is one-way, so its own folder;
 * OneDrive's backed-up Documents is an ordinary two-way OneDrive folder. */
export const delivery = (c: Cloud) => c==='dropbox'?{label:'Dropbox',server:`~/cloud/dropbox/${person}/`}:{label:'Dokumentit',server:`~/cloud/onedrive/${person}/Documents/`};
/** Where a fresh file would be put in the try-it moment. */
export const tryFolder = (d: Dir, c: Cloud): Folder => d==='desktop'?'desktop':c==='dropbox'?'downloads':'documents';
export const sample = (d: Dir) => d==='desktop'?'Näyttökuva 2026-10-24 kello 10.41.12.png':'myynti-q3.csv';

const list = (names: string[]) => names.length<2?names[0]:`${names.slice(0,-1).join(', ')} ja ${names.at(-1)}`;

/** On the person's own computer: turn on the folder backup. */
export function HowTo({cloud,dir,compact=false}:{cloud:Cloud;dir:Dir;compact?:boolean}){
 const [os,setOs] = useState<OS>('mac');
 const pick = [...bridged(dir,cloud),...(os==='windows'?['pictures' as Folder]:[])];
 const menu = cloud==='dropbox'
  ?'Dropbox › Asetukset › Varmuuskopiot › Hallitse varmuuskopioita'
  :os==='mac'?'OneDrive › Asetukset › Varmuuskopio › Hallitse varmuuskopiota':'OneDrive › Asetukset › Synkronointi ja varmuuskopiointi › Hallitse varmuuskopiota';
 const install = cloud==='dropbox'?'Asenna Dropbox':os==='mac'?'Asenna OneDrive Microsoftin sivulta (App Storen versio ei varmuuskopioi)':'OneDrive on Windowsissa valmiina';
 const shot: ReactNode = os==='windows'
  ?<>Kuvakaappaukset (<kbd>Win</kbd> + <kbd>PrtScn</kbd>) tallentuvat Kuviin.</>
  :dir==='desktop'?<>Kuvakaappaukset tallentuvat Työpöydälle valmiiksi.</>
  :<>Kuvakaappaukset {cloud==='dropbox'?'Latauksiin':'Dokumentteihin'}: <kbd>⇧⌘5</kbd> › Valinnat › Muu sijainti › {folderName(cloud==='dropbox'?'downloads':'documents')}.</>;
 return <div className={`hb-howto${compact?' compact':''}`} data-testid="howto" data-os={os}>
  <Segmented data-testid="howto-os" label="Oma koneesi" size="row" value={os} onChange={setOs}
   options={[{id:'mac',label:'Mac',icon:<Icon name="laptop"/>},{id:'windows',label:'Windows',icon:<Icon name="laptop"/>}]}/>
  <ol>
   <li>{install} ja kirjaudu tilillä <b>{person}</b>.</li>
   <li>{menu}.</li>
   <li data-testid="howto-pick">Valitse <b>{list(pick.map(f=>folderName(f,os)))}</b>.</li>
   <li className="hb-shot" data-testid="howto-shot">{shot}</li>
  </ol>
  {dir==='downloads'&&cloud==='microsoft'&&<p className="hb-gap" data-testid="howto-gap">OneDrive ei varmuuskopioi Latauksia.</p>}
 </div>;
}

export type Round = {cloud: Cloud; dir: Dir; found: boolean; mention?: (t: string) => void};
const Ctx = createContext<Round>({cloud:'dropbox',dir:'downloads',found:true});
export const RoundProvider = ({value,children}:{value:Round;children:ReactNode}) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const useRound = () => useContext(Ctx);
export {cloudName};
