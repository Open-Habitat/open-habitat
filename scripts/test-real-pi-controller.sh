#!/usr/bin/env bash
# Disposable, networkless rootless Linux proof; never mounts a real home.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
art=${OH_PI_ARTIFACT_DIR:?set OH_PI_ARTIFACT_DIR to the directory containing the pinned Node and Pi archives}
[[ $(id -u) != 0 ]] || { echo 'rootless invocation required' >&2; exit 1; }
command -v podman >/dev/null
[[ $(podman info --format '{{.Host.Security.Rootless}}') == true ]]
for spec in '680d3f30b24a7ff24b98db5e96f294c0070f8f9078df658da1bce1b9c9873c88 node-v22.21.1-linux-x64.tar.xz' '396b0d8490b427dec858162977ca2ef202da87ed5415a85840a6553fad2d4306 pi-node-modules.tar.gz'; do
  read -r digest name <<< "$spec"
  [[ $(sha256sum "$art/$name" | cut -d' ' -f1) == "$digest" ]] || { echo 'pinned artifact missing or changed' >&2; exit 1; }
done
podman image exists localhost/open-habitat-vm-tools:prereq || { echo 'offline prerequisite image unavailable' >&2; exit 1; }
[[ -x $repo/.tools/go/bin/go ]] && go=$repo/.tools/go/bin/go || go=$(command -v go || true)
[[ -x $go ]] || { echo 'Go unavailable; run scripts/bootstrap-tools.sh or provide Go on PATH' >&2; exit 1; }
export TMPDIR=/var/tmp
mkdir -p "$repo/.cache"
"$go" build -o "$repo/.cache/real-pi-controller" ./cmd/open-habitat
chmod 755 "$repo/.cache/real-pi-controller"
podman run --rm --pull=never --network none --cap-drop=ALL --cap-add=SETUID --cap-add=SETGID --cap-add=CHOWN --cap-add=FOWNER --cap-add=DAC_OVERRIDE --cap-add=KILL --cap-add=NET_BIND_SERVICE \
  -v "$repo/.cache/real-pi-controller:/fixture/product:ro" \
  -v "$repo/test/real-pi-controller.py:/fixture/proof.py:ro" \
  -v "$repo/test/vm/fake-gh.py:/fixture/gh.py:ro" -v "$repo/test/vm/fake-git.py:/fixture/git.py:ro" \
  -v "$repo/test/vm/fake-provider.py:/fixture/provider.py:ro" \
  -v "$repo/internal/daemon/pi_device_helper.mjs:/fixture/helper.mjs:ro" \
  -v "$art/node-v22.21.1-linux-x64.tar.xz:/fixture/node.tar.xz:ro" \
  -v "$art/pi-node-modules.tar.gz:/fixture/pi.tar.gz:ro" \
  localhost/open-habitat-vm-tools:prereq /usr/bin/python3 /fixture/proof.py
