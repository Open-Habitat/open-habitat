// node wordcount.mjs [fi|en]
// Prints the Markdown table of words per text, round 1 against round 2, for
// result.md. Round 1 is read from its text.ts while that round is in the
// tree (afterwards: scripts/from-history.sh into a scratch copy). Each row
// counts the strings that text shows; "visible" is what a person sees
// without opening anything, "behind" what round 2 moved behind
// Lisätietoja (round 1's own "Mitä lista rajoittaa?" is counted the same
// way). A word is a whitespace-separated token with a letter or digit; a
// URL counts as one. Organisation names are filled in as on the page.
import {createRequire} from 'node:module';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {build}=require('esbuild');
const lang=process.argv[2]==='en'?'en':'fi';
async function load(dir){
 const r=await build({entryPoints:[join(dir,'text.ts')],bundle:true,write:false,format:'esm',platform:'neutral'});
 return (await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'))).TEXT[lang];
}
const A=await load(resolve(here,'../2026-11-27-entra-organisaatiot'));
const B=await load(here);
const words=(...xs)=>xs.flat(9).filter((x)=>typeof x==='string').join(' ').split(/\s+/).filter((w)=>/[\p{L}\p{N}]/u.test(w)).length;
const org='Asiakas Yksi Oy',pub='Esimerkki Konsultit Oy',url='https://login.microsoftonline.com/x/v2.0/adminconsent';
const L=['full','nosend','drafts','read'];
const R1=A.refusals,R2=B.refusals;
const rows=[
 ['Microsoft-rivi ja organisaatiolista',
  [A.orgsTitle,A.own,A.consentOpen,A.removeOpen,A.addOrg,A.labelsPublic],[],
  [B.orgsCount(3),B.orgsShow,B.own,B.consentOpen,B.removeOpen,B.addOrg,B.more],[B.moreList[0]]],
 ['Lisäysikkuna',
  [A.addTitle,A.addLead,A.labelField,A.labelHint,A.tenantField,A.tenantHint,A.cancel,A.addSave],[],
  [B.addTitle,B.labelField,B.labelHint,B.tenantField,B.more,B.cancel,B.addSave],[B.moreAdd[0]]],
 ['Hyväksyntäpaneeli (ilman viestiä)',
  [A.consentTitle(org),A.consentLead(org),A.consentUnknown,A.levelLinks,L.map((l)=>[A.levelShort[l],A.levelSays[l]]),A.messageTitle,A.messageCopy,A.role,A.done],[],
  [B.consentTitle(org),B.consentLead,B.messageCopy,B.linksTitle,L.map((l)=>B.levelShort[l]),B.more,B.done],[B.moreConsent]],
 ['Rajoitus',
  [A.limitShort,A.limitMore],[A.limitTitle,A.limit],
  [B.limitShort],[B.moreList[1],B.moreAdd[1]]],
 ['Poiston vahvistus',
  [A.removeTitle(org),A.removeDoes.map((f)=>f(org)),A.removeLimit,A.cancel,A.removeConfirm],[],
  [B.removeTitle(org),B.removeBody,B.more,B.cancel,B.removeConfirm],[B.moreRemove]],
 ['Viesti asiakkaan pääkäyttäjälle',
  [A.message({org,publisher:pub,links:L.map((l)=>({level:A.levelShort[l],says:A.levelSays[l],url}))})],[],
  [B.message({org,publisher:pub,links:L.map((l)=>({level:B.levelShort[l],url}))})],[]],
 ['Henkilö: rivit, yhdistäminen, vierastilin kortti',
  [A.rowNot,A.connectShort,A.orgChosen(org),A.orgGuestLine,A.orgUnknownLevels,A.guestFiles(org),A.cardOrg(org,A.guest),A.svcMail,A.svcCalendar,A.svcContacts,A.guestOff,A.guestOff,A.guestOff,A.guestOffNote(org)],[],
  [B.rowNot,B.connectShort,B.orgChosen(org),B.orgGuestLine,B.guestFiles,B.cardOrg(org,B.guest),B.guestOff],[]],
 ['Kieltäytyminen: ei hyväksyntää',
  [R1.consent_required.lead(org,A.levelShort.read),R1.consent_required.body,A.consentLinkLabel,R1.consent_required.askCopy,R1.consent_required.after],[],
  [R2.consent_required.lead(org,B.levelShort.read),R2.consent_required.body,R2.consent_required.askCopy],[]],
 ['Kieltäytyminen: pyyntö pääkäyttäjälle',
  [R1.consent_required.ask(org,A.levelShort.read,url)],[],[R2.consent_required.ask(org,B.levelShort.read,url)],[]],
 ...['not_in_organisation','device_code_blocked','organisation_unavailable'].map((c)=>[`Kieltäytyminen: ${c}`,
  [R1[c].lead(org),R1[c].body],[],[R2[c].lead(org),R2[c].body],[]]),
 ['Kieltäytyminen: expired (asiakas)',
  [R1.expired.lead,R1.expired.body,R1.expired.client],[],[R2.expired.lead,R2.expired.body,R2.expired.client,R2.consent_required.askCopy],[]],
];
let t=[0,0,0,0];
console.log('| Teksti | Kierros 1 näkyvissä | Kierros 1 avattavissa | Kierros 2 näkyvissä | Kierros 2 Lisätietoja |');
console.log('| --- | ---: | ---: | ---: | ---: |');
for(const [name,...g] of rows){const n=g.map((x)=>words(x));n.forEach((v,i)=>{t[i]+=v;});console.log(`| ${name} | ${n.join(' | ')} |`);}
console.log(`| **Yhteensä** | **${t.join('** | **')}** |`);
