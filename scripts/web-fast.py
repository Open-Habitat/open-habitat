#!/usr/bin/env python3
"""Native fast feedback: execute the declared tool vectors, never a dispatcher."""
import json
from pathlib import Path
import subprocess
import sys

repo = Path(__file__).resolve().parent.parent
commands = json.loads((repo / 'scripts/web-commands.json').read_text())
for name in ('format:check', 'lint', 'typecheck', 'test:unit', 'test:component'):
    result = subprocess.call(commands[name], cwd=repo / 'web')
    if result:
        sys.exit(result)
