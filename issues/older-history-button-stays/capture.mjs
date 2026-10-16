// Run from repository root against the synthetic manual lab only.
import { openLab, snapshot } from '../../web/lab/session.mjs';
import { expect } from '../../web/node_modules/@playwright/test/index.mjs';
const {browser,page} = await openLab();
await page.getByRole('navigation').getByRole('link',{name:'aurinkokello',exact:true}).click();
await page.getByRole('button',{name:'Aloita uusi Pi-keskustelu'}).click();
const editor=page.getByRole('textbox',{name:'Viesti Pi:lle'});
for(let i=1;i<=8;i++){
 await editor.fill(`Kierros ${i}`);
 await page.getByRole('button',{name:'Lähetä',exact:true}).click();
 await expect(page.getByText(`Selvä. Kysyit: "Kierros ${i}".`,{exact:false})).toBeVisible({timeout:30000});
 await expect(editor).toBeEnabled({timeout:30000});
}
const pager=page.getByRole('button',{name:'Lataa vanhempi historiasivu'});
console.log('pager after eight fully loaded live turns',await pager.count());
await page.locator('.ah-conversation-stream').evaluate(el=>{el.dispatchEvent(new WheelEvent('wheel',{deltaY:-10000}));el.scrollTop=0;});
await page.waitForTimeout(250);
await snapshot(page,`issues/older-history-button-stays/evidence/${process.env.PHASE || 'before'}-live-complete`);
await page.reload();
await expect(pager).toBeVisible();
for(let i=0;i<6 && await pager.count();i++){
 const response=page.waitForResponse(r=>r.url().includes('/history?')&&r.url().includes('before='));
 await pager.click(); await response; await page.waitForTimeout(150);
}
console.log('pager at oldest entry',await pager.count());
await page.getByRole('button',{name:'Tiedot',exact:true}).click();
await page.getByRole('button',{name:'Tarkista keskustelun tila'}).click();
await page.waitForTimeout(1000);
await page.locator('.ah-conversation-stream').evaluate(el=>{el.dispatchEvent(new WheelEvent('wheel',{deltaY:-10000}));el.scrollTop=0;});
await page.waitForTimeout(250);
console.log('pager after refresh of complete window',await pager.count());
await snapshot(page,`issues/older-history-button-stays/evidence/${process.env.PHASE || 'before'}-refreshed-complete`);
await browser.close();
