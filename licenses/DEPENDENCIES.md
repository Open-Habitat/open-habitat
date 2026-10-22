# Dependency and license boundary

Open Habitat has no third-party Go module in the foundation. Browser
runtime and build dependencies are exact pins in `web/package-lock.json`.
`scripts/check-licenses.py` requires every direct package to declare license
metadata and rejects AGPL/GPL dependencies. Transitive notices remain available
from the lockfile/package artifacts; adding a dependency requires review of its
source, authority boundary, maintenance status and license before lockfile
commit. This repository has not yet selected a public distribution license, so
no script may imply permission beyond dependency licenses.

The optional native Pi process owner is `@aliou/pi-processes` 0.10.9 (MIT),
pinned and installed through Fleetrepo's guest runtime, not bundled JavaScript
in the browser. Its parser is overridden to `@aliou/sh` 0.3.4 (MIT AND
BSD-3-Clause), retaining upstream attribution; 0.2.2 declares UNLICENSED and is
not shipped. The synthetic Pi integration-test lockfile mirrors that override.
The product companion itself is original code embedded in the Go binary.

CodeMirror 6 and its Lezer parser/highlighter packages are MIT-licensed upstream
modules from the maintained CodeMirror project. They run as bundled browser
text-editing libraries only, with no repository plugins, preview execution,
network loader or language-server process. The selected grammars load on demand;
versions and transitive artifacts are pinned in the web lockfile.
