import {type RefObject, useState} from 'react';
import {Dialog, DialogTrigger, Popover} from 'react-aria-components';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {ProviderMark} from '../../../../web/src/components/Integrations';
import {ConnectChoices, HowTo, cloudGen, cloudName, folder, useBridge} from './bridge';

// The production AttachmentMenu (web/src/components/composer/AttachmentMenu.tsx)
// with this round's proposal for direction Liitä: below the single file, the
// person's cloud folder, or the way to get one. Other directions render the
// production menu's content unchanged.
export function AttachmentMenu({disabled,onAttach,anchorRef}:{disabled:boolean;onAttach:()=>void;anchorRef?:RefObject<HTMLDivElement|null>}){
 const [open,setOpen] = useState(false);
 const [how,setHow] = useState(false);
 const b = useBridge();
 const attach = () => {setOpen(false);onAttach();};
 const name = cloudName[b.cloud];
 return <DialogTrigger isOpen={open} onOpenChange={o=>{setOpen(o);if(!o)setHow(false);}}>
  <ControlButton size="inline" data-testid="attach-file" className="ah-crow-btn" aria-label="Lisää liite" isDisabled={disabled}>
   <Icon name="paperclip"/><span className="ah-crow-lbl">Liitä</span>
  </ControlButton>
  <Popover triggerRef={anchorRef} placement="top start" className="ah-attachment-popover" offset={8}>
   <Dialog aria-modal="true" aria-label="Lisää keskusteluun" className="ah-attachment-dialog" data-testid="attachment-panel">
    <ControlButton size="inline" presentation="icon" className="ah-attachment-close" data-testid="attachment-close" aria-label="Sulje liitevalikko" onPress={()=>setOpen(false)}>×</ControlButton>
    <div className="ah-attachment-choices">
     <ControlButton size="row" data-testid="attachment-single" onPress={attach}>Tiedosto liitteenä…</ControlButton>
     <p>Liite lähettää valitsemasi tiedoston{b.menu?', enintään 20 Mt':''}.</p>
    </div>
    {b.menu&&<section className="hb-menu-folder" data-testid="menu-folder" data-connected={b.connected} aria-label="Oman koneen kansio">
     <h3>Oman koneen kansio</h3>
     {b.connected?<>
      <p className="hb-menu-path"><ProviderMark provider={b.cloud} small/><b>{name} › {folder}</b></p>
      <p>Mitä laitat sinne koneellasi, agentti näkee. Agentti voi myös tuoda sinne tiedostoja.</p>
      <div className="hb-menu-actions">
       <ControlButton size="row" data-testid="menu-mention" onPress={()=>{setOpen(false);b.mention?.(`Katso ${cloudGen[b.cloud]} ${folder} -kansio.`);}}>Kerro agentille</ControlButton>
       <ControlButton size="row" variant="quiet" data-testid="menu-how" aria-expanded={how} onPress={()=>setHow(v=>!v)}>{how?'Piilota ohje':'Koneellani?'}</ControlButton>
      </div>
      {how&&<HowTo cloud={b.cloud} compact/>}
     </>:<>
      <p>Yhdistä Dropbox tai OneDrive. Sen kansio kuljettaa tiedostoja koneesi ja agentin välillä, isojakin.</p>
      <ConnectChoices onPick={c=>{setOpen(false);b.connect(c);}}/>
     </>}
    </section>}
   </Dialog>
  </Popover>
 </DialogTrigger>;
}
