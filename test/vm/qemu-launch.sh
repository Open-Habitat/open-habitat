#!/bin/sh
# Disposable VM only; explicit drive ordering keeps the seed and home separate.
set -eu
scenario=$1
run=$2
qemu-img create -q -f qcow2 -F qcow2 -b /cache/noble-server-cloudimg-amd64.img "$run/overlay.qcow2"
if test "$scenario" = core-runtime; then
  # Cloud-init grows only this disposable root. Runtime archive + private spool
  # + expanded Node/npm tree must coexist; the stock 3.5G image is too small.
  qemu-img resize -q "$run/overlay.qcow2" 8G
fi
set -- -drive "file=$run/overlay.qcow2,if=virtio,format=qcow2" \
  -drive "file=$run/seed.img,if=virtio,format=raw,readonly=on"
if test "$scenario" = two-user-routing || test "$scenario" = host-boot-storage || test "$scenario" = host-prepare || test "$scenario" = host-prepare-probe; then
  # Explicit devices can be realized before legacy -drive devices. Pin the
  # OS boot priority so SeaBIOS cannot choose the blank home disk first.
  set -- -drive "file=$run/overlay.qcow2,if=none,format=qcow2,id=oh-root" \
    -device virtio-blk-pci,drive=oh-root,bootindex=1 \
    -drive "file=$run/seed.img,if=virtio,format=raw,readonly=on"
  qemu-img create -q -f raw "$run/home.raw" 1G
  set -- "$@" -drive "file=$run/home.raw,if=none,format=raw,id=oh-home" \
    -device virtio-blk-pci,drive=oh-home,serial=oh-quota-home
fi
if test -f "$run/product.iso"; then
  set -- "$@" -drive "file=$run/product.iso,media=cdrom,readonly=on"
fi
if test "$scenario" != jit-reboot-diagnostic && test "$scenario" != host-boot-storage; then
  set -- -no-reboot "$@"
fi
exec qemu-system-x86_64 -accel tcg -machine q35 -m 2048 -smp 2 \
  -display none -monitor none -serial stdio \
  -nic user,model=virtio-net-pci,restrict=on "$@"
