#!/usr/bin/env python3
"""Build an ad-hoc signed macOS app without browser data or model weights."""
import argparse
import json
import pathlib
import plistlib
import shutil
import subprocess
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--runtime-dir', type=pathlib.Path, help='Optional redistributable llama runtime directory, including bin/llama-server and LICENSE* files')
parser.add_argument('--desktop-shortcut', action='store_true')
args = parser.parse_args()
if sys.platform != 'darwin':
    sys.exit('macOS packaging requires macOS and codesign.')
root = pathlib.Path(__file__).resolve().parents[1]
electron = root / 'node_modules/electron/dist'
runtime = electron / 'Electron.app'
if not runtime.exists():
    sys.exit('Electron runtime missing. Run npm ci first.')
if args.runtime_dir:
    args.runtime_dir = args.runtime_dir.resolve()
    if not (args.runtime_dir / 'bin/llama-server').is_file() or not list(args.runtime_dir.glob('LICENSE*')):
        sys.exit('Runtime must contain bin/llama-server and its LICENSE* notices. Do not include model weights.')
    if any(args.runtime_dir.rglob('*.gguf')) or any(args.runtime_dir.rglob('*.safetensors')):
        sys.exit('Model weights must not be bundled.')
dist = root / 'dist'
dist.mkdir(exist_ok=True)
output = dist / 'Reqoto Workbench.app'
stage = dist / 'Reqoto Workbench.staging.app'
if stage.exists():
    shutil.rmtree(stage)
shutil.copytree(runtime, stage, symlinks=True)
resources = stage / 'Contents/Resources'
for item in [resources / 'default_app.asar', resources / 'app']:
    if item.is_dir():
        shutil.rmtree(item)
    elif item.exists():
        item.unlink()
appdir = resources / 'app'
appdir.mkdir()
pkg = json.loads((root / 'package.json').read_text())
for key in ['devDependencies', 'scripts']:
    pkg.pop(key, None)
(appdir / 'package.json').write_text(json.dumps(pkg, indent=2))
shutil.copytree(root / 'src', appdir / 'src')
for name in ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md']:
    shutil.copyfile(root / name, appdir / name)
credits = resources / 'third-party'
credits.mkdir()
for name in ['LICENSE', 'LICENSES.chromium.html']:
    shutil.copyfile(electron / name, credits / ('Electron-LICENSE.txt' if name == 'LICENSE' else name))
if args.runtime_dir:
    shutil.copytree(args.runtime_dir, resources / 'reqoto-runtime', symlinks=True)
icon = root / 'src/assets/reqoto.png'
shutil.copyfile(root / 'src/assets/reqoto.icns', resources / 'reqoto.icns')
plist = stage / 'Contents/Info.plist'
with plist.open('rb') as handle:
    info = plistlib.load(handle)
info.update(CFBundleName='Reqoto Workbench', CFBundleDisplayName='Reqoto Workbench', CFBundleIdentifier='app.reqoto.workbench.prototype', CFBundleShortVersionString=pkg['version'], CFBundleVersion=pkg['version'], CFBundleIconFile='reqoto.icns')
with plist.open('wb') as handle:
    plistlib.dump(info, handle)
subprocess.run(['codesign', '--force', '--deep', '--sign', '-', str(stage)], check=True)
subprocess.run(['codesign', '--verify', '--deep', '--strict', str(stage)], check=True)
if output.exists():
    backup = dist / 'Reqoto Workbench.previous.app'
    if backup.exists():
        shutil.rmtree(backup)
    output.rename(backup)
stage.rename(output)
if args.desktop_shortcut:
    subprocess.run(['xcrun', 'swift', '-module-cache-path', '/private/tmp/reqoto-swift-module-cache', str(root / 'scripts/refresh-desktop-shortcut.swift'), str(output), str(icon)], check=True)
print(output)
