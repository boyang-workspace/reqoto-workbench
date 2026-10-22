# Contributing

Use Node.js 22.12+ and run `npm ci`, `npm run check`, `npm test`, and `npm run scan`.
For packaging changes, build on macOS with `npm run package:mac` and verify the app
contains its source adapters, LICENSE, NOTICE and Electron/Chromium notices.

Open an issue describing the problem, then send a focused pull request with the
behavior change and relevant validation. Never include real cookies, API keys,
browser profiles, model weights, private screenshots or copied user conversations.
Tests and media fixtures must use synthetic data.

Keep remote pages sandboxed with context isolation and without Node integration.
Validate privileged IPC against the trusted local shell. Keep AI drafts safe and
require user action to send or publish. Do not bypass site authentication or
anti-abuse controls.

By submitting a contribution, you agree to license it under this repository's
Apache-2.0 license. Preserve existing copyright and attribution notices.
