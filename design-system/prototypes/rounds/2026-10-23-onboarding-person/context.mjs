// Capture the current production surfaces in the isolated synthetic lab.
// Start a lab and set .cache/lab/port first; never target the real service.
import {openLab,snapshot,origin} from '../../../../web/lab/session.mjs';
const out='issues/proto-onboarding-person/context';
const {browser,page}=await openLab();
try{
 await page.request.get(origin+'/fixture/scenario?value=pi-onboarding');
 await page.request.get(origin+'/fixture/pi-state?value=missing');
 await page.reload();
 const confirm=page.getByTestId('git-identity-confirm');
 await confirm.or(page.getByTestId('git-identity-continue')).waitFor();
 if(await confirm.isVisible())await confirm.click();else await page.getByTestId('git-identity-continue').click();
 await page.getByTestId('repository-chooser').waitFor();
 await snapshot(page,`${out}/production-repositories`);
 await page.request.get(origin+'/fixture/scenario?value=ready');
 await page.request.get(origin+'/fixture/pi-state?value=ready');
 await page.goto(origin+'/settings/integrations');
 await page.locator('.ig-main').waitFor();
 await snapshot(page,`${out}/production-integrations`);
 await page.goto(origin+'/settings/server');
 await page.waitForTimeout(500);
 await snapshot(page,`${out}/production-server`);
 console.log('Production synthetic context captured');
}finally{await browser.close()}
