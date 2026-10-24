import {type RefObject, useState} from 'react';
import {Dialog, DialogTrigger, Popover} from 'react-aria-components';
import {ControlButton} from '../../../../../web/src/components/ControlElements';
import {Icon} from '../../../../../web/src/components/Icon';
import {ProviderMark} from '../../../../../web/src/components/Integrations';
import {HowTo, bridged, cloudName, delivery, folderName, sample, useRound} from './bridge';

// The production AttachmentMenu (web/src/components/composer/AttachmentMenu.tsx)
// with round 3's proposal: below the single file, the person's own backed-up
// folders by the names they see on their computer, not a special folder.
const elative: Record<string,string> = {Lataukset:'Latauksista',Dokumentit:'Dokumenteista',Työpöytä:'Työpöydältä'};
export function AttachmentMenu({disabled,onAttach,anchorRef}:{disabled:boolean;onAttach:()=>void;anchorRef?:RefObject<HTMLDivElement|null>}){
 const [open,setOpen] = useState(false);
 const [how,setHow] = useState(false);
 const r = useRound();
 const folders = bridged(r.dir,r.cloud);
 const first = folderName(folders[0]);
 const attach = () => {setOpen(false);onAttach();};
 return <DialogTrigger isOpen={open} onOpenChange={o=>{setOpen(o);if(!o)setHow(false);}}>
  <ControlButton size="inline" data-testid="attach-file" className="ah-crow-btn" aria-label="Lisää liite" isDisabled={disabled}>
   <Icon name="paperclip"/><span className="ah-crow-lbl">Liitä</span>
  </ControlButton>
  <Popover triggerRef={anchorRef} placement="top start" className="ah-attachment-popover" offset={8}>
   <Dialog aria-modal="true" aria-label="Lisää keskusteluun" className="ah-attachment-dialog" data-testid="attachment-panel">
    <ControlButton size="inline" presentation="icon" className="ah-attachment-close" data-testid="attachment-close" aria-label="Sulje liitevalikko" onPress={()=>setOpen(false)}>×</ControlButton>
    <div className="ah-attachment-choices">
     <ControlButton size="row" data-testid="attachment-single" onPress={attach}>Tiedosto liitteenä…</ControlButton>
     <p>Liite lähettää valitsemasi tiedoston, enintään 20 Mt.</p>
    </div>
    <section className="hb-menu-folder" data-testid="menu-folder" data-found={r.found} aria-label="Koneeltasi">
     <h3>Koneeltasi <ProviderMark provider={r.cloud} small/></h3>
     {r.found?<>
      <ul className="hb-menu-list">{folders.map((f,i)=><li key={f} data-testid={`menu-${f}`}><Icon name="folder"/><b>{folderName(f)} koneellasi</b>{i===0&&<small>{sample(r.dir)} · 10.41</small>}</li>)}</ul>
      <p>Agentti näkee, mitä tallennat näihin. Tuomansa tiedostot se laittaa kansioon <b data-testid="menu-delivery">{delivery(r.cloud).label}</b>.</p>
      <div className="hb-menu-actions">
       <ControlButton size="row" data-testid="menu-mention" onPress={()=>{setOpen(false);r.mention?.(`Katso uusin tiedosto ${elative[first]}ni.`);}}>Kerro agentille</ControlButton>
      </div>
     </>:<>
      <p data-testid="menu-missing">{cloudName[r.cloud]} on yhdistetty, mutta siellä ei vielä ole kansioita {list(folders.map(f=>folderName(f)))}.</p>
      <div className="hb-menu-actions">
       <ControlButton size="row" variant="quiet" data-testid="menu-how" aria-expanded={how} onPress={()=>setHow(v=>!v)}>{how?'Piilota ohje':'Laita varmuuskopio päälle'}</ControlButton>
      </div>
      {how&&<HowTo cloud={r.cloud} dir={r.dir} compact/>}
     </>}
    </section>
   </Dialog>
  </Popover>
 </DialogTrigger>;
}
const list = (n: string[]) => n.length<2?n[0]:`${n.slice(0,-1).join(', ')} ja ${n.at(-1)}`;
