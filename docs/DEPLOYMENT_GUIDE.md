# Production Deployment Guide

**Project:** PDFTranslate Team  
**Last Updated:** 2025-11-13

本指南覆盖单体服务器或小型集群的部署要点，目标是以最少步骤让多用户 PDF 翻译平台在生产环境稳定运行。推荐部署栈：Docker Compose + Traefik/Nginx 反向代理 + 托管 PostgreSQL/Redis（或 Compose 容器）。

---

## 1. 准备条件

### 1.1 基础设施
- Ubuntu 22.04 LTS（或等效 x86_64 Linux），≥4 vCPU、8 GB RAM、50 GB SSD。
- 打开端口：80/443（HTTP/HTTPS），3000（前端），8000（后端），5432（PostgreSQL），6379（Redis）。
- 绑定域名（例如 `app.example.com`、`api.example.com`），证书建议使用 Let's Encrypt。

### 1.2 软件依赖
- Docker 24+ 与 Docker Compose v2。
- Pixi（仅当需要在宿主机跑 Python/Node 管理脚本）。
- Bun 1.1+（编译前端时使用）。
- Git、OpenSSL、psql、redis-cli（便于排查）。

### 1.3 凭据
- PostgreSQL 用户名与强密码。
- Redis 密码（如启用 AUTH）。
- S3/对象存储访问凭据。
- 邮件发送方配置（SMTP 主机、端口、账户、允许的邮箱后缀）。
- 管理员初始密码（部署完成后立即修改）。

---

## 2. 配置环境

1. **克隆代码**
   ```bash
   git clone https://github.com/your-org/PDFTranslate-Team.git
   cd PDFTranslate-Team
   cp .env.example .env
   ```

2. **设置 `.env`**（表格列出主要变量）

| 变量 | 示例 | 说明 |
| --- | --- | --- |
| `PDF_APP_DATABASE_URL` | `postgresql+asyncpg://pdftranslate:STRONG@postgres:5432/pdftranslate` | 支持外部或 Compose 内数据库 |
| `PDF_APP_REDIS_URL` | `redis://redis:6379/0` | 可追加 `?ssl=true` 等参数 |
| `PDF_APP_SESSION_SECRET` | `python -c "import secrets; print(secrets.token_urlsafe(32))"` | 必须为高熵值 |
| `PDF_APP_PORT` / `PDF_APP_HOST` | `8000` / `0.0.0.0` | 后端监听端口 |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.example.com/api` | 前端访问 API 的公共 URL，必须含 `/api` |
| `PDF_APP_CORS_ORIGINS` | `https://app.example.com` | 多域使用逗号分隔 |
| `ALLOWED_EMAIL_SUFFIXES` | `example.com,partner.com` | 限制注册邮件域（可选） |
| `SMTP_*` | 视环境而定 | 邮件/通知配置 |
| `S3_REGION / S3_BUCKET / S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY` | —— | 可以改为在后台“设置 → S3”界面填写 |

3. **生成 TLS 证书与 DNS 记录**，推荐将 API 与前端置于独立子域，后续代理配置更清晰。

---

## 3. 使用 Docker Compose 部署（推荐）

1. **启动全部服务**
   ```bash
   docker compose pull              # 如需预拉镜像
   docker compose up -d             # 启动 postgres、redis、backend、frontend
   ```

2. **检查服务状态**
   ```bash
   docker compose ps
   docker compose logs -f backend
   docker compose logs -f frontend
   ```
   - 后端启动时会自动运行 Alembic 迁移，并恢复重启前 `processing` 状态的任务。
   - 前端容器通过 `NEXT_PUBLIC_API_BASE_URL` 连接后端。

3. **配置反向代理**
   - 将 `api.example.com` 代理到后端容器端口 `8000`，开启 HTTPS。
   - 将 `app.example.com` 代理到前端容器端口 `3000`。
   - 确保 WebSocket（任务实时推送）透传 `Upgrade`/`Connection` 头。

4. **初始化系统**
   - 登录管理员账号，进入 **系统设置 → S3** 配置对象存储。
   - 配置 **邮件** 和 **配额策略**。
   - 创建普通用户或导入现有用户，并为每个用户分配配额/分组。

5. **滚动更新**
   ```bash
   git pull origin main
   docker compose pull && docker compose up -d
   ```
   使用 `docker compose logs --tail=200 backend` 观察迁移或任务恢复情况。

---

## 4. 不使用 Docker 的部署（概览）

1. **Python 进程**
   ```bash
   pixi install
   pixi run start-backend  # 或者 uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
   推荐在生产中改为 `gunicorn -k uvicorn.workers.UvicornWorker -w 4`.

2. **前端构建**
   ```bash
   pixi run install-frontend
   pixi run build-frontend
   bun run start --cwd Front
   ```

3. **静态资源托管**
   - 将 `Front/.next` 输出交由 Nginx/Node 进程或 Vercel/SWR 托管。
   - 设置 `NEXT_PUBLIC_API_BASE_URL` 指向后端公开域名。

4. **系统服务**
   - 使用 systemd/supervisor 管理后端与前端进程，注意覆盖环境变量。

> 该方案需要自行处理日志轮转、自动重启与安全更新，除非有现有运维体系，否则建议优先使用 Docker。

---

## 5. 安全与稳定性

- **Secret 管理**：使用 Vault/KMS/Secrets Manager 注入 `.env`，避免硬编码。
- **TLS**：全站 HTTPS，禁用 TLS 1.0/1.1。
- **网络**：限制数据库、Redis 对外访问；生产环境中给 Compose 网络配置 `traefik_public` 或自定义网段。
- **访问控制**：管理员账号最小化、定期轮换密码，启用双因素（若代理层支持）。
- **资源限制**：在 `docker-compose.yml` 中添加 `deploy.resources.limits`（CPU/内存），防止单任务耗尽资源。

---

## 6. 运维与备份

| 任务 | 频率 | 推荐方式 |
| --- | --- | --- |
| 数据库备份 | 每日 | `docker compose exec postgres pg_dump -U pdftranslate pdftranslate > backup_$(date +%Y%m%d).sql` |
| S3 归档 | 每日/每周 | 启用桶版本控制与生命周期策略，定期导出到冷备 |
| 配置备份 | 每次更新 | 打包 `.env`、`docker-compose.yml`、Traefik/Nginx 配置 |
| 日志收集 | 实时 | 采集 Compose 容器日志到 Loki/ELK |
| 健康检查 | 实时 | Prometheus/Grafana 或第三方监控，重点关注队列延迟、失败任务数、磁盘占用 |

---

## 7. 常见问题速查

| 症状 | 排查 |
| --- | --- |
| 前端 404 或无法登录 | 检查 `NEXT_PUBLIC_API_BASE_URL` 是否指向正确域名并包含 `/api`，确保代理透传 Cookie。 |
| Redis 连接失败 | `docker compose ps redis`，确认 `PDF_APP_REDIS_URL` 与实际密码一致。 |
| OpenCV 报 `libGL.so.1` | 后端镜像已预装，如自定义镜像需安装 `libgl1 libglib2.0-0 libsm6 libxext6 libxrender1`。 |
| `processing` 任务长时间未完成 | 查看 `docker compose logs backend`，必要时在管理员界面重新排队或删除任务。 |
| 邮件发送失败 | 验证 SMTP 端口/SSL 模式、发件人白名单、`ALLOWED_EMAIL_SUFFIXES` 配置。 |

---

## 8. 部署后检查清单

- [ ] 管理员密码已重置，禁用默认账号。
- [ ] S3、SMTP、第三方翻译服务凭据配置完成。
- [ ] 观察 30 分钟运行日志无错误。
- [ ] 任务创建/翻译/下载流程通过。
- [ ] 备份策略落地并验证恢复流程。
- [ ] 防火墙与 WAF 规则生效，证书自动续期。
- [ ] 记录部署版本、环境变量与自定义脚本，方便回滚。

---

本部署手册仅与 `README.md` 共同维护，任何新的发布流程或配置约定请同步更新此文件，确保唯一事实来源。
