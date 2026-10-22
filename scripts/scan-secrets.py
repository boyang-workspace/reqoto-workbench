#!/usr/bin/env python3
"""Scan versioned files (never prints matched values). Run after git add."""
import pathlib
import re
import subprocess
import sys
root = pathlib.Path(__file__).resolve().parents[1]
files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
patterns = [
    re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    re.compile(rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b'),
    re.compile(rb'\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}\b'),
    re.compile(rb'\bAKIA[A-Z0-9]{16}\b'),
    re.compile(rb'(?i)(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*[\x22\x27][A-Za-z0-9_+/=-]{24,}[\x22\x27]'),
]
blocked = {'.env', 'workspace.json', 'Cookies', 'Login Data', 'Local State'}
errors = []
for name in filter(None, files):
    path = root / name
    if path.is_symlink():
        errors.append(f'{name}: symlink requires manual review')
        continue
    if path.name in blocked or path.name.startswith('.env') or path.suffix.lower() in {'.gguf', '.safetensors', '.pem', '.key'} or any(part in {'node_modules', 'dist', 'Partitions', 'user-data', '.runtime', 'models'} for part in path.parts[len(root.parts):]):
        errors.append(f'{name}: private/generated artifact')
        continue
    data = path.read_bytes()
    if path.suffix.lower() in {'.png', '.icns', '.jpg'}:
        continue
    for number, line in enumerate(data.splitlines(), 1):
        if any(pattern.search(line) for pattern in patterns):
            errors.append(f'{name}:{number}: possible credential')
        if path.name != 'scan-secrets.py' and any(value in line for value in [b'/Users/' + b'boyangxie', b'boyangxie.work' + b'@gmail', b'boyang_' + b'xie', b'the_' + b'yups_com']):
            errors.append(f'{name}:{number}: personal data reference')
if errors:
    print('\n'.join(errors))
    sys.exit(1)
print(f'Checked {len(list(filter(None, files)))} versioned files; no matching secrets or private artifacts found.')
