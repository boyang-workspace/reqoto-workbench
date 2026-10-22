# Reqoto Workbench

一个把多账号社媒浏览、帖子采集和 AI 对话放在同一窗口的桌面工作台。

- 左侧管理独立登录的账号，自动识别头像，支持拖拽排序。
- 中间浏览原始社媒网站。X 帖子下的 Reqoto 工具条可以采集文字、图片、视频采样帧和可读取的对话背景。
- 右侧登录自己的 ChatGPT 或 Grok，自由切换对话；社媒账号与 AI 对话不强制绑定。
- 按社媒账号配置人设、语气、语言及提示词模版；可选本地 d1 或云端 BYOK 筛选值得回复的帖子。
- 支持分栏拖拽、中英文、浅色和深色模式。

这是早期原型，目前支持和验证的是 macOS。可以浏览 X 和小红书，帖子工具条、采集和筛选目前针对 X。不会自动发帖、点赞或关注。

## 启动

需要 Node.js 22.12+、npm。打包还需要 Python 3 和 Apple Command Line Tools。

```sh
git clone https://github.com/boyang-workspace/reqoto-workbench.git
cd reqoto-workbench
npm ci
npm start
```

点左侧 **+** 添加平台并登录。右侧登录 AI。在 X 帖子下点 **Send to AI**，检查生成的草稿后自行发送。已有 AI 草稿会被保留。

```sh
npm run check
npm test
npm run package:mac
open 'dist/Reqoto Workbench.app'
```

打包结果仅作本地临时签名，尚未经过 Apple 公证，没有稳定签名安装包。默认不包含模型和 llama 运行时；当前 Apple Silicon 的未压缩 app 约 315 MB。

## 模型与隐私

模型不是必需依赖。可在账号设置中选择本地 d1 的运行时、GGUF 和可选视觉投影文件，或填入支持的云端提供商 API Key。参见[配置文档](local-models.md)。

没有 Reqoto 后端或遥测。登录状态、设置及反馈保存在本机应用数据目录；社媒网站和 AI 网站仍会连接各自服务。点击发送至 AI 会把内容填入该 AI 网页；开启云端筛选会把相关内容交给所选模型提供商。本地筛选运行于本机。

不要分享浏览器资料目录、Cookie、workspace.json、API Key 或真实对话截图。账号隔离不等于匿名，也不能保证不会触发平台限制。

## 开源

桌面端及其使用的 Reqoto 模块采用 [Apache-2.0](../LICENSE)。第三方依赖和可选模型遵循各自许可证。原浏览器插件完整源码及个人数据不在此仓库。

贡献前请阅读 [CONTRIBUTING.md](../CONTRIBUTING.md)。
