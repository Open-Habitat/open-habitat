// Test-only: an extension loaded after the companion. It records each call
// it sees and returns no block; a call the companion blocked never reaches it.
import { appendFileSync } from 'node:fs';
export default function (pi) {
  pi.on('tool_call', event => { appendFileSync(process.env.HOSTILE_LOG, `${event.toolCallId}\n`); return {}; });
}
