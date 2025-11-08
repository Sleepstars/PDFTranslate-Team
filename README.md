# PDFTranslate Team

一个完整的 PDF 翻译平台，包含 Next.js 16 前端、FastAPI 后端以及完整的 DevOps 部署方案，基于 BabelDOC/PDFMathTranslate 提供专业的 PDF 文档翻译服务。

## 仓库结构
```
app/                # FastAPI 后端源码
├── auth.py         # 用户认证与会话管理
├── config.py       # 应用配置管理
├── database.py     # PostgreSQL 数据库集成
├── models.py       # SQLAlchemy 数据模型
├── redis_client.py # Redis 缓存与任务队列
├── s3_client.py    # S3 存储服务
├── tasks.py        # 翻译任务管理
├── main.py         # FastAPI 应用入口
└── routes/         # API 路由模块
    ├── auth.py     # 认证相关接口
    ├── tasks.py    # 翻译任务接口
    └── settings.py # 系统设置接口

Front/              # Next.js 16 前端
├── app/            # App Router 页面
├── components/     # UI 组件
└── lib/            # 工具库

docker-compose.yml  # 完整服务编排（PostgreSQL + Redis + Backend + Frontend）
Dockerfile.backend  # 后端容器镜像
pyproject.toml      # Python 项目配置
pixi.toml           # 跨语言开发环境
```

## 功能特性
- 🔐 **用户认证**：基于 Session 的管理员认证系统，支持 HttpOnly Cookie 安全传输
- 📄 **任务管理**：完整的翻译任务生命周期管理（创建、进度跟踪、状态更新、完成下载）
- 🗄️ **数据持久化**：PostgreSQL 数据库存储用户和任务信息，Redis 缓存加速
- ☁️ **对象存储**：S3 兼容存储服务，文件上传下载和 TTL 管理
- ⚡ **异步处理**：基于 Redis 的任务队列，支持并发翻译处理
- 🌐 **多引擎支持**：集成 Google、DeepL、OpenAI、Ollama 等翻译引擎
- 📊 **实时监控**：React Query 轮询机制，实时显示翻译进度
- 🐳 **容器化部署**：Docker Compose 一键部署，支持生产环境

## 技术栈
- **前端**：Next.js 16 (App Router), React Query, TypeScript
- **后端**：FastAPI, SQLAlchemy, Redis
- **数据库**：PostgreSQL 16
- **缓存/队列**：Redis 7
- **对象存储**：S3 兼容服务
- **部署**：Docker Compose

## 快速开始

### 开发环境（Pixi 推荐）
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

### 手动安装

如暂不使用 Pixi，可通过传统方式安装：

```bash
# Backend
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd Front && npm install && npm run dev
```

## 生产部署

### Docker Compose（一键部署）
```bash
docker compose up --build
```

服务配置：
- `postgres`：PostgreSQL 16 数据库，监听 `localhost:5432`
- `redis`：Redis 7 缓存，监听 `localhost:6379`  
- `backend`：FastAPI 后端，监听 `localhost:8000`
- `frontend`：Next.js 前端，监听 `localhost:3000`

### 环境变量
后端支持丰富的配置选项（完整列表见 `app/config.py`）：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PDF_APP_ADMIN_EMAIL` | 管理员邮箱 | `admin@example.com` |
| `PDF_APP_ADMIN_PASSWORD` | 管理员密码 | `changeme` |
| `PDF_APP_DATABASE_URL` | PostgreSQL 连接串 | `postgresql+asyncpg://postgres:postgres@postgres:5432/pdftranslate` |
| `PDF_APP_REDIS_URL` | Redis 连接串 | `redis://redis:6379/0` |
| `PDF_APP_S3_ENDPOINT` | S3 服务地址 | `https://your-s3-service.com` |
| `PDF_APP_BABELDOC_SERVICE` | 翻译引擎 | `google` |

### Docker 镜像发布
`.github/workflows/docker-publish.yml` 会在以下情况触发自动发布：
- 推送到 `main` 分支
- 创建以 `v*`、`release-*`、`deploy-*` 开头的 Tag

发布的镜像：
- 后端：`ghcr.io/<owner>/<repo>-backend:{latest|<commit>}`
- 前端：`ghcr.io/<owner>/<repo>-frontend:{latest|<commit>}`

## 翻译引擎配置

项目支持多种翻译引擎，可通过环境变量配置：

```bash
# Google 翻译（默认）
PDF_APP_BABELDOC_SERVICE=google

# DeepL
PDF_APP_BABELDOC_SERVICE=deepl
PDF_APP_DEEPL_API_URL=https://api-free.deepl.com/v2/translate

# OpenAI
PDF_APP_BABELDOC_SERVICE=openai
PDF_APP_OPENAI_API_BASE=https://api.openai.com/v1
PDF_APP_BABELDOC_MODEL=gpt-3.5-turbo

# Ollama (本地部署)
PDF_APP_BABELDOC_SERVICE=ollama
PDF_APP_OLLAMA_HOST=http://localhost:11434
```

## API 文档

启动后端服务后，可通过以下地址访问：
- Swagger UI：http://localhost:8000/docs
- ReDoc：http://localhost:8000/redoc
- 健康检查：http://localhost:8000/health

### 主要接口
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息
- `POST /api/tasks` - 创建翻译任务
- `GET /api/tasks` - 获取任务列表
- `POST /api/tasks/{id}/retry` - 重试任务
- `POST /api/tasks/{id}/cancel` - 取消任务
- `GET /api/tasks/{id}/download` - 下载翻译结果

## 开发指南

### 后端开发
```bash
# 安装依赖
uv venv && source .venv/bin/activate
uv pip install -e .

# 运行测试
pytest

# 代码格式化
ruff check .
ruff format .
```

### 前端开发
```bash
cd Front
npm install
npm run dev      # 开发模式
npm run build    # 生产构建
npm run lint     # 代码检查
```

### 数据库迁移
```bash
# 生成迁移文件
alembic revision --autogenerate -m "描述"

# 执行迁移
alembic upgrade head
```

## 架构设计

### 数据模型
- **User**：用户信息（目前主要为管理员）
- **Task**：翻译任务，包含源文件、目标语言、状态等信息
- **TaskResult**：任务结果，存储翻译后的文件链接

### 异步任务流程
1. 用户创建翻译任务，状态为 `pending`
2. 任务入队 Redis，Worker 异步处理
3. Worker 调用配置的翻译引擎处理文档
4. 处理完成更新任务状态和结果文件链接
5. 前端通过轮询获取任务状态更新

### 存储策略
- **PostgreSQL**：存储任务元数据和状态
- **Redis**：缓存和任务队列
- **MinIO S3**：存储原始PDF和翻译结果文件
- **文件TTL**：自动清理过期的翻译文件

## 监控与维护

### 健康检查
- 数据库连接状态
- Redis 连接状态
- S3 存储可用性
- 翻译引擎连接状态

### 日志管理
- 结构化日志记录
- 任务执行日志跟踪
- 错误日志聚合分析

### 性能优化
- 数据库索引优化
- Redis 缓存策略
- 异步任务并发控制
- 文件存储CDN加速

## 故障排除

### 常见问题
1. **数据库连接失败**：检查 `PDF_APP_DATABASE_URL` 配置
2. **Redis 连接失败**：确认 Redis 服务是否正常运行
3. **翻译任务失败**：查看后端日志确认翻译引擎配置
4. **文件上传失败**：检查 MinIO S3 配置和存储空间

### 调试模式
```bash
# 启用详细日志
export PDF_APP_LOG_LEVEL=DEBUG

# 数据库调试
export SQLALCHEMY_ECHO=true
```

## 贡献指南

1. Fork 项目并创建功能分支
2. 遵循代码规范运行 `ruff check .` 和 `ruff format .`
3. 添加必要的测试用例
4. 提交 PR 并描述改动

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 联系方式

- 项目维护：PDFTranslate Team
- 问题反馈：[GitHub Issues](../../issues)
- 技术讨论：欢迎提交 PR 和 Issue

---

*本项目基于 BabelDOC 和 PDFMathTranslate，致力于提供专业可靠的 PDF 文档翻译解决方案。*
