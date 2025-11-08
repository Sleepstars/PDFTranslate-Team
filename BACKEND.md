# PDFTranslate Backend 文档

FastAPI 后端服务，提供完整的 PDF 翻译任务管理、用户认证、数据库存储等功能。

## 项目结构

```
app/
├── __init__.py
├── main.py                 # FastAPI 应用入口
├── config.py              # 应用配置管理
├── database.py            # 数据库连接和模型
├── models.py              # SQLAlchemy 数据模型
├── schemas.py             # Pydantic 数据模型
├── auth.py                # 认证和用户管理
├── dependencies.py        # FastAPI 依赖注入
├── redis_client.py        # Redis 客户端
├── s3_client.py           # S3 存储客户端
├── settings_manager.py    # 设置管理
├── tasks.py               # 任务管理逻辑
├── utils/                 # 工具模块
│   └── __init__.py
└── routes/                # API 路由
    ├── __init__.py
    ├── auth.py            # 认证相关接口
    ├── tasks.py           # 任务管理接口
    └── settings.py        # 系统设置接口
```

## 核心组件

### 1. 配置管理 (config.py)

支持环境变量配置，包含所有应用设置：

```python
class Settings(BaseSettings):
    # 应用基础配置
    app_name: str = "PDFTranslate Backend"
    admin_email: EmailStr = "admin@example.com"
    admin_password: str = "changeme"
    admin_name: str = "PDF Admin"
    
    # 数据库配置
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/pdftranslate"
    
    # Redis 配置
    redis_url: str = "redis://localhost:6379/0"
    
    # S3 存储配置
    s3_endpoint: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "pdftranslate"
    s3_region: str = "us-east-1"
    s3_file_ttl_days: int = 7
    
    # 翻译引擎配置
    babeldoc_service: str = "google"
    babeldoc_lang_from: str = "en"
    babeldoc_lang_to: str = "zh"
    babeldoc_model: str = ""
    babeldoc_threads: int = 4
    
    # 其他翻译服务配置
    openai_api_base: str = ""
    deepl_api_url: str = ""
    ollama_host: str = ""
    azure_openai_endpoint: str = ""
```

### 2. 数据模型 (models.py)

#### User 模型
```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

#### Task 模型
```python
class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    name = Column(String, nullable=False)
    document_name = Column(String, nullable=False)
    source_lang = Column(String, nullable=False, default="en")
    target_lang = Column(String, nullable=False, default="zh")
    engine = Column(String, nullable=False, default="google")
    status = Column(String, nullable=False, default="pending")
    notes = Column(Text)
    user_id = Column(String, ForeignKey("users.id"))
    
    # 文件信息
    original_file_key = Column(String, nullable=False)
    translated_file_key = Column(String)
    mono_output_s3_key = Column(String)
    dual_output_s3_key = Column(String)
    glossary_output_s3_key = Column(String)
    file_size = Column(Integer)
    
    # 处理信息
    progress = Column(Integer, default=0)
    progress_message = Column(Text)
    error_message = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联
    user = relationship("User", backref="tasks")
    results = relationship("TaskResult", backref="task", cascade="all, delete-orphan")
```

#### TaskResult 模型
```python
class TaskResult(Base):
    __tablename__ = "task_results"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    task_id = Column(String, ForeignKey("tasks.id"), nullable=False)
    result_type = Column(String, nullable=False)  # 'translated_pdf', 'logs', 'metrics'
    file_key = Column(String, nullable=False)
    file_url = Column(String)
    metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### 3. 认证系统 (auth.py)

#### Session 管理
```python
async def create_session(db: AsyncSession, user_id: str) -> str:
    """创建用户会话"""
    session_id = str(uuid4())
    session_data = {
        "user_id": user_id,
        "created_at": datetime.utcnow().isoformat()
    }
    await redis_client.setex(
        f"session:{session_id}",
        settings.session_ttl_seconds,
        json.dumps(session_data)
    )
    return session_id

async def get_session(session_id: str) -> Optional[Dict]:
    """获取会话信息"""
    session_data = await redis_client.get(f"session:{session_id}")
    if session_data:
        return json.loads(session_data)
    return None
```

#### 用户认证
```python
async def authenticate_user(db: AsyncSession, username: str, password: str) -> Optional[User]:
    """验证用户凭据"""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user
```

### 4. 任务管理 (tasks.py)

#### 任务状态
- `pending`: 等待处理
- `processing`: 正在处理
- `completed`: 处理完成
- `failed`: 处理失败
- `cancelled`: 已取消

#### 任务生命周期
```python
class TaskManager:
    async def create_task(self, task_data: TaskCreate, user_id: str) -> Task:
        """创建新任务"""
        # 1. 创建任务记录
        task = Task(
            **task_data.dict(),
            user_id=user_id,
            status="pending"
        )
        
        # 2. 保存到数据库
        async with AsyncSessionLocal() as db:
            db.add(task)
            await db.commit()
            await db.refresh(task)
        
        # 3. 添加到任务队列
        await self.queue_task(task.id)
        
        return task
    
    async def process_task(self, task_id: str):
        """处理翻译任务"""
        # 1. 更新任务状态
        # 2. 调用翻译引擎
        # 3. 更新进度
        # 4. 保存结果
        # 5. 清理临时文件
```

### 5. Redis 客户端 (redis_client.py)

```python
class RedisClient:
    def __init__(self):
        self.client = None
    
    async def connect(self):
        """连接 Redis"""
        self.client = redis.from_url(settings.redis_url, decode_responses=True)
    
    async def disconnect(self):
        """断开 Redis 连接"""
        if self.client:
            await self.client.close()
    
    async def setex(self, key: str, ttl: int, value: str):
        """设置键值对（带过期时间）"""
        return await self.client.setex(key, ttl, value)
    
    async def get(self, key: str) -> Optional[str]:
        """获取值"""
        return await self.client.get(key)
    
    async def delete(self, key: str):
        """删除键"""
        return await self.client.delete(key)
    
    async def lpush(self, key: str, *values: str):
        """左推入列表"""
        return await self.client.lpush(key, *values)
    
    async def rpop(self, key: str) -> Optional[str]:
        """右弹出列表"""
        return await self.client.rpop(key)
    
    async def llen(self, key: str) -> int:
        """获取列表长度"""
        return await self.client.llen(key)
```

### 6. S3 存储客户端 (s3_client.py)

```python
class S3Client:
    def __init__(self):
        self.client = None
        self.bucket = settings.s3_bucket
    
    async def connect(self):
        """连接 S3 服务"""
        self.client = boto3.client(
            's3',
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region
        )
    
    async def upload_file(self, file_path: str, key: str, content_type: str = None) -> str:
        """上传文件"""
        if content_type:
            self.client.upload_file(
                file_path, 
                self.bucket, 
                key,
                ExtraArgs={'ContentType': content_type}
            )
        else:
            self.client.upload_file(file_path, self.bucket, key)
        
        return f"{settings.s3_endpoint}/{self.bucket}/{key}"
    
    async def download_file(self, key: str, local_path: str):
        """下载文件"""
        self.client.download_file(self.bucket, key, local_path)
    
    async def delete_file(self, key: str):
        """删除文件"""
        self.client.delete_object(Bucket=self.bucket, Key=key)
    
    async def generate_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """生成预签名URL"""
        return self.client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': key},
            ExpiresIn=expires_in
        )
```

## API 接口

### 认证相关

#### POST /api/auth/login
用户登录
```json
{
    "username": "admin",
    "password": "changeme"
}
```

#### POST /api/auth/logout
用户登出

#### GET /api/auth/me
获取当前用户信息
```json
{
    "id": "user-id",
    "username": "admin",
    "name": "PDF Admin",
    "email": "admin@example.com"
}
```

### 任务管理

#### GET /api/tasks
获取任务列表
```json
{
    "tasks": [
        {
            "id": "task-id",
            "name": "翻译任务",
            "status": "completed",
            "progress": 100,
            "created_at": "2025-11-08T12:00:00Z"
        }
    ],
    "total": 1
}
```

#### POST /api/tasks
创建翻译任务
```json
{
    "name": "合同文档翻译",
    "document_name": "contract.pdf",
    "source_lang": "en",
    "target_lang": "zh",
    "engine": "google",
    "notes": "请保持格式完整性"
}
```

#### GET /api/tasks/{task_id}
获取任务详情

#### POST /api/tasks/{task_id}/retry
重试失败的任务

#### POST /api/tasks/{task_id}/cancel
取消正在处理的任务

#### GET /api/tasks/{task_id}/download
下载翻译结果

### 设置管理

#### GET /api/settings
获取系统设置

#### PUT /api/settings
更新系统设置

## 环境配置

### 开发环境 (.env.backend)
```bash
# 管理员账户
PDF_APP_ADMIN_EMAIL=admin@example.com
PDF_APP_ADMIN_PASSWORD=changeme
PDF_APP_ADMIN_NAME=PDF Admin

# 数据库
PDF_APP_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/pdftranslate

# Redis
PDF_APP_REDIS_URL=redis://localhost:6379/0

# 翻译引擎
PDF_APP_BABELDOC_SERVICE=google
PDF_APP_BABELDOC_LANG_FROM=en
PDF_APP_BABELDOC_LANG_TO=zh
```

### 生产环境
生产环境建议使用外部的 PostgreSQL、Redis 和 S3 服务：
```bash
PDF_APP_DATABASE_URL=postgresql+asyncpg://user:pass@prod-db:5432/pdftranslate
PDF_APP_REDIS_URL=redis://prod-redis:6379/0
```

> 💡 **S3 配置**：所有对象存储参数现仅存放在数据库 `SystemSetting` 表中，并通过后台 **Admin → Settings → S3** 管理。环境变量 `PDF_APP_S3_*` 不再生效。

## 开发指南

### 本地开发
```bash
# 1. 克隆项目
git clone <repository>
cd PDFTranslate-Team

# 2. 安装依赖
uv venv && source .venv/bin/activate
uv pip install -e .

# 3. 启动服务（开发模式）
uvicorn app.main:app --reload --port 8000
```

### 测试
```bash
# 运行所有测试
pytest

# 运行特定测试
pytest tests/test_auth.py
pytest tests/test_tasks.py

# 生成覆盖率报告
pytest --cov=app tests/
```

### 代码规范
```bash
# 代码检查
ruff check .

# 代码格式化
ruff format .

# 类型检查
mypy app/
```

### 数据库操作
```bash
# 生成迁移文件
alembic revision --autogenerate -m "添加用户表"

# 应用迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1
```

## 性能优化

### 数据库优化
- 为常用查询字段添加索引
- 使用连接池管理数据库连接
- 实现读写分离（如需要）

### Redis 优化
- 合理设置键的过期时间
- 使用 Redis Pipeline 批量操作
- 监控内存使用情况

### 异步处理
- 翻译任务使用 Celery 或类似工具
- 实现任务优先级队列
- 添加任务监控和告警

## 监控和日志

### 健康检查
```python
@app.get("/health")
async def health_check():
    """应用健康检查"""
    checks = {
        "database": await check_database(),
        "redis": await check_redis(),
        "s3": await check_s3()
    }
    
    all_healthy = all(checks.values())
    status_code = 200 if all_healthy else 503
    
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "healthy" if all_healthy else "unhealthy",
            "checks": checks,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
```

### 日志配置
```python
import logging
from pythonjsonlogger import jsonlogger

def setup_logging():
    logHandler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter()
    logHandler.setFormatter(formatter)
    logger = logging.getLogger()
    logger.addHandler(logHandler)
    logger.setLevel(logging.INFO)
```

## 部署

### Docker 部署
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Docker Compose 部署
```yaml
backend:
  build: .
  environment:
    - PDF_APP_DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/pdftranslate
    - PDF_APP_REDIS_URL=redis://redis:6379/0
  depends_on:
    - postgres
    - redis
  ports:
    - "8000:8000"
```

## 故障排除

### 常见问题

1. **数据库连接失败**
   ```bash
   # 检查数据库服务
   docker compose exec postgres pg_isready -U postgres
   ```

2. **Redis 连接失败**
   ```bash
   # 检查 Redis 服务
   docker compose exec redis redis-cli ping
   ```

3. **S3 存储问题**
   ```bash
   # 测试 S3 连接
   python -c "import boto3; print(boto3.client('s3').list_buckets())"
   ```

4. **任务处理失败**
   - 检查翻译引擎配置
   - 查看应用日志
   - 确认文件上传成功

### 调试模式
```bash
# 启用调试日志
export PDF_APP_LOG_LEVEL=DEBUG

# SQL 查询日志
export SQLALCHEMY_ECHO=true
```

## 扩展开发

### 添加新的翻译引擎
1. 在 `config.py` 中添加引擎配置
2. 实现翻译接口
3. 在任务处理器中集成新引擎
4. 更新前端引擎选择选项

### 添加新的存储后端
1. 创建新的存储客户端类
2. 实现标准存储接口
3. 在配置中添加存储选项
4. 更新环境变量配置

---

*本文档描述了 PDFTranslate 后端服务的完整实现和使用方法。更多信息请参考项目 README 和相关代码注释。*
