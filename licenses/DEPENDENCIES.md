# Dependency and license boundary

Open Habitat has no third-party Go module in the foundation. Browser
runtime and build dependencies are exact pins in `web/package-lock.json`.
`scripts/check-licenses.py` requires every direct package to declare license
metadata and rejects AGPL/GPL dependencies. Transitive notices remain available
from the lockfile/package artifacts; adding a dependency requires review of its
source, authority boundary, maintenance status and license before lockfile
commit. This repository has not yet selected a public distribution license, so
no script may imply permission beyond dependency licenses.
