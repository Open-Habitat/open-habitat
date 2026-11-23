// Keep the reader on the runtime's locked browser, regardless of a person's
// standalone Pi browser setting. Host-specific setup advice belongs here.
import { registerPageReader } from '@open-habitat/pi-page-reader/extension.mjs';
import { fileURLToPath } from 'node:url';

export default function (pi) {
	registerPageReader(pi, {
		browserDirectory: fileURLToPath(new URL('../browsers', import.meta.url)),
		sandboxHint: "The administrator installs Open Habitat's AppArmor profile for the headless browser (upgrading Open Habitat does it).",
	});
}
