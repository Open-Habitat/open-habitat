// Run against the host-pinned Pi package, with a DISPOSABLE HOME, e.g.
// HOME=/var/tmp/oh-skill-fixture node native-check.mjs /absolute/path/to/@earendil-works/pi-coding-agent
// Writes synthetic skills only below that HOME. No provider call or Pi session.
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const home=process.env.HOME;
assert.ok(home?.startsWith('/var/tmp/'), 'Use a disposable HOME under /var/tmp');
const sdk=resolve(process.argv[2]);
const {DefaultResourceLoader}=await import(pathToFileURL(sdk+'/dist/core/resource-loader.js'));
const {SettingsManager}=await import(pathToFileURL(sdk+'/dist/core/settings-manager.js'));
const cwd=home+'/repo',agentDir=home+'/.pi/agent';
for(const [dir,name] of [[agentDir+'/skills/review','review'],[cwd+'/.pi/skills/review','review'],[home+'/.agents/skills/global','global'],[cwd+'/.agents/skills/repo','repo']]) {
 mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'/SKILL.md',`---\nname: ${name}\ndescription: Synthetic ${name}\n---\nSynthetic only.`);
}
mkdirSync(cwd+'/.git',{recursive:true});
const settingsManager=SettingsManager.create(cwd,agentDir);
settingsManager.setProjectTrusted(true);
const loader=new DefaultResourceLoader({cwd,agentDir,settingsManager,noExtensions:true,noThemes:true,noPromptTemplates:true});
await loader.reload();const trusted=loader.getSkills();
assert.equal(trusted.skills.find(s=>s.name==='review').filePath,cwd+'/.pi/skills/review/SKILL.md');
assert.ok(trusted.skills.some(s=>s.name==='global'));assert.ok(trusted.skills.some(s=>s.name==='repo'));
assert.equal(trusted.diagnostics.filter(d=>d.type==='collision').length,1);
settingsManager.setProjectTrusted(false);await loader.reload();const untrusted=loader.getSkills();
assert.equal(untrusted.skills.find(s=>s.name==='review').filePath,agentDir+'/skills/review/SKILL.md');
assert.ok(!untrusted.skills.some(s=>s.sourceInfo.scope==='project'));
console.log(JSON.stringify({trusted,untrusted},null,2));
