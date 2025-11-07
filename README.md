# PDFTranslate Team

一个包含 Next.js 16 前端、FastAPI 后端以及 Docker Compose DevOps 资产的示例项目，演示如何基于 BabelDOC 构建“登录 + 异步翻译管理”工作台。

## 仓库结构
```
app/                # FastAPI 源码
Front/              # Next.js 16 前端（任务看板、登录、React Query 轮询）
Dockerfile.backend  # 后端镜像构建文件
docker-compose.yml  # 前后端一键启动
pyproject.toml      # 后端 Python 项目定义
pixi.toml           # 跨语言开发环境定义
TODO.md             # 待办追踪
```

## 功能概览
- 会话登录：后端校验管理员账号，发放 HttpOnly Cookie；前端路由基于该 Cookie 鉴权。
- 翻译任务：后端维护任务队列与异步模拟 Worker；前端可创建/重试/取消并查看进度、错误信息。
- BabelDOC 预留：`app/utils/babeldoc.py` 内提供钩子，便于替换为真实 BabelDOC/PDFMathTranslate 调用。
- DevOps：提供前后端 Dockerfile 及 Compose，默认桥接网络 `frontend ↔ backend`。

## 开发环境（Pixi 推荐）
项目根目录已提供 `pixi.toml`，无需手动安装 Python/Node。首次运行：

```bash
pixi install          # 解析 python/node 依赖
pixi run install-frontend
```

日常命令：

```bash
pixi run start-backend        # 运行 FastAPI (http://localhost:8000)
pixi run dev-frontend         # 运行 Next.js (http://localhost:3000)
pixi run lint-frontend        # 执行前端 Lint
```

如暂不使用 Pixi，可继续通过 `uv`/`pip` 与 `npm` 安装：

```bash
# Backend
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd Front && npm install && npm run dev
```

后端默认管理员：`admin@example.com / changeme`，可通过环境变量 `PDF_APP_ADMIN_*` 或 `.env.backend` 覆盖。

## Docker Compose
```bash
docker compose up --build
```
服务：
- `frontend`：Next.js（生产模式），监听 `localhost:3000`
- `backend`：FastAPI（Uvicorn），监听 `localhost:8000`

Compose 会自动注入：
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api`（浏览器可访问宿主）
- `API_BASE_URL=http://backend:8000/api`（Next.js 服务端通过容器网络访问）
- `PDF_APP_ADMIN_*` 四个管理员变量

如需 TLS/域名或外部数据库、Redis，只需在 Compose 中添加对应服务并调整环境变量。

## CI / GHCR 镜像
`.github/workflows/docker-publish.yml` 会在 `main` 分支或以 `v* / release-* / deploy-*` 开头的 Tag 推送时触发：
- 构建/推送后端镜像：`ghcr.io/<owner>/<repo>-backend:{latest|<commit>}`
- 构建/推送前端镜像：`ghcr.io/<owner>/<repo>-frontend:{latest|<commit>}`（构建参数默认 `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api`）

如需自定义镜像名或构建参数，可编辑 workflow 中 `BACKEND_IMAGE` / `FRONTEND_IMAGE` 与 `build-args`。

## BabelDOC 集成指引
1. **替换 Worker**：在 `app/utils/babeldoc.py` 中调用 BabelDOC CLI/SDK，并在 `TaskManager` 的 `_lifecycle` 中根据真实结果更新任务状态、输出链接。
2. **持久化**：将当前的内存 `TaskManager` & Session Store 替换为数据库/队列（PostgreSQL + Redis/Celery）。
3. **上传文件**：扩展后端 `/tasks` 接口接收文件或对象存储 key，并将其传递给 BabelDOC。
4. **通知机制**：可在任务完成时触发 Webhook、WebSocket、或消息推送，以免前端轮询。

更多细节（API 结构、环境变量等）请分别参考 `Front/README.md` 与 `BACKEND.md`。
