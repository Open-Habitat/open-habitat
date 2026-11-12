// Rename through Pi's native writer without starting an agent, loading user
// extensions, or reading provider credentials. The daemon holds the same owner
// and admission fences as a resumed RPC child for this helper's lifetime.
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const [entry, manifest, path, id, cwd] = process.argv.slice(-5);
try {
  if (JSON.parse(readFileSync(manifest, 'utf8')).version !== '1.5.2') throw Error('version');
  const { SessionManager } = await import(new URL('./core/session-manager.js', pathToFileURL(entry)).href);
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const name = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const session = SessionManager.open(path);
  if (session.getSessionId() !== id || session.getCwd() !== cwd) throw Error('session');
  session.appendSessionInfo(name);
} catch {
  process.exitCode = 1;
}
