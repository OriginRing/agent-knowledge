# 项目协作指南

## 工作约定

- 默认用中文沟通、说明改动和汇报验证结果。
- 修改前检查 `git status --short`，保留用户已有的暂存和未暂存改动，不覆盖、不回退无关文件。
- 先读相关代码再修改。本文是操作索引，若与当前实现不一致，以代码为准，并更新相关文档。
- 按用户要求控制范围；仅定位或解释时不修改代码。不要为完成局部修改顺手重构无关模块。
- 不把 `.env`、数据库凭据、Cookie、生成文件、`node_modules/`、`dist/` 或无关的 `tsconfig.tsbuildinfo` 改动加入提交。

## 项目与入口

这是一个支持多智能体对话、知识库、长期记忆、文件理解和技能执行的应用。

| 内容 | 位置 |
| --- | --- |
| 安装、配置与功能说明 | `README.md` |
| 前端依赖与命令 | `web/package.json` |
| 独立管理端及使用说明 | `admin/`、`docs/admin-console.md` |
| 管理接口、版本与工作流执行 | `python/routers/admin.py`、`python/services/admin_service.py`、`python/services/workflow_runtime.py` |
| 前端入口、页面路由 | `web/src/main.ts`、`web/src/router/index.ts` |
| 对话页面、输入框 | `web/src/views/agent-chat/index.vue`、`web/src/components/chat-input/` |
| 历史、知识库、记忆页面 | `web/src/views/agent-history/`、`web/src/views/knowledge/`、`web/src/views/memory/` |
| 对话状态、主题状态 | `web/src/stores/chat.ts`、`web/src/stores/theme.ts` |
| HTTP、SSE 与 Markdown | `web/src/services/http.ts`、`web/src/utils/sse.ts`、`web/src/utils/typewriter.ts` |
| 工作面板、文件预览、代码编辑 | `web/src/views/workspace-panel/` |
| 开发代理、构建版本 | `web/vite.config.ts` |
| 后端入口 | `python/main.py` |
| 登录、会话、记忆接口 | `python/routers/auth.py` |
| 智能体、文件接口 | `python/routers/agent.py`、`python/routers/file.py` |
| 智能体编排、上下文 | `python/agent/agent_service.py`、`python/agent/history_manager.py` |
| 数据库配置、表初始化 | `python/config/db_config.py`、`python/db/db_init.py` |
| 环境变量示例与读取 | `python/.env-example`、`python/config/env_config.py` |
| 技能规范与文档解析说明 | `python/skills/README.md`、`python/DOCUMENT_PARSING.md` |

## 启动程序

以下命令从仓库根目录开始执行，各代码块使用独立终端。

环境要求：Python 3.10+，Node.js `^20.19.0`、`^22.13.0` 或 `>=24`，MySQL；本地模型与知识库需要 Ollama。旧版 Office 文件转换需要 LibreOffice。

首次安装后端：

```bash
cd python
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
test -f .env || cp .env-example .env
```

根据 `README.md` 创建业务数据库并配置 `python/config/db_config.py`，编辑 `python/.env`。不要覆盖已有 `.env`。示例中的 `xxx` 需要替换为实际服务配置。

启动后端：

```bash
cd python
source .venv/bin/activate
python main.py
```

- 地址：`http://127.0.0.1:8000`；健康检查：`GET /`；Swagger：`/docs`。
- 从 `python/` 启动，使相对路径和本地数据目录保持一致。
- 启动过程会创建业务表、执行兼容字段调整、初始化智能体；不会自动准备销售模拟数据。

首次安装并启动前端：

```bash
cd web
npm ci
npm run dev
```

- 地址：`http://127.0.0.1:5173`，若端口被占用，以 Vite 输出为准。后续启动只需 `npm run dev`。
- `/auth`、`/agent`、`/file` 默认代理到本地后端。`VITE_API_BASE_URL` 可覆盖 API 地址。
- `npm ci` 的 `prepare` 脚本会将 Git hooks 路径设为 `.githooks`；暂存区存在 `web/` 改动时，提交钩子执行前端 lint。
- 启动前先确认是否已有开发服务，优先复用，不停止不属于当前任务的进程。

本地模型准备：

```bash
ollama pull qwen3.5:9b
ollama pull qwen3-embedding:4b
```

OSS 用于上传与产物，Tavily 用于联网搜索，Memos 用于长期记忆，OCR 使用 `QWEN_API_KEY` 及 OCR 配置。只验证相关功能时才需要对应服务；不得将外部服务缺失误报为代码回归。

## 测试账号与界面操作

以下账号由用户提供，用于本项目开发测试：

| 项目 | 值 |
| --- | --- |
| 账号 | `000001` |
| 密码 | `123456` |
| 登录入口 | 打开 `http://127.0.0.1:5173`，未登录时显示登录界面 |

账号必须作为字符串保留前导零。此文档记录不代表已验证账号在当前数据库可用，也不代表后端会自动创建该账号。

常规验证流程：

1. 确认后端健康检查及前端页面可访问。
2. 输入上述账号密码登录；接口为 `POST /auth/login`，JSON 字段为 `username`、`password`。
3. 通过 `GET /auth/userinfo` 或界面登录状态确认会话。登录依赖 HttpOnly `access_token` Cookie，当前登录有效期为 24 小时。
4. 根据本次改动验证对话、历史记录、知识库、记忆或工作面板。对话测试可能写入历史，使用可辨认的测试内容。
5. 登录失败时先检查响应、数据库连接和账号状态，不自行重置密码或修改角色。删除会话、清空知识库等操作仅在任务明确要求时执行。

测试凭据仅用于该项目测试，不复用到生产环境，不写入公开 README、应用默认值或日志。

## 检查与测试

优先运行覆盖当前改动的检查，按影响范围决定是否全量执行。纯文档改动检查内容、路径和 `git diff --check` 即可，无需启动服务。

前端命令：

```bash
cd web
npm run test -- src/utils/chat-route.test.ts
npm run test
npm run lint
npm run format:check
npm run build
```

- `test` 使用 Vitest，测试文件主要与源码放在一起，命名为 `*.test.ts`；上面第一条是单文件示例，按改动替换路径。
- `build` 先执行 `vue-tsc -b` 再执行 Vite 构建；`check` 组合 lint 与格式检查，不包含测试或构建。
- 若只格式化修改文件，从 `web/` 执行 `npx prettier --write <文件路径>`；避免全仓格式化引入无关变更。

后端命令：

```bash
cd python
source .venv/bin/activate
python -m unittest tests.test_history_and_user
python -m unittest discover -s tests
```

第一条测试命令是单模块示例，其他模块见 `python/tests/`。检查结果中区分代码错误、缺少依赖与外部服务失败。

结束前在仓库根目录执行：

```bash
git diff --check
git status --short
```

汇报改动文件、已运行检查及结果、未验证部分。构建通过不等于已完成登录、SSE 或浏览器交互验收；对视觉和交互问题应在页面实际复现并验证。

## 关键实现约定

- 前端源码在 `web/src/`，别名 `@view` 指向此目录。沿用 Vue 3、TypeScript、Pinia、Ant Design Vue 和现有格式规范。
- 对话链接约定为 `/chat?agendCode=xx&session=xx`，保留 `agendCode` 的现有拼写；后端请求使用 `agentCode`、`sessionId`，不要混用。
- 调整对话路由或历史恢复时，检查 URL、当前智能体、会话状态是否一致，并防止异步响应覆盖新会话。
- 输入框保留 `Enter` 发送、`Shift+Enter` 换行及中文输入法组合输入保护；换行需检查从输入到消息展示的完整链路。
- Markdown、代码工具栏及 GPT-Vis 图表的当前渲染入口为 `web/src/utils/typewriter.ts`。图表尺寸应随容器变化；修改前确认实际调用链，不仅根据已安装依赖判断能力。
- 修改 SSE 时同时检查后端节点输出、前端解析、状态更新及历史恢复；API 通常返回 `{ code, message, data }`，还需区分 HTTP 错误与业务错误。
- 登录时长定义在 `python/services/user_service.py`；调整时同时核对 JWT 与 Cookie 有效期。
- 业务库为 `agent-user`、`agent-knowledge`。销售助手使用 `simulated-data.sales_performance`，测试须保留角色权限校验，不推断测试账号拥有管理员权限。
- Chroma 数据默认在后端工作目录的 `chroma_db/knowledge`。不要为排错直接删除数据。
- 添加技能先读 `python/skills/README.md`，每个技能以 `SKILL.md` 为入口，由 `python/services/skill_service.py` 发现；自定义目录使用 `AGENT_SKILLS_DIR`。
- 浏览器兼容问题需区分 Vite 开发依赖预构建、生产构建和浏览器运行时；当前开发依赖转换目标为 Chrome 92，不代表所有功能都已在该版本验收。
