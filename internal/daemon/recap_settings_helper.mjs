// Invoked by the mapped-UID daemon with trusted Pi paths and settings it has
// already validated. Writes only openHabitat.recap, through Pi's own lock.
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [entry, manifest, value] = process.argv.slice(-3);
const storageCode = error => {
  for (let i = 0; error && i < 5; i++, error = error.cause) {
    if (error.code === 'EDQUOT' || error.code === 'ENOSPC') return error.code;
  }
};
try {
  if (JSON.parse(readFileSync(manifest, 'utf8')).version !== '1.5.2') throw Error('version');
  const recap = JSON.parse(value);
  const { SettingsManager } = await import(pathToFileURL(entry).href);
  const settings = SettingsManager.create(process.env.HOME, join(process.env.HOME, '.pi', 'agent'), { projectTrusted: false });
  for (const failure of settings.drainErrors()) throw failure.error;
  // Pi has no setter for a key of its own; this is what its setters do. The
  // nested mark keeps any other openHabitat key the file holds.
  const current = settings.getGlobalSettings().openHabitat;
  settings.globalSettings.openHabitat = { ...(current && typeof current === 'object' ? current : {}), recap };
  settings.markModified('openHabitat', 'recap');
  settings.save();
  await settings.flush();
  for (const failure of settings.drainErrors()) throw failure.error;
  process.stdout.write('{"saved":true}\n');
} catch (error) {
  const code = storageCode(error);
  if (code) process.stderr.write(code + '\n');
  process.stdout.write('{"saved":false}\n');
  process.exitCode = 1;
}
