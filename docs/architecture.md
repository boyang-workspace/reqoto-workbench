# Architecture

The Electron main process (`src/main.cjs`) owns the workspace and native
WebContentsView panes. Local HTML/CSS/JS provides the account rail and controls;
social and AI sites run in sandboxed, isolated web contents without Node access.
The settings drawer overlays the social pane rather than narrowing its viewport.

Each social workspace identity gets a persistent session partition. The visible
account is detected from the page after login; it is not a preconfigured brand.
AI providers have their own shared session and remain independent of social
identities. Changing social accounts does not bind or navigate the AI conversation.
Users can navigate to another conversation or switch supported providers.

`src/reqoto-adapter/` contains first-party modules adapted from Reqoto: X DOM
extraction, post toolbar, prompts and ChatGPT/Grok composer filling. `reqoto.cjs`
installs them in isolated worlds with a restricted browser-extension shim.
Capture delivery validates the active account, post and destination, preserves
existing drafts, and reports partial context instead of inventing missing ancestry.
Websites can change; visible DOM extraction is not an official platform API.

`analysis.cjs` orchestrates optional screening; `judge.cjs` constructs bounded
decision questions. `local-models.cjs` launches the selected d1 runtime on a random
loopback port using an ephemeral bearer token. The cloud providers use explicit
BYOK configuration. Screening does not send social replies.

Workspace data is stored outside the source tree in Electron's userData directory.
Removing an account is an explicit danger-zone action in advanced settings. Never
include userData in build artifacts or issue attachments. Test fixtures use a
separate temporary profile and synthetic pages.

The first public source release was assembled from a local prototype. Its source
includes the required adapters and has no dependency on a sibling private repo.
