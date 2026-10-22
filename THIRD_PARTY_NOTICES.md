# Third-party notices

Reqoto Workbench's first-party source is licensed under Apache-2.0. The name and
logo are not a grant of trademark rights (see LICENSE, section 6).

- **Electron**: MIT, copyright Electron contributors and GitHub Inc.
  Source: https://github.com/electron/electron
- **Chromium and Electron's bundled components**: multiple licenses. Every macOS
  app produced by the packaging script includes Electron's full LICENSE and
  LICENSES.chromium.html in Contents/Resources/third-party/.
- **Development dependencies**: their respective license texts are installed with
  npm ci; exact versions and declared licenses are recorded in package-lock.json.
  They are not copied into the packaged app as node_modules.
- **Optional llama.cpp runtime**: MIT and applicable bundled dependency licenses.
  It is not included in the source repository or default app build. If you use
  --runtime-dir, supply a complete redistributable runtime and all required notices.
  Source: https://github.com/ggml-org/llama.cpp
- **Optional LiquidAI d1 model and vision projector**: LFM Open License v1.0,
  separate from Apache-2.0. No weights are distributed by this repository or its
  default packaging flow. Obtain and review them from the model publisher:
  https://huggingface.co/LiquidAI/d1-3B-GGUF

X, Xiaohongshu, ChatGPT and Grok are third-party services and trademarks. Their
websites, content and model services are not licensed by this project. Reqoto is
an independent project and is not affiliated with those providers.
