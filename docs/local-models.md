# Optional local models and BYOK

Browsing and capture work without any model installation. For screening, open the
social account's settings and select local d1 or a supported cloud provider.

## Local d1

Obtain a compatible llama.cpp `llama-server` and LiquidAI d1 GGUF separately. Use
the publisher's [model card](https://huggingface.co/LiquidAI/d1-3B-GGUF) for model
files and upstream runtime instructions. The chosen runtime must support d1's
`/v1/systemone` API and the flags used in `src/local-models.cjs`; older or generic
OpenAI-compatible runtimes are not sufficient. The app launches the executable
itself, rather than attaching to an arbitrary existing server.

Select the runtime executable and model in settings. For image judgment, also
select the matching vision projector (mmproj GGUF). Missing vision context is not
proof that a post is irrelevant. This source distribution includes no weights,
runtime executable, download service or EmbeddingGemma integration.

For a first launch from source you can optionally provide absolute paths:

```sh
REQOTO_LLAMA_SERVER=/absolute/path/to/llama-server \
REQOTO_D1_MODEL=/absolute/path/to/d1-3B-Q8_0.gguf npm start
```

Saved selections take precedence. Alternatively the app discovers files under its
local data directory at `runtime/bin/llama-server` and `models/d1-3B-Q8_0.gguf`.
It never searches a neighboring private project. Model files remain outside the
app; removing or rebuilding the app does not delete them.

Run `npx install-electron` before invoking the Python packager directly.
To build with a redistributable runtime, use
`python3 scripts/package-macos.py --runtime-dir /absolute/path/to/runtime`.
That directory must contain `bin/llama-server`, its shared libraries and all
required LICENSE notices. Model weights are rejected by this packaging flow.
The normal `npm run package:mac` does not bundle a runtime.

The app binds inference to 127.0.0.1, chooses an available port and supplies a
per-process secret via the child environment. It stops its own runtime when
closing. Model inputs are not retained as raw runtime logs by Reqoto.

## Criteria

Describe what is relevant to the account and what you would be able to contribute:
for example, "Reply to creators sharing specific AI design workflows, demos or
problems where I can add a useful observation. Skip unrelated promotions,
giveaways and empty engagement bait. Review when important media is missing."

Start with a small sample, compare REPLY/SKIP/REVIEW to your own decisions and
adjust the criteria. Feedback examples guide future judgments; they do not
fine-tune the underlying model. Labels are recommendations, not guarantees.

## Cloud BYOK

LiquidAI d1 and Jev use the endpoints implemented in `src/judge.cjs`. Supply your
own provider key in settings. Content is sent only to the selected provider for
enabled screening; there is no automatic cloud fallback from local mode. Image
support depends on the provider. Model/provider costs and terms are separate from
Reqoto's source license.

LiquidAI's model weights are under the LFM Open License v1.0, not Apache-2.0;
review the [publisher's license](https://huggingface.co/LiquidAI/d1-3B-GGUF/blob/main/LICENSE)
before redistribution or commercial use.
