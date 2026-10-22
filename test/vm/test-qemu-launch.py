#!/usr/bin/env python3
"""Exercise the real launch recipe without booting or creating any image."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

LAUNCH = Path(__file__).with_name('qemu-launch.sh')

class QemuArguments(unittest.TestCase):
    def test_optional_product_disk_does_not_drop_home_or_seed(self):
        with tempfile.TemporaryDirectory(prefix='oh-qemu-argv-', dir='/var/tmp') as scratch:
            root = Path(scratch)
            tools = root / 'bin'
            tools.mkdir()
            for name, body in [('qemu-img', '#!/bin/sh\nexit 0\n'),
                               ('qemu-system-x86_64', '#!/bin/sh\nprintf "%s\\n" "$@"\n')]:
                file = tools / name
                file.write_text(body)
                file.chmod(0o700)
            env = {**os.environ, 'PATH': str(tools) + ':' + os.environ['PATH']}
            for product in (False, True):
                if product:
                    (root / 'product.iso').touch()
                for scenario in ('two-user-routing', 'host-prepare-probe', 'systemd-self-test', 'jit-reboot-diagnostic'):
                    with self.subTest(product=product, scenario=scenario):
                        args = subprocess.check_output(['/bin/sh', str(LAUNCH), scenario, str(root)], env=env, text=True).splitlines()
                        drives = [args[i+1] for i, arg in enumerate(args) if arg == '-drive']
                        os_drive = (f'file={root}/overlay.qcow2,if=none,format=qcow2,id=oh-root' if scenario in ('two-user-routing', 'host-prepare-probe') else f'file={root}/overlay.qcow2,if=virtio,format=qcow2')
                        self.assertEqual(drives[:2], [os_drive, f'file={root}/seed.img,if=virtio,format=raw,readonly=on'])
                        self.assertEqual('virtio-blk-pci,drive=oh-root,bootindex=1' in args, scenario in ('two-user-routing', 'host-prepare-probe'))
                        self.assertEqual(len(drives), 2 + int(product) + int(scenario in ('two-user-routing', 'host-prepare-probe')))
                        self.assertEqual('virtio-blk-pci,drive=oh-home,serial=oh-quota-home' in args, scenario in ('two-user-routing', 'host-prepare-probe'))
                        self.assertEqual(any('product.iso' in drive for drive in drives), product)
                        self.assertEqual('-no-reboot' in args, scenario != 'jit-reboot-diagnostic')

if __name__ == '__main__':
    unittest.main()
