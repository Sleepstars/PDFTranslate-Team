# 登录问题排查指南

## 问题描述

当后台有正在处理的任务时，无法正常登录，登录请求一直挂起。

## 根本原因

后端启动时的 `lifespan` 函数会执行以下操作:

1. 连接 Redis
2. 初始化数据库
3. 创建管理员用户
4. **恢复 stalled tasks** (状态为 `processing` 的任务)
5. 启动任务队列监控

如果有大量 stalled tasks 或者任务恢复过程出错，会导致 `lifespan` 函数阻塞，应用无法完全启动，所有 HTTP 请求（包括登录）都会挂起。

## 已实施的修复

### 1. 添加超时保护 (v1.0.1)

在 `app/main.py` 中为任务恢复添加了 10 秒超时:

```python
try:
    logger.info("🔄 Resuming stalled tasks...")
    await asyncio.wait_for(task_manager.resume_stalled_tasks(), timeout=10.0)
    logger.info("✅ Stalled tasks resumed")
except asyncio.TimeoutError:
    logger.warning("⚠️  Task resumption timed out (10s), continuing startup...")
except Exception as e:
    logger.error(f"⚠️  Task resumption failed: {e}, continuing startup...")
```

**效果**: 即使任务恢复失败或超时，应用也会继续启动，不会阻塞登录。

### 2. 优化任务恢复流程

在 `app/tasks.py` 中改进了 `resume_stalled_tasks` 方法:

- 添加详细日志输出
- 批量处理任务，记录成功/失败数量
- 单个任务失败不影响其他任务
- 缓存操作失败不影响任务恢复

### 3. 增强启动日志

在关键步骤添加了 emoji 日志，便于快速定位问题:

```
🚀 Starting PDFTranslate backend...
📡 Connecting to Redis...
✅ Redis connected
🗄️  Initializing database...
✅ Database initialized
👤 Checking admin user...
✅ Admin user exists
🔄 Resuming stalled tasks...
✅ Stalled tasks resumed
📊 Starting task queue monitor...
✅ Queue monitor started
🎉 Backend startup complete! Ready to accept requests.
```

## 诊断工具

### 1. 启动诊断脚本

运行诊断脚本检查所有组件:

```bash
# 使用 Pixi
pixi run python scripts/diagnose_startup.py

# 或直接运行
python scripts/diagnose_startup.py
```

诊断内容:
- ✅ Redis 连接
- ✅ 数据库连接
- ✅ 管理员用户
- ✅ Stalled tasks 数量
- ✅ 任务队列状态
- ✅ 任务恢复性能测试

### 2. Stalled Tasks 修复脚本

如果发现大量 stalled tasks，可以手动清理:

```bash
# 查看所有 stalled tasks
pixi run python scripts/fix_stalled_tasks.py --list

# 将所有 stalled tasks 标记为 failed
pixi run python scripts/fix_stalled_tasks.py --mark-failed

# 将所有 stalled tasks 重新排队
pixi run python scripts/fix_stalled_tasks.py --requeue
```

## 排查步骤

### 步骤 1: 检查后端日志

启动后端并查看日志:

```bash
pixi run uvicorn app.main:app --reload --port 8000
```

**正常启动日志应该包含**:
```
🎉 Backend startup complete! Ready to accept requests.
```

**如果卡在某个步骤**，例如:
```
🔄 Resuming stalled tasks...
(卡住，没有后续日志)
```

说明任务恢复阻塞了启动。

### 步骤 2: 运行诊断脚本

```bash
pixi run python scripts/diagnose_startup.py
```

查看输出，重点关注:
- **Stalled Tasks**: 如果数量很大 (>50)，可能影响启动
- **Task Resumption**: 如果超时，说明恢复过程太慢

### 步骤 3: 清理 Stalled Tasks (如需要)

如果诊断发现大量 stalled tasks:

```bash
# 先查看
pixi run python scripts/fix_stalled_tasks.py --list

# 标记为 failed (推荐)
pixi run python scripts/fix_stalled_tasks.py --mark-failed
```

### 步骤 4: 重启后端

清理后重启后端:

```bash
pixi run uvicorn app.main:app --reload --port 8000
```

应该能看到快速启动并显示 "🎉 Backend startup complete!"

### 步骤 5: 测试登录

访问 http://localhost:3000/zh/login 并尝试登录。

## 常见问题

### Q1: 为什么会有 stalled tasks?

**原因**:
- 后端异常退出 (Ctrl+C、崩溃、服务器重启)
- 任务处理过程中出错但未正确更新状态

**预防**:
- 使用 `systemd` 或 `supervisor` 管理后端进程
- 定期检查任务状态

### Q2: 任务恢复超时后会怎样?

**行为**:
- 应用会继续启动，不会阻塞登录
- 超时的任务会保持 `processing` 状态
- 可以稍后手动清理

### Q3: 如何避免任务恢复阻塞?

**建议**:
1. 定期清理失败/过期任务
2. 监控任务队列长度
3. 使用诊断脚本定期检查

### Q4: 登录仍然失败怎么办?

**其他可能原因**:

1. **前端代理配置错误**
   
   检查 `Front/next.config.ts`:
   ```typescript
   async rewrites() {
     return [
       {
         source: '/api/:path*',
         destination: 'http://localhost:8000/api/:path*',
       },
       {
         source: '/auth/:path*',
         destination: 'http://localhost:8000/api/auth/:path*',
       },
     ];
   }
   ```

2. **CORS 配置错误**
   
   检查 `.env.backend`:
   ```
   PDF_APP_CORS_ORIGINS=["http://localhost:3000"]
   ```

3. **Redis/PostgreSQL 未运行**
   
   ```bash
   # 检查服务状态
   docker ps  # 如果使用 Docker
   
   # 或
   systemctl status redis
   systemctl status postgresql
   ```

4. **端口冲突**
   
   确保 8000 端口未被占用:
   ```bash
   lsof -i :8000
   ```

## 监控建议

### 1. 添加健康检查

定期检查后端健康状态:

```bash
curl http://localhost:8000/health
```

应该返回:
```json
{"status": "ok"}
```

### 2. 监控任务队列

定期运行诊断脚本:

```bash
# 添加到 cron
0 */6 * * * cd /path/to/project && pixi run python scripts/diagnose_startup.py
```

### 3. 日志监控

使用日志聚合工具 (如 Loki、ELK) 监控关键日志:
- `Backend startup complete`
- `Task resumption timed out`
- `Queue monitor error`

## 相关文件

- `app/main.py` - 应用启动入口
- `app/tasks.py` - 任务管理器
- `scripts/diagnose_startup.py` - 诊断脚本
- `scripts/fix_stalled_tasks.py` - 修复脚本

## 更新日志

- **2025-01-10**: 添加超时保护和诊断工具
- **2025-01-10**: 优化任务恢复流程
- **2025-01-10**: 增强启动日志

