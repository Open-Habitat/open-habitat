// Current production-context capture; never use a live host or real profile.
// node lab-check.mjs <disposable-source-root> <evidence-dir>
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const [repo,out]=process.argv.slice(2);
const {snapshot,origin:labOrigin}=await import(pathToFileURL(resolve(repo,'web/lab/session.mjs')));
// Use the already-cached browser/runtime used for the authored prototype too.
const {chromium}=await import('playwright');
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true});
await page.goto(labOrigin+'/workspaces');
await page.getByRole('button',{name:'Kirjaudu GitHubilla'}).click();
await page.getByRole('link',{name:'Alice',exact:true}).click();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 const origin=new URL(page.url()).origin;
 assert.equal((await page.request.get(origin+'/fixture/lab-marker')).status(),204);
 await page.goto(origin+'/settings/editori');
 await page.getByTestId('editor-settings').waitFor();
 await snapshot(page,resolve(out,'production-settings-1440-light'));
 await page.goto(origin+'/settings/ulkoasu');
 await page.getByTestId('theme-choice').waitFor();
 await snapshot(page,resolve(out,'production-appearance-1440-light'));
 const session=await (await page.request.get(origin+'/auth/session')).json();
 await page.evaluate(id=>localStorage.setItem(`nah:editor:v1:${id}`,'codemirror6'),session.web_identity_id);
 await page.goto(origin+'/agents/pi:a1a1a1a1-0000-4000-8000-000000000001');
 await page.getByTestId('toggle-editor').click();
 await page.getByTestId('editor-file-entry').filter({hasText:'cmd'}).click();
 await page.getByTestId('editor-file-entry').filter({hasText:'main.go'}).click();
 await page.getByTestId('editor-document').waitFor();
 await snapshot(page,resolve(out,'production-editor-1440-light'));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({productionLab:true,captures:3,pageErrors:0}));
}finally{await browser.close();}
