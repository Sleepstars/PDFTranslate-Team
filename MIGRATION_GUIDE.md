# 项目重构迁移指南

## 重大变更

本次重构将项目从内存存储升级为生产级架构，主要变更包括：

### 1. 存储架构
- **PostgreSQL**: 用户数据和任务元数据持久化存储
- **Redis**: 任务队列管理和会话存储
- **S3 (MinIO)**: PDF 文件和翻译结果存储，支持自动过期删除

### 2. 认证系统
- 从内存会话改为 Redis 会话存储
- 密码使用 bcrypt 哈希存储
- 支持多用户（数据库存储）

### 3. 文件处理
- 前端支持 PDF 文件上传
- 文件存储在 S3，自动生成预签名 URL
- 支持配置文件 TTL（默认 7 天自动删除）

### 4. 模型配置
- 前端新增高级配置面板
- 支持配置模型、temperature、max_tokens 等参数
- 配置随任务存储在数据库

## 快速开始

### 1. 环境变量配置

创建 `.env.backend` 文件：

```bash
# 管理员账号
PDF_APP_ADMIN_EMAIL=admin@example.com
PDF_APP_ADMIN_PASSWORD=changeme
PDF_APP_ADMIN_NAME=PDF Admin

# 数据库
PDF_APP_DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/pdftranslate

# Redis
PDF_APP_REDIS_URL=redis://redis:6379/0

# S3 (MinIO)
PDF_APP_S3_ENDPOINT=http://minio:9000
PDF_APP_S3_ACCESS_KEY=minioadmin
PDF_APP_S3_SECRET_KEY=minioadmin
PDF_APP_S3_BUCKET=pdftranslate
PDF_APP_S3_REGION=us-east-1
PDF_APP_S3_FILE_TTL_DAYS=7

# CORS
PDF_APP_CORS_ORIGINS='["http://localhost:3000"]'
```

### 2. 启动服务

```bash
# 使用 Docker Compose 启动所有服务
docker-compose up -d

# 初始化 MinIO bucket
chmod +x init-minio.sh
./init-minio.sh
```

### 3. 访问服务

- **前端**: http://localhost:3000
- **后端 API**: http://localhost:8000
- **MinIO 控制台**: http://localhost:9001 (minioadmin/minioadmin)
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### 4. 默认登录

- 邮箱: `admin@example.com`
- 密码: `changeme`

## 数据库迁移

### 运行迁移

```bash
# 进入后端容器
docker-compose exec backend bash

# 运行迁移
alembic upgrade head

# 创建新迁移（如需修改模型）
alembic revision --autogenerate -m "description"
```

### 手动创建管理员用户

```python
from app.auth import create_user
from app.database import AsyncSessionLocal

async with AsyncSessionLocal() as db:
    await create_user(db, "admin", "admin@example.com", "Admin", "password123")
```

## API 变更

### 创建任务 (POST /api/tasks)

**旧版本** (JSON):
```json
{
  "documentName": "test.pdf",
  "sourceLang": "en",
  "targetLang": "zh",
  "engine": "babeldoc",
  "priority": "normal",
  "notes": "test"
}
```

**新版本** (FormData):
```javascript
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('documentName', 'test.pdf');
formData.append('sourceLang', 'en');
formData.append('targetLang', 'zh');
formData.append('engine', 'babeldoc');
formData.append('priority', 'normal');
formData.append('notes', 'test');
formData.append('modelConfig', JSON.stringify({
  model: 'gpt-4',
  temperature: 0.3,
  maxTokens: 4096
}));
```

## 前端变更

### 新增功能
1. **文件上传**: 支持拖拽或选择 PDF 文件
2. **高级配置**: 可展开/折叠的模型参数配置
3. **文件预览**: 显示已选择的文件名

### 类型更新
```typescript
// 新增 ModelConfig 类型
type ModelConfig = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

// CreateTaskPayload 新增 file 和 modelConfig
type CreateTaskPayload = {
  file: File;  // 新增
  documentName: string;
  sourceLang: string;
  targetLang: string;
  engine: string;
  priority?: TranslationPriority;
  notes?: string;
  modelConfig?: ModelConfig;  // 新增
};
```

## 生产部署建议

### 1. 安全配置
```bash
# 修改默认密码
PDF_APP_ADMIN_PASSWORD=<strong-password>

# 使用 HTTPS
PDF_APP_SESSION_COOKIE_SECURE=true

# 限制 CORS
PDF_APP_CORS_ORIGINS='["https://yourdomain.com"]'
```

### 2. 使用真实 S3
```bash
# AWS S3
PDF_APP_S3_ENDPOINT=  # 留空使用 AWS
PDF_APP_S3_ACCESS_KEY=<your-access-key>
PDF_APP_S3_SECRET_KEY=<your-secret-key>
PDF_APP_S3_BUCKET=<your-bucket>
PDF_APP_S3_REGION=us-east-1
```

### 3. 数据库备份
```bash
# 备份 PostgreSQL
docker-compose exec postgres pg_dump -U postgres pdftranslate > backup.sql

# 恢复
docker-compose exec -T postgres psql -U postgres pdftranslate < backup.sql
```

### 4. 监控和日志
```bash
# 查看日志
docker-compose logs -f backend
docker-compose logs -f postgres
docker-compose logs -f redis

# 监控 Redis
docker-compose exec redis redis-cli INFO
```

## 故障排查

### 1. 数据库连接失败
```bash
# 检查 PostgreSQL 是否运行
docker-compose ps postgres

# 查看日志
docker-compose logs postgres

# 测试连接
docker-compose exec postgres psql -U postgres -d pdftranslate
```

### 2. Redis 连接失败
```bash
# 检查 Redis
docker-compose exec redis redis-cli PING

# 查看 Redis 数据
docker-compose exec redis redis-cli KEYS "*"
```

### 3. S3 上传失败
```bash
# 检查 MinIO
curl http://localhost:9000/minio/health/live

# 查看 bucket
docker-compose exec backend python -c "
from app.s3_client import s3_client
print(s3_client.s3.list_buckets())
"
```

### 4. 文件自动删除
```python
# 手动触发过期文件清理
from app.s3_client import s3_client
s3_client.delete_expired_files()
```

## 性能优化

### 1. 数据库连接池
```python
# app/database.py
engine = create_async_engine(
    settings.database_url,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True
)
```

### 2. Redis 连接池
```python
# app/redis_client.py
redis = await redis.from_url(
    settings.redis_url,
    max_connections=50
)
```

### 3. S3 并发上传
使用 boto3 的 TransferConfig 配置多线程上传大文件。

## 开发工具

### 查看数据库
```bash
# 使用 psql
docker-compose exec postgres psql -U postgres pdftranslate

# 常用查询
SELECT * FROM users;
SELECT * FROM translation_tasks ORDER BY created_at DESC LIMIT 10;
```

### 查看 Redis
```bash
# 查看所有 key
docker-compose exec redis redis-cli KEYS "*"

# 查看会话
docker-compose exec redis redis-cli KEYS "session:*"

# 查看任务队列
docker-compose exec redis redis-cli LLEN "tasks:normal"
```

### MinIO 管理
访问 http://localhost:9001 使用 Web 界面管理文件。

## 回滚方案

如需回滚到旧版本：

1. 停止新服务
```bash
docker-compose down
```

2. 切换到旧版本代码
```bash
git checkout <old-commit>
```

3. 启动旧服务
```bash
docker-compose up -d
```

注意：回滚后会丢失数据库中的数据。

## 支持

如有问题，请查看：
- 后端日志: `docker-compose logs backend`
- 前端日志: `docker-compose logs frontend`
- 数据库日志: `docker-compose logs postgres`
