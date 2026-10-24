#!/usr/bin/env bash
# Runs inside the container as PID 1's child: fetch the pinned stock arm64
# cloud image, make a fresh overlay, a blank home volume and a cloud-init seed
# that pins the guest host key, then boot it. QEMU reboots the guest in place.
set -euo pipefail
cd /work
image=noble-server-cloudimg-arm64.img
if [[ ! -f $image ]]; then
  curl -fsSL --retry 3 -o "$image.part" https://cloud-images.ubuntu.com/noble/20260911/noble-server-cloudimg-arm64.img
  echo "7b682958a67ff5de068e36de6af8b75fa645d296af5a70d6500527f6a33781db  $image.part" | sha256sum -c -
  mv "$image.part" "$image"
fi
qemu-img create -q -f qcow2 -F qcow2 -b "$image" root.qcow2 30G
qemu-img create -q -f raw home.raw 8G
ssh-keygen -q -t ed25519 -N '' -C qualification -f id
ssh-keygen -q -t ed25519 -N '' -C guest-host -f hostkey
python3 - <<'PY'
import json
pub = open('id.pub').read().strip()
host_priv, host_pub = open('hostkey').read(), open('hostkey.pub').read().strip()
# Root login and no default user, as on a cloud provider's stock image: the
# harness requires an empty /home on the root filesystem before its volume.
user_data = '#cloud-config\n' + json.dumps({
    'users': [{'name': 'root', 'ssh_authorized_keys': [pub]}],
    'disable_root': False,
    'ssh_deletekeys': True,
    'ssh_keys': {'ed25519_private': host_priv, 'ed25519_public': host_pub},
    'ssh_pwauth': False,
})
open('user-data', 'w').write(user_data)
open('meta-data', 'w').write('instance-id: oh-arm64-qualification\nlocal-hostname: oh-arm64-qualification\n')
open('target.json', 'w').write(json.dumps({
    'host': '127.0.0.1', 'port': 2222, 'user': 'root', 'identity_file': '/work/id',
    'known_hosts': '[127.0.0.1]:2222 ' + ' '.join(host_pub.split()[:2]),
    'home_device': '/dev/disk/by-id/virtio-ohhome', 'expect_apt_mirror': 'ports.ubuntu.com'}))
PY
cloud-localds seed.img user-data meta-data
exec qemu-system-aarch64 -machine virt -cpu max -accel tcg,thread=multi -smp 6 -m 8192 \
  -bios /usr/share/qemu-efi-aarch64/QEMU_EFI.fd \
  -drive if=virtio,file=root.qcow2,format=qcow2 \
  -drive if=none,id=home,file=home.raw,format=raw -device virtio-blk-pci,drive=home,serial=ohhome \
  -drive if=virtio,file=seed.img,format=raw \
  -netdev user,id=n0,hostfwd=tcp:127.0.0.1:2222-:22,hostfwd=tcp:127.0.0.1:443-:443 -device virtio-net-pci,netdev=n0,romfile= \
  -display none -serial file:/work/serial.log -monitor none
