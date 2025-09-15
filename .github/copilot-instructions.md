# 止水插件 (zhishui-plugin) — AI 代码助手使用说明

此文件为 AI 编码代理（Copilot / agent）提供项目特定的即时上下文与约定，帮助快速定位改动点并生成合适的代码。

主要目标：快速理解插件如何与宿主 Yunzai-Bot 集成、常见入口、依赖与运行命令，及项目约定。

要点（快速浏览）
- 项目入口：`index.js`，加载 `apps/` 下所有 `.js` 模块并导出 `apps` 对象。
- 适配层：`adapter/` 目录（如 `adapter/index.js`）在运行时尝试从宿主工程载入替代实现（例如 `lib/plugins/plugin.js`），优先使用宿主的实现。
- 工具库：`components/` 包含启动检查（`check.js`）、版本信息（`Version.js`）等启动辅助逻辑。
- 模板渲染与截图：内置的 `adapter/lib/puppeteer.js` 提供 headless Chromium 截图并返回 `segment.image(...)`（注意：需要宿主全局 `segment` 支持）。

运行与依赖
- package.json 指定 `type: module`。常用依赖请参考 `package.json` 中 `dependencies`。
- 启动前会执行 `components/check.js` 的 `checkPackage()`，如缺少依赖，日志会提示：
  - `pnpm install --filter=zhishui-plugin`（项目中提示使用 `pnpm`，也可用 `npm`/`yarn` 安装依赖）
- Puppeteer 可能需要手动安装 Chromium：`node ./node_modules/puppeteer/install.js`（见 `adapter/lib/puppeteer.js` 的日志提示）。

代码结构与重要文件（可直接打开）
- `index.js` — 插件入口，负责依赖检查、加载 `apps/` 中的模块并导出 `apps`。
- `apps/*.js` — 插件具体命令/功能模块（每个文件导出一个处理对象或函数）。
- `adapter/index.js` — 适配宿主插件接口（查找并导入宿主实现以覆盖内部实现）。示例：尝试加载 `lib/plugins/plugin.js` 或 `plugins/genshin/model/mys/mysInfo.js`。
- `adapter/lib/puppeteer.js` — 内置 Puppeteer 封装，负责模板渲染与截图，返回 `segment.image(buff)`。
- `components/check.js` — 依赖检查与安装建议。
- `components/Version.js` — 从 `README.md` / `CHANGELOG.md` 读取版本与日志，显示在启动时。

项目约定与模式（为 AI 机器人的代码生成提供明确参考）
- 模块导入：使用 ESM `import`，文件导出常使用默认导出或导出单个对象；`index.js` 选择模块的第一个导出作为 `apps[name]`。
  - 生成/修改 `apps/*.js` 时，导出应为默认对象或首个命名导出，例：`export default { rule: /regex/, fn: async (e) => {} }`。
- 日志使用宿主 `logger`（全局可用），并使用 `chalk` 做彩色输出；不要创建新的全局 logger。
- 全局 `segment`：若未在宿主提供，`index.js` 会尝试从 `oicq` 或 `icqq` 动态导入 `segment`。在生成返回消息（图片、消息段）时使用 `segment`。
- 适配优先级：优先使用宿主路径（`process.cwd()` 下的文件）来覆盖内部实现（参见 `adapter/index.js` 的 `importV3`）。AI 在修改时应保留此可替换性。

修改建议与注意事项（AI 代码代理专用指南）
- 小改动优先：尽量在 `apps/` 内添加或替换单个功能模块，而不是修改根 `index.js` 或 `adapter/`，以免破坏与宿主的兼容性。
- 依赖调整：若新增第三方包，请同时更新 `package.json` 的 `dependencies`，并在 `components/check.js` 中加入检查（如果是运行时必须）。
- Puppeteer 使用：若修改 `adapter/lib/puppeteer.js`，保留 `segment.image(...)` 输出语义与 `dealTpl` 的模板渲染逻辑，因多个 `apps/` 依赖该接口。
- 文件路径：插件内部经常使用相对路径 `./plugins/zhishui-plugin/...` 或 `process.cwd()` 组合路径。生成路径时优先使用 `process.cwd()` 以适配宿主目录结构。

示例参考片段（可直接复制到补丁）
- 从 `index.js` 加载 apps：
  - files = readdirSync(appsDir).filter(f => f.endsWith('.js'))
  - import(`./apps/${file}`) 并取模块的第一个导出
- 适配导入示例：`adapter/index.js` 中的 `importV3`，会检查 `process.cwd() + file` 是否存在再动态导入

何时向开发者提问（提示 AI 提升 PR 质量）
- 修改会触及宿主接口（`adapter/index.js`、`segment`、`logger`）时，请在 PR 描述中说明兼容性考虑并询问是否允许改变适配优先级。
- 新增需安装大型原生依赖（例如 Chromium 或 ffmpeg）时，询问使用者接受的安装与部署策略。

反馈与迭代
- 如果这里有遗漏（例如你所用的宿主 Yunzai 配置路径不同），请告知具体运行环境或补充宿主文档片段，我会迭代此说明。
