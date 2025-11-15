# PDFTranslate Team

> 多租户 PDF 翻译与运营平台：FastAPI 后端 + Next.js 16 仪表盘 + Pixi/Bun 开发体验。

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
![Python](https://img.shields.io/badge/python-3.11+-yellow.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)
![Pixi](https://img.shields.io/badge/env-pixi-green.svg)
![Docker Compose](https://img.shields.io/badge/deploy-docker--compose-2496ED.svg)

PDFTranslate Team 提供面向多用户、多翻译引擎、可观察的 PDF 翻译工作流——管理员定义配额与服务策略，用户通过 Web Portal 上传 PDF、跟踪任务、下载结果。平台在 AWS S3 兼容存储上保存产物，并支持 Docker Compose 或裸机部署。

---

## 📚 Table of Contents
1. [Why PDFTranslate](#-why-pdftranslate)
2. [Architecture & Stack](#-architecture--stack)
3. [Quick Start](#-quick-start)
4. [Environment Variables](#-environment-variables)
5. [Usage Snapshot](#-usage-snapshot)
6. [Deployment & Operations](#-deployment--operations)
7. [Troubleshooting Cheatsheet](#-troubleshooting-cheatsheet)
8. [Contributing & Community](#-contributing--community)
9. [License](#-license)

---

## ✨ Why PDFTranslate
- **多租户 & RBAC**：管理员、普通用户、分组、配额与服务访问策略统一管理；适合 SaaS 或企业内部多团队共享。
- **任务编排与可靠性**：Redis 队列 + PostgreSQL 状态机；卡在 `processing` 的任务会在重启后恢复执行，批量删除会同步清理 S3。
- **翻译引擎扩展性**：内建 12+ 引擎（OpenAI、Gemini、DeepL、SiliconFlow 等），支持自定义 API Endpoint，满足海外/私有云部署。
- **运营友好 UI**：Next.js 16 App Router + shadcn/ui 仪表盘，配合 TanStack Query 实时轮询和 WebSocket 推送。
- **DevOps Ready**：Pixi 统一 Python/Node/Bun，Docker Compose 封装 Postgres/Redis/Backend/Frontend，`Dockerfile.backend` 已包含 OpenCV 所需 `libGL` 依赖。

---

## 🧱 Architecture & Stack

```
          ┌───────────────┐
          │   Frontend    │  Next.js 16 App Router + shadcn/ui + TanStack Query
          │ app/[locale]  │
          └──────┬────────┘
                 │ HTTPS / WebSocket
┌────────────────┴────────────────┐
│            Backend               │  FastAPI + SQLAlchemy + pdf2zh-next
│  Auth / Tasks / Providers / S3   │
└────┬────────────┬────────────┬──┘
     │            │            │
 PostgreSQL     Redis        S3-Compatible Storage
```

| 组件 | 技术栈 | 关键职责 |
| --- | --- | --- |
| `app/` | FastAPI, SQLAlchemy 2, Alembic, asyncpg, Redis, boto3 | Session/RBAC、任务生命周期、配额、翻译引擎集成、S3 文件管理 |
| `Front/` | Next.js 16, Tailwind CSS, shadcn/ui, TanStack Query, next-intl, lucide-react, react-dropzone, sonner | 登录与多语言仪表盘、任务监控、管理员面板 |
| `pixi.toml` | Pixi (conda-forge) | Python 3.11 + Node.js 20 + Bun 的统一环境与脚本 (`pixi run ...`) |
| `docker-compose.yml` | Docker Compose v2 | PostgreSQL、Redis、Backend、Frontend、可选代理的编排脚本 |

---

## ⚡ Quick Start

### 1. Prerequisites
- Git, Docker 24+ / Docker Compose v2
- Pixi（https://pixi.sh）与 Bun 1.1+
- PostgreSQL 15+ 与 Redis 7+（若不使用 Compose 内置服务）

### 2. Clone & Configure
```bash
git clone https://github.com/your-org/PDFTranslate-Team.git
cd PDFTranslate-Team
cp .env.example .env  # 按下节填写必需变量
```

### 3. Install toolchains
```bash
pixi install
pixi run install-frontend   # bun install in Front/
```

### 4. Start supporting services
```bash
docker compose up -d postgres redis
```

### 5. Run backend & frontend
```bash
pixi run start-backend   # FastAPI + Uvicorn autoreload
pixi run dev-frontend    # bun run dev in Front/
```

- Backend API: `http://localhost:8000/api`
- Dashboard: `http://localhost:3000`

> 需要同步依赖/格式，可使用 `pixi run lint-frontend`、`pixi run install-frontend`。

---

## 🔐 Environment Variables

在 `.env` 中至少配置以下键；其余可按需扩展（如 SMTP、S3、第三方代理）。

| Key | Example | Description |
| --- | --- | --- |
| `PDF_APP_DATABASE_URL` | `postgresql+asyncpg://pdftranslate:STRONG@postgres:5432/pdftranslate` | PostgreSQL 连接串，支持托管或 Compose |
| `PDF_APP_REDIS_URL` | `redis://redis:6379/0` | 队列与缓存 |
| `PDF_APP_SESSION_SECRET` | `python -c "import secrets; print(secrets.token_urlsafe(32))"` | 高熵 Session 密钥 |
| `PDF_APP_PORT` / `PDF_APP_HOST` | `8000` / `0.0.0.0` | 后端监听地址 |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000/api` | 前端调用 API 的公开地址，必须包含 `/api` |
| `PDF_APP_CORS_ORIGINS` | `http://localhost:3000` | 多个域名以逗号分隔 |
| `ALLOWED_EMAIL_SUFFIXES` | `example.com,partner.com` | 限制注册邮箱域（可选） |
| `SMTP_*` | 视邮件服务而定 | SMTP/通知配置 |
| `S3_*` 或在后台“系统设置 → S3”填写 | —— | 结果文件存储，如使用 OSS/MinIO 需设置 endpoint |

---

## 📥 Usage Snapshot

以下示例演示如何通过 API 创建任务并查询状态，适合自动化脚本或第三方集成：

```bash
# 1. 登录获取会话（默认管理员账号）
curl -i -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin"}'

# 2. 上传 PDF 并创建任务
curl -i -X POST http://localhost:8000/api/tasks \
  -H "Authorization: Bearer <token 或 Cookie>" \
  -F "file=@/path/to/demo.pdf" \
  -F "sourceLang=en" \
  -F "targetLang=zh"

# 3. 轮询任务结果
curl http://localhost:8000/api/tasks/<taskId>
```

在 Web 仪表盘中，管理员可以：
- 查看实时任务进度与配额使用
- 批量删除完成/失败任务并清理 S3
- 配置翻译服务、SMTP、S3、分组以及自定义配额策略

---

## 🚀 Deployment & Operations

- **Compose 部署**：`docker compose up -d` 会构建/拉取后端镜像（包含 OpenCV 依赖）与 Next.js 前端。建议结合 Traefik/Nginx 暴露 `api.example.com` 与 `app.example.com`。
- **裸机/自托管**：使用 `pixi run start-backend` + `bun run start --cwd Front`，或将 `.next` 产物流量交给 Nginx/PM2。务必配置 systemd/监控。
- **Observability**：通过 `docker compose logs -f backend`、`redis-cli monitor`、`psql` 等确认队列/数据库健康；引入 Loki/ELK/Grafana 监控任务延迟与失败比例。
- **备份策略**：使用 `pg_dump`、S3 版本控制与 `.env/docker-compose.yml` 的配置归档。

详尽步骤（含端口、安全、裸机部署、排障、检查清单）请参阅 **[docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)**。

---

## 🩹 Troubleshooting Cheatsheet

| Symptom | Quick Fix |
| --- | --- |
| 前端 404 / 登录失败 | 确认 `NEXT_PUBLIC_API_BASE_URL` 指向正确域名并包含 `/api`；代理需透传 Cookie 与 WebSocket 头。 |
| `ImportError: libGL.so.1` | 重新构建 `Dockerfile.backend` 或在自定义镜像安装 `libgl1 libglib2.0-0 libsm6 libxext6 libxrender1`。 |
| Redis 连接错误 | `docker compose ps redis` & 校验 `PDF_APP_REDIS_URL`；若启用密码需在 URL 中附带。 |
| 任务卡在 processing | 后端重启会自动恢复；如仍卡住，通过管理员界面重新排队或删除，同时检查翻译服务凭据。 |
| 邮件发送失败 | 确认 SMTP 端口、TLS 模式与 `ALLOWED_EMAIL_SUFFIXES` 设置，查看后台系统日志。 |

---

## 🤝 Contributing & Community
- Fork → 新建 feature 分支 → 通过 `pixi run start-backend` / `pixi run dev-frontend` 运行 → 添加/更新测试与文档 → 提交 PR。
- 代码规范：FastAPI/SQLAlchemy 最佳实践、Next.js 16 App Router 约定、shadcn/ui 与 Tailwind Utility-first 风格。
- 沟通渠道：GitHub Issues & Discussions；欢迎分享使用案例、反馈或提交翻译引擎适配。

---

## 📄 License

Distributed under the **AGPL-3.0** license. See [`LICENSE`](LICENSE) for details. 商业/私有部署请确保遵守 AGPL 对网络提供服务时的源码开放要求。

---

_最新更新时间：2025-11-13 · README 与 docs/DEPLOYMENT_GUIDE.md 为唯一权威文档，请保持两者同步。_
