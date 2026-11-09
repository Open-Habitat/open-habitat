// Offers the core runtime's Taskfleet skills to Pi after every skill the
// person or the project has: Pi appends skill paths an extension discovers
// behind its own discovered and configured ones and keeps the first of two
// skills with one name, so a person's or repository's own copy wins. Nothing
// is written into the person's settings.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The builder fills this directory with `skill install` from the locked
// Taskfleet binary, so a runtime pin bump also updates the offered skills.
const skills = join(dirname(fileURLToPath(import.meta.url)), 'skills');

export default function (pi) {
	pi.on('resources_discover', () => ({ skillPaths: [skills] }));
}
