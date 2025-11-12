# PDFTranslate Team

一个完整的**多用户** PDF 翻译平台，包含 Next.js 15 前端、FastAPI 后端以及完整的 DevOps 部署方案，基于 BabelDOC/PDFMathTranslate 提供专业的 PDF 文档翻译服务。

## ✨ 新特性：多用户系统 (v1.0.0)

- 🔐 **角色权限管理**：支持管理员和普通用户角色，基于 RBAC 的访问控制
- 👥 **用户管理**：管理员可创建、编辑、删除用户，管理用户配额
- 📊 **配额系统**：每日页数限制，自动重置，实时配额显示
- 🔧 **翻译服务配置**：灵活配置多个翻译引擎，支持 12+ 翻译服务
- 👥 **分组管理**：基于分组的访问控制，统一管理用户权限
- 🎨 **现代化 UI**：基于 Tailwind CSS 和 shadcn/ui 的全新管理界面

## 📅 最近更新

- **2025-11-09**：任务列表新增复选框、全选与批量删除，支持清理任意状态的历史任务并同步清除 S3 文件。
- **2025-11-11**：修复任务删除未清理 MinerU `images/` 与 ZIP 产物的问题；现在会删除 `outputs/{ownerId}/{taskId}/` 与 `mineru/{mineruTaskId}/` 前缀下的所有对象。
- **2025-11-09**：后端启动时会自动恢复重启前卡在 `processing` 的任务，将其重新排队并继续执行。
- **2025-11-09**：修复批量上传任务未携带 `providerConfigId` 的问题，现在批量翻译会正确使用所选的自定义翻译服务（包括第三方 OpenAI 代理）。
- **2025-11-10**：后台“系统设置”新增二级菜单（系统/邮件/S3）；系统设置可控制是否允许新用户注册；邮件设置支持 SMTP 与允许的邮箱后缀；用户管理支持编辑邮箱与密码。

## 仓库结构
```
app/                    # FastAPI 后端源码
├── auth.py             # 用户认证与会话管理
├── config.py           # 应用配置管理
├── database.py         # PostgreSQL 数据库集成
├── models.py           # SQLAlchemy 数据模型（User, Task, Provider, Group）
├── schemas.py          # Pydantic 数据验证模型
├── dependencies.py     # 依赖注入和权限中间件
├── quota.py            # 配额管理系统
├── redis_client.py     # Redis 缓存与任务队列
├── s3_client.py        # S3 存储服务
├── tasks.py            # 翻译任务管理
├── main.py             # FastAPI 应用入口
└── routes/             # API 路由模块
    ├── auth.py         # 认证相关接口
    ├── tasks.py        # 翻译任务接口
    ├── users.py        # 用户信息接口
    ├── admin_users.py  # 用户管理接口（管理员）
    ├── admin_providers.py  # 服务配置接口（管理员）
    └── settings.py     # 系统设置接口

Front/                      # Next.js 15 前端
├── app/                    # App Router 页面
│   ├── (dashboard)/        # 仪表板布局
│   │   ├── dashboard/      # 主控制台
│   │   ├── tasks/          # 任务管理
│   │   └── admin/          # 管理后台
│   │       ├── users/      # 用户管理
│   │       ├── providers/  # 服务配置
│   │       └── groups/     # 分组管理
│   └── login/              # 登录页面
├── components/             # UI 组件
│   ├── ui/                 # shadcn/ui 基础组件
│   └── dashboard/          # 业务组件
└── lib/                    # 工具库
    ├── auth/               # 认证工具
    └── http/               # HTTP 客户端

docker-compose.yml  # 完整服务编排（PostgreSQL + Redis + Backend + Frontend）
Dockerfile.backend  # 后端容器镜像
pyproject.toml      # Python 项目配置
pixi.toml           # 跨语言开发环境
```

## 功能特性

### 核心功能
- 🔐 **多用户认证**：基于 Session 的认证系统，支持 HttpOnly Cookie 安全传输
- 👥 **角色权限管理**：管理员（admin）和普通用户（user）角色，RBAC 访问控制
- 📊 **配额管理**：每日页数限制，自动 UTC 午夜重置，实时配额显示和低配额警告
- 📄 **任务管理**：完整的翻译任务生命周期管理（创建、进度跟踪、状态更新、结果下载、批量删除历史任务）
- 🔧 **服务配置**：灵活配置多个翻译引擎，支持 Google、DeepL、OpenAI、Azure、Gemini 等 12+ 服务
- 👥 **分组管理**：基于分组的访问控制，统一管理用户权限和服务访问

### 技术特性
- 🗄️ **数据持久化**：PostgreSQL 数据库存储用户、任务、服务配置，Redis 缓存加速
- ☁️ **对象存储**：S3 兼容存储服务，文件上传下载和 TTL 管理
- ⚡ **异步处理**：基于 Redis 的任务队列，支持并发翻译处理
- 🌐 **多引擎支持**：集成 20+ 翻译引擎（通过 pdf2zh-next）
- 📊 **实时监控**：React Query 轮询机制，实时显示翻译进度和配额状态
- 🎨 **现代化 UI**：Tailwind CSS + shadcn/ui 设计系统，响应式布局
- 🐳 **容器化部署**：Docker Compose 一键部署，支持生产环境

## 技术栈
- **前端**：Next.js 15 (App Router), React 18, React Query (TanStack Query v5), TypeScript, Tailwind CSS, shadcn/ui
- **后端**：FastAPI, SQLAlchemy 2.0 (AsyncPG), Pydantic, Argon2 (密码哈希)
- **数据库**：PostgreSQL 16
- **缓存/队列**：Redis 7
- **对象存储**：S3 兼容服务（MinIO/AWS S3）
- **翻译引擎**：pdf2zh-next (v2.6.0+) 支持 20+ 翻译服务
- **部署**：Docker Compose, Pixi 环境管理
- **包管理**：前端使用 [bun](https://bun.sh)，后端使用 [pixi](https://pixi.sh)

## 快速开始

### 前置要求
- PostgreSQL 16+
- Redis 7+
- Python 3.11+ 或 Pixi
- Node.js 18+ 或 Pixi

### 开发环境（Pixi 推荐）
项目根目录已提供 `pixi.toml`，无需手动安装 Python/Node。首次运行：

```bash
# 1. 安装依赖
pixi install
pixi run install-frontend  # 使用 bun install

# 2. 配置环境变量（可选，使用默认值）
cp .env.example .env

# 3. 数据库迁移（已自动执行）
# 说明：后端启动时会自动运行 Alembic 迁移，通常无需手动执行。
# 如需手动迁移或排查，可运行：
pixi run alembic upgrade head

# 4. 初始化默认数据（创建管理员用户和默认服务）
pixi run python scripts/init_db.py
```

日常命令：

```bash
pixi run start-backend        # 运行 FastAPI (http://localhost:8000)
pixi run dev-frontend         # 运行 Next.js (http://localhost:3000)
pixi run lint-frontend        # 执行前端 Lint
pixi run alembic upgrade head # 运行数据库迁移
```

### 默认管理员账号
初始化后可使用以下账号登录：
- **邮箱**：`admin@example.com`
- **密码**：`admin123`

⚠️ **生产环境请立即修改默认密码！**

### 账号安全与忘记密码

- 可在“后台 → 设置 → 系统”启用 ALTCHA（需配置 Secret Key）。
- 可在“后台 → 设置 → 邮件”配置 SMTP（Host/Port/Username/Password/TLS/From）。
- 启用后，登录/注册/忘记密码/重置密码均需完成 ALTCHA 验证。
- 已兼容 ALTCHA v2 前端组件：前端提交的 `altchaPayload` 为 base64 JSON，包含 `algorithm`, `challenge`, `number`, `salt`, `signature`, `took`（不包含 `expires`）。后端验证方式为：
  - 校验 `sha256(salt + number) == challenge`
  - 校验服务端签名 `HMAC(secret, challenge + salt) == signature`
- 前端入口页面：`/login`、`/register`、`/forgot-password`、`/reset-password`。

### 手动安装

如暂不使用 Pixi，可通过传统方式安装：

```bash
# Backend
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt

# 运行数据库迁移（可选，后端会自动执行）
alembic upgrade head

# 初始化默认数据
python scripts/init_db.py

# 启动后端
uvicorn app.main:app --reload --port 8000

# Frontend（另一个终端）
cd Front
npm install
npm run dev
```

## 生产部署

### Docker Compose（一键部署）
```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置生产环境配置

# 2. 启动所有服务
docker compose up --build -d

# 3. 运行数据库迁移（可选，后端会自动执行）
docker compose exec backend pixi run alembic upgrade head

# 4. 初始化默认数据
docker compose exec backend pixi run python scripts/init_db.py

# 5. 查看日志
docker compose logs -f
```

服务配置：
- `postgres`：PostgreSQL 16 数据库，监听 `localhost:5432`
- `redis`：Redis 7 缓存，监听 `localhost:6379`
- `backend`：FastAPI 后端，监听 `localhost:8000`
- `frontend`：Next.js 前端，监听 `localhost:3000`

访问地址：
- **前端界面**：http://localhost:3000
- **后端 API**：http://localhost:8000
- **API 文档**：http://localhost:8000/docs

详细部署指南请参考：[docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)

### 环境变量
后端支持丰富的配置选项（完整列表见 `app/config.py`）：

#### 核心配置
| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PDF_APP_DATABASE_URL` | PostgreSQL 连接串 | `postgresql+asyncpg://postgres:postgres@localhost:5432/pdftranslate` |
| `PDF_APP_REDIS_URL` | Redis 连接串 | `redis://localhost:6379/0` |
| `PDF_APP_SESSION_SECRET` | 会话密钥（生产环境必须修改） | `change-me-in-production` |
| `PDF_APP_PORT` | 后端服务端口 | `8000` |

#### 存储配置
> ⚠️ **重要：** S3 相关配置（Endpoint、Access Key、Secret、Bucket、Region、TTL）现已全部存储在数据库中，只能通过后台 `Admin → Settings → S3` 页面管理。环境变量 `PDF_APP_S3_*` 不再生效，部署后请立即登录后台填写，以便任务能够正确上传/下载文件。

#### 翻译引擎配置（已弃用，请使用服务配置界面）
| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PDF_APP_BABELDOC_SERVICE` | 默认翻译引擎 | `google` |

> ⚠️ **注意**：v1.0.0 开始，推荐通过管理后台的"服务配置"界面管理翻译引擎，而不是环境变量。

#### 前端环境变量（统一）
- `NEXT_PUBLIC_API_BASE_URL`：后端 API 的基地址，必须包含 `/api` 路径。例如：
  - 本地开发（Compose 内部）：`http://pdfbackend:8000/api`
  - 生产环境（公网域名）：`https://api.your-domain.com/api`

说明：
- 前端所有 HTTP 与 WebSocket 调用均以该基地址为准；Next.js 的 `rewrites` 也使用该变量进行代理。
- 该变量在构建时生效（NEXT_PUBLIC_* 会被编译进前端代码），修改后需要重新构建镜像或应用。

### Docker 镜像发布
`.github/workflows/docker-publish.yml` 会在以下情况触发自动发布：
- 推送到 `main` 分支
- 创建以 `v*`、`release-*`、`deploy-*` 开头的 Tag

发布的镜像：
- 后端：`ghcr.io/<owner>/<repo>-backend:{latest|<commit>}`
- 前端：`ghcr.io/<owner>/<repo>-frontend:{latest|<commit>}`

## 翻译服务配置

### 通过管理后台配置（推荐）

v1.0.0 开始，推荐通过 Web 界面管理翻译服务：

1. 使用管理员账号登录
2. 进入"服务配置"页面
3. 点击"创建服务"
4. 填写服务信息：
   - **ID**：服务唯一标识（如 `google-free`）
   - **名称**：显示名称（如 `Google 翻译（免费）`）
   - **类型**：选择翻译引擎类型
   - **配置**：JSON 格式的服务配置
   - **状态**：启用/禁用
   - **默认**：是否设为默认服务

### 支持的翻译引擎

| 引擎 | 类型标识 | 配置示例 |
| --- | --- | --- |
| Google 翻译 | `google` | `{}` |
| DeepL | `deepl` | `{"api_key": "your-key"}` |
| OpenAI | `openai` | `{"api_key": "sk-...", "model": "gpt-3.5-turbo"}` |
| Azure OpenAI | `azure-openai` | `{"api_key": "...", "endpoint": "..."}` |
| Gemini | `gemini` | `{"api_key": "..."}` |
| Ollama | `ollama` | `{"host": "http://localhost:11434", "model": "llama2"}` |
| DeepSeek | `deepseek` | `{"api_key": "..."}` |
| Zhipu (智谱) | `zhipu` | `{"api_key": "..."}` |
| SiliconFlow | `siliconflow` | `{"api_key": "..."}` |
| Tencent | `tencent` | `{"secret_id": "...", "secret_key": "..."}` |
| Grok | `grok` | `{"api_key": "..."}` |
| Groq | `groq` | `{"api_key": "..."}` |

完整配置说明请参考：[docs/MULTI_USER_GUIDE.md](docs/MULTI_USER_GUIDE.md)

### 基于分组的访问控制

管理员可以通过分组统一管理用户的服务访问权限：

1. 进入"分组管理"页面
2. 创建分组（如"产品团队A"、"研发团队"等）
3. 为分组添加可用的翻译服务，并可拖拽排序
4. 在"用户管理"中将用户分配到对应分组

**分组特性：**
- 每个用户可以属于 0 或 1 个分组
- 分组内的服务按 `sort_order` 排序
- 前端会按分组顺序自动选择默认服务：
  - 解析任务（MinerU）默认选择分组中的第一个 MinerU 配置
  - 翻译任务默认选择分组中的第一个非 MinerU 配置
- **没有分组的用户无法使用任何服务**（必须由管理员分配到分组）

## API 文档

启动后端服务后，可通过以下地址访问：
- **Swagger UI**：http://localhost:8000/docs
- **ReDoc**：http://localhost:8000/redoc
- **健康检查**：http://localhost:8000/health

### 主要接口

#### 认证接口
- `POST /auth/login` - 用户登录
- `POST /auth/logout` - 用户登出
- `GET /auth/me` - 获取当前用户信息

#### 用户接口
- `GET /api/users/me` - 获取当前用户详细信息
- `GET /api/users/me/quota` - 获取配额状态
- `GET /api/users/me/providers` - 获取可用的翻译服务

#### 任务接口
- `POST /api/tasks` - 创建翻译任务
- `GET /api/tasks` - 获取任务列表
- `GET /api/tasks/{id}` - 获取任务详情
- `POST /api/tasks/{id}/retry` - 重试任务
- `POST /api/tasks/{id}/cancel` - 取消任务
- `GET /api/tasks/{id}/download` - 下载翻译结果

#### 管理员接口（需要 admin 角色）

**用户管理**：
- `GET /api/admin/users` - 获取用户列表
- `POST /api/admin/users` - 创建用户
- `GET /api/admin/users/{id}` - 获取用户详情
- `PATCH /api/admin/users/{id}` - 更新用户信息
- `DELETE /api/admin/users/{id}` - 删除用户
- `PATCH /api/admin/users/{id}/quota` - 更新用户配额

**服务配置管理**：
- `GET /api/admin/providers` - 获取服务列表
- `POST /api/admin/providers` - 创建服务配置
- `GET /api/admin/providers/{id}` - 获取服务详情
- `PATCH /api/admin/providers/{id}` - 更新服务配置
- `DELETE /api/admin/providers/{id}` - 删除服务配置

**分组管理**：
- `GET /api/admin/groups` - 获取分组列表
- `POST /api/admin/groups` - 创建分组
- `GET /api/admin/groups/{id}` - 获取分组详情
- `PATCH /api/admin/groups/{id}` - 更新分组配置
- `DELETE /api/admin/groups/{id}` - 删除分组

详细 API 文档请参考：[docs/API_REFERENCE.md](docs/API_REFERENCE.md)

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
bun install  # 使用 bun 替代 npm
bun run dev      # 开发模式 - 使用 bun
bun run build    # 生产构建 - 使用 bun  
bun run lint     # 代码检查 - 使用 bun
```

### 数据库迁移
```bash
# 生成迁移文件
pixi run alembic revision --autogenerate -m "描述"

# 执行迁移（单文件基线）
pixi run alembic upgrade head

# 查看当前版本
pixi run alembic current

# 回滚迁移
pixi run alembic downgrade -1
```

### 测试
```bash
# 运行数据库迁移测试
pixi run python scripts/test_migration.py

# 运行 API 端点测试
pixi run python scripts/test_api_endpoints.py

# 运行端到端测试
pixi run python scripts/test_e2e_flow.py
```

测试指南请参考：[docs/PHASE3_TESTING_GUIDE.md](docs/PHASE3_TESTING_GUIDE.md)

## 架构设计

### 数据模型
- **User**：用户信息，包含角色（admin/user）、配额限制、使用统计、所属分组
- **TranslationTask**：翻译任务，包含源文件、目标语言、状态、页数、关联服务
- **TranslationProviderConfig**：翻译服务配置，存储引擎类型、API 密钥等设置
- **Group**：用户分组，用于统一管理用户权限
- **GroupProviderAccess**：分组-服务访问映射，控制分组可使用的翻译服务

### 角色权限模型
- **管理员（admin）**：
  - 管理所有用户（创建、编辑、删除、配额管理、分组分配）
  - 管理翻译服务配置
  - 管理分组和分组权限
  - 查看所有任务

- **普通用户（user）**：
  - 创建翻译任务（受配额限制）
  - 查看自己的任务
  - 使用所属分组授权的翻译服务
  - 查看自己的配额状态

### 配额管理流程
1. 用户上传 PDF 文件
2. 系统使用 PyPDF2 统计页数
3. 检查用户剩余配额是否足够
4. 配额足够则创建任务并扣除配额
5. 任务失败时自动退还配额
6. 每日 UTC 午夜自动重置配额

### 异步任务流程
1. 用户选择翻译服务并创建任务
2. 系统检查用户所属分组是否有该服务的访问权限
3. 检查并扣除用户配额
4. 任务入队 Redis，状态为 `queued`
5. Worker 异步处理，状态变为 `processing`
6. Worker 调用配置的翻译引擎处理文档
7. 处理完成更新任务状态为 `completed` 和结果文件链接
8. 处理失败更新状态为 `failed` 并退还配额
9. 前端通过轮询（4秒间隔）获取任务状态更新

### 存储策略
- **PostgreSQL**：存储任务元数据和状态
- **Redis**：缓存和任务队列
- **MinIO S3**：存储原始PDF和翻译结果文件
- **文件TTL**：根据对象最近修改时间 + TTL 天数自动清理，无需依赖 S3 Tagging，兼容本地 MinIO

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

## 使用指南

### 管理员操作

#### 初始化对象存储配置（必做）
1. 以管理员身份登录
2. 进入 **Admin → Settings → S3**
3. 填写对象存储 Endpoint、Access Key、Secret、Bucket、Region、TTL
4. 点击“保存”后，配置会写入数据库，所有后端服务统一读取

#### 1. 创建用户
1. 登录管理后台
2. 进入"用户管理"
3. 点击"创建用户"
4. 填写用户信息（邮箱、姓名、密码、角色、配额）
5. 点击"创建"

#### 2. 配置翻译服务
1. 进入"服务配置"
2. 点击"创建服务"
3. 填写服务信息（ID、名称、类型、配置 JSON）
4. 设置是否启用和是否为默认服务
5. 点击"创建"

#### 3. 管理分组和权限
1. 进入"分组管理"
2. 创建分组（如"产品团队"、"研发团队"）
3. 为分组添加可用的翻译服务
4. 在"用户管理"中将用户分配到对应分组

### 普通用户操作

#### 1. 创建翻译任务
1. 登录系统
2. 进入"我的任务"
3. 上传 PDF 文件
4. 填写文档名称、源语言、目标语言
5. 选择翻译服务（从可用服务中选择）
6. 查看配额消耗预估
7. 点击"创建任务"

#### 2. 查看任务进度
- 任务列表通过 WebSocket (`ws(s)://<后端>/api/tasks/ws`) 实时同步，连接断开时自动退回 4 秒轮询
- 可在详情抽屉或调试工具中调用 `GET /api/tasks/{task_id}` 查看更细粒度状态
- 查看任务状态：排队中、处理中、已完成、失败
- 查看进度百分比

#### 3. 下载翻译结果
- 任务完成后点击"下载"按钮
- 下载翻译后的 PDF 文件

## 故障排除

### 常见问题

#### 1. 数据库连接失败
```bash
# 检查 PostgreSQL 是否运行
psql -U postgres -c "SELECT version();"

# 检查连接字符串
echo $PDF_APP_DATABASE_URL
```

#### 2. Redis 连接失败
```bash
# 检查 Redis 是否运行
redis-cli ping

# 检查连接字符串
echo $PDF_APP_REDIS_URL
```

#### 3. 翻译任务失败
- 检查翻译服务配置是否正确
- 验证 API 密钥是否有效
- 查看后端日志：`docker compose logs backend`。从现在起所有翻译异常都会输出 `Task <id> translation failed/...` 的错误日志，方便快速定位问题

#### 4. 配额不足
- 管理员可在"用户管理"中调整用户配额
- 配额每日 UTC 午夜自动重置

#### 5. 无法访问管理后台
- 确认用户角色为 `admin`
- 检查浏览器控制台是否有错误
- 清除浏览器缓存和 Cookie

#### 6. ImportError: libGL.so.1（导入 cv2 失败）
出现如下错误时：

```
ImportError: libGL.so.1: cannot open shared object file: No such file or directory
```

原因：OpenCV 在运行时需要系统级 OpenGL 运行库（libGL）。

解决：本仓库已在 `Dockerfile.backend` 安装所需运行库（`libgl1`, `libglib2.0-0`, `libsm6`, `libxext6`, `libxrender1`）。请重新构建后端镜像：

```bash
docker compose build pdfbackend
docker compose up -d
```

如果使用自定义镜像，请确保基础镜像已安装上述包（Ubuntu/Debian 系：`apt-get install -y libgl1 libglib2.0-0 libsm6 libxext6 libxrender1`）。

### 调试模式
```bash
# 启用详细日志
export PDF_APP_LOG_LEVEL=DEBUG

# 数据库调试
export SQLALCHEMY_ECHO=true

# 查看后端日志
docker compose logs -f backend

# 查看前端日志
docker compose logs -f frontend
```

## 文档

- **[多用户系统指南](docs/MULTI_USER_GUIDE.md)** - 完整的多用户功能说明
- **[部署指南](docs/DEPLOYMENT_GUIDE.md)** - 生产环境部署步骤
- **[API 参考](docs/API_REFERENCE.md)** - 详细的 API 文档
- **[测试指南](docs/PHASE3_TESTING_GUIDE.md)** - 测试执行指南
- **[安全审计](docs/SECURITY_AUDIT_CHECKLIST.md)** - 安全检查清单
- **[集成测试计划](docs/INTEGRATION_TEST_PLAN.md)** - 手动测试用例
- **[实施总结](docs/IMPLEMENTATION_SUMMARY.md)** - 项目实施总结
- **[变更日志](CHANGELOG.md)** - 版本更新记录

## 贡献指南

1. Fork 项目并创建功能分支
2. 遵循代码规范运行 `ruff check .` 和 `ruff format .`
3. 添加必要的测试用例
4. 提交 PR 并描述改动

### 代码规范
- **简洁优先**：小函数、小模块、直白逻辑
- **可读优先**：清晰命名、严格类型、删除冗余注释
- **易维护优先**：边界清晰、职责单一
- **拒绝过度防御**：针对性校验，避免推测式编程

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 联系方式

- 项目维护：PDFTranslate Team
- 问题反馈：[GitHub Issues](../../issues)
- 技术讨论：欢迎提交 PR 和 Issue

## 版本历史

### v1.0.0 (2025-11-08) - 多用户系统
- ✨ 新增多用户支持和角色权限管理（RBAC）
- ✨ 新增配额管理系统（每日页数限制）
- ✨ 新增翻译服务配置管理
- ✨ 新增用户-服务访问控制
- 🎨 全新的管理后台界面（Tailwind CSS + shadcn/ui）
- 📝 完整的文档和测试套件
- 🔒 增强的安全措施（Argon2 密码哈希、RBAC）

### v0.1.0 - 初始版本
- 基础的单管理员系统
- PDF 翻译任务管理
- 多翻译引擎支持

详细变更请查看：[CHANGELOG.md](CHANGELOG.md)

---

*本项目基于 BabelDOC 和 PDFMathTranslate，致力于提供专业可靠的多用户 PDF 文档翻译解决方案。*
