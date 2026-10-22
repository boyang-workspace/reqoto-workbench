# Reqoto Workbench

A desktop workspace for browsing multiple social accounts and preparing replies
with the AI service you already use.

[简体中文](docs/README.zh-CN.md) · [Architecture](docs/architecture.md) · [Local models](docs/local-models.md)

- **Account rail**: separate persistent browser sessions, detected account avatars,
  drag to reorder and notification dots for supported X navigation indicators.
- **Social pane**: browse in the original website, with Reqoto's toolbar under X
  posts. Capture visible text, images, sampled video frames and available thread context.
- **AI pane**: use ChatGPT or Grok with your own login and conversations. The AI
  provider is independent of the social account. Captures prepare a draft; you send it.
- **Per-account settings**: persona, tone, response language, saved prompt templates
  and an advanced prompt editor. Optional REPLY / SKIP / REVIEW screening via local
  d1 or supported cloud BYOK providers.
- Resizable panes, light/dark appearance and Chinese/English interface.

**Early prototype.** macOS is the currently supported and locally tested platform.
The browser can open X and Xiaohongshu; post extraction, toolbars and reply
screening currently target X. Website changes can break login or capture adapters.
No automatic posting, liking, following or background timeline crawler is included.

## Run from source

Requires Node.js 22.12+ and npm. macOS packaging also requires Python 3 and Apple's
Command Line Tools (`xcode-select --install`).

```sh
git clone https://github.com/boyang-workspace/reqoto-workbench.git
cd reqoto-workbench
npm ci
npm start
```

Start with an empty rail. Click **+**, choose a platform, then sign in inside the
social pane. Add another workspace account to get a separate session, even on the
same platform. Log into ChatGPT or Grok on the right. In a loaded X post, click
**Send to AI** to prepare context using the active account's prompt. Review the
result before sending. Existing AI drafts are preserved rather than overwritten.

For Google login, a passkey screen can require a verification method supported by
the embedded browser; choose another sign-in method if it stalls.

## Build a macOS app

```sh
npm run check
npm test
npm run package:mac
open 'dist/Reqoto Workbench.app'
```

The result is ad-hoc signed for local use, **not notarized**. There is no stable
signed installer release yet. The default build includes Electron but no model
weights or llama runtime. On Apple Silicon, the current uncompressed app is about
315 MB; this varies by Electron version and architecture.

## Optional reply screening

Open an account's settings to choose local d1, LiquidAI d1 BYOK or Jev BYOK, then
set your reply criteria. Screening is off until enabled. Treat its labels as
suggestions and review the original post. Local d1 needs a compatible
`llama-server`, GGUF model and optional vision projector selected in settings;
see [setup and data flow](docs/local-models.md).

## Privacy and storage

There is no Reqoto backend or telemetry in this prototype. Login cookies and
workspace settings stay in Electron's local application data directory (on macOS,
`~/Library/Application Support/Reqoto Workbench/`). Treat that directory as private;
it contains authenticated sessions and may contain prompts and feedback.

Social pages and AI websites still communicate with their own providers. Clicking
Send to AI transfers the captured context into the selected AI website's draft.
Enabling cloud screening sends supported post content to the selected model
provider using your key. Local screening runs on loopback on your computer. API
keys use OS-backed encryption when available; otherwise they remain in memory for
the current app session. Do not commit or share browser profiles or workspace.json.

Session isolation prevents accidental cookie sharing; it does not provide
anonymity or a guarantee against platform account restrictions.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). Please use
synthetic content in bug reports and screenshots. This public repository contains
the desktop workbench and the Reqoto modules it needs, not the entire browser
extension or any personal browser data.

## License

Copyright 2026 Reqoto contributors. First-party source is licensed under
[Apache-2.0](LICENSE). See [NOTICE](NOTICE) and
[third-party notices](THIRD_PARTY_NOTICES.md) for dependency and optional model terms.
