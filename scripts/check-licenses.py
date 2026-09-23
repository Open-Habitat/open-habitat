#!/usr/bin/env python3
"""Fail closed on missing or disallowed direct dependency license metadata."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
lock=json.loads((root/'web/package-lock.json').read_text())
direct=set(lock['packages'][''].get('dependencies',{}))|set(lock['packages'][''].get('devDependencies',{}))
missing=[]; denied=[]
for name in sorted(direct):
    item=lock['packages'].get(f'node_modules/{name}',{})
    license=item.get('license')
    if not license: missing.append(name)
    if license and any(word in license.upper() for word in ('AGPL','GPL-')): denied.append(f'{name}:{license}')
if missing or denied: raise SystemExit(f'license boundary failed; missing={missing}, denied={denied}')
print(f'License boundary valid: {len(direct)} direct web dependencies declare metadata; no AGPL/GPL dependency accepted.')
