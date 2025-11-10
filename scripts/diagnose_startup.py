#!/usr/bin/env python3
"""
诊断后端启动问题的脚本

用法:
    python scripts/diagnose_startup.py
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))


async def check_redis():
    """检查 Redis 连接"""
    print("🔍 检查 Redis 连接...")
    try:
        from app.redis_client import redis_client
        await redis_client.connect()
        
        # 测试基本操作
        await redis_client.redis.set("test_key", "test_value", ex=10)
        value = await redis_client.redis.get("test_key")
        
        if value and value.decode() == "test_value":
            print("✅ Redis 连接正常")
            await redis_client.disconnect()
            return True
        else:
            print("❌ Redis 读写测试失败")
            return False
    except Exception as e:
        print(f"❌ Redis 连接失败: {e}")
        return False


async def check_database():
    """检查数据库连接"""
    print("\n🔍 检查数据库连接...")
    try:
        from app.database import engine, AsyncSessionLocal
        from sqlalchemy import text
        
        async with AsyncSessionLocal() as db:
            result = await db.execute(text("SELECT 1"))
            if result.scalar() == 1:
                print("✅ 数据库连接正常")
                return True
            else:
                print("❌ 数据库查询失败")
                return False
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        return False


async def check_stalled_tasks():
    """检查是否有 stalled tasks"""
    print("\n🔍 检查 stalled tasks...")
    try:
        from app.database import AsyncSessionLocal
        from app.models import TranslationTask
        from sqlalchemy import select
        
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(TranslationTask).where(TranslationTask.status == "processing")
            )
            stalled_tasks = result.scalars().all()
            
            if not stalled_tasks:
                print("✅ 没有 stalled tasks")
                return True
            else:
                print(f"⚠️  发现 {len(stalled_tasks)} 个 stalled tasks:")
                for task in stalled_tasks[:5]:  # 只显示前5个
                    print(f"   - Task {task.id}: {task.document_name} (owner: {task.owner_email})")
                if len(stalled_tasks) > 5:
                    print(f"   ... 还有 {len(stalled_tasks) - 5} 个任务")
                return True
    except Exception as e:
        print(f"❌ 检查 stalled tasks 失败: {e}")
        return False


async def check_task_queues():
    """检查任务队列状态"""
    print("\n🔍 检查任务队列...")
    try:
        from app.redis_client import redis_client
        
        if not redis_client.redis:
            await redis_client.connect()
        
        queue_lengths = await redis_client.get_all_queues_length()
        total = sum(queue_lengths.values())
        
        print(f"📊 队列状态:")
        print(f"   - High priority: {queue_lengths.get('high', 0)}")
        print(f"   - Normal priority: {queue_lengths.get('normal', 0)}")
        print(f"   - Low priority: {queue_lengths.get('low', 0)}")
        print(f"   - Total: {total}")
        
        if total > 100:
            print(f"⚠️  队列中有 {total} 个任务，可能影响启动速度")
        else:
            print("✅ 队列状态正常")
        
        await redis_client.disconnect()
        return True
    except Exception as e:
        print(f"❌ 检查队列失败: {e}")
        return False


async def test_task_resumption():
    """测试任务恢复流程"""
    print("\n🔍 测试任务恢复流程...")
    try:
        from app.tasks import task_manager
        
        print("   开始恢复 stalled tasks...")
        start_time = asyncio.get_event_loop().time()
        
        # 设置 5 秒超时
        await asyncio.wait_for(task_manager.resume_stalled_tasks(), timeout=5.0)
        
        elapsed = asyncio.get_event_loop().time() - start_time
        print(f"✅ 任务恢复完成 (耗时: {elapsed:.2f}s)")
        return True
    except asyncio.TimeoutError:
        print("⚠️  任务恢复超时 (>5s)，这可能导致启动阻塞")
        return False
    except Exception as e:
        print(f"❌ 任务恢复失败: {e}")
        return False


async def check_admin_user():
    """检查管理员用户"""
    print("\n🔍 检查管理员用户...")
    try:
        from app.database import AsyncSessionLocal
        from app.models import User
        from app.config import get_settings
        from sqlalchemy import select
        
        settings = get_settings()
        
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(User).where(User.email == settings.admin_email)
            )
            admin_user = result.scalar_one_or_none()
            
            if admin_user:
                print(f"✅ 管理员用户存在: {admin_user.email}")
                print(f"   - Name: {admin_user.name}")
                print(f"   - Role: {admin_user.role}")
                print(f"   - Active: {admin_user.is_active}")
                return True
            else:
                print(f"⚠️  管理员用户不存在: {settings.admin_email}")
                print("   提示: 首次启动时会自动创建")
                return True
    except Exception as e:
        print(f"❌ 检查管理员用户失败: {e}")
        return False


async def main():
    """主诊断流程"""
    print("=" * 60)
    print("🔧 PDFTranslate 后端启动诊断工具")
    print("=" * 60)
    
    results = []
    
    # 1. 检查 Redis
    results.append(("Redis", await check_redis()))
    
    # 2. 检查数据库
    results.append(("Database", await check_database()))
    
    # 3. 检查管理员用户
    results.append(("Admin User", await check_admin_user()))
    
    # 4. 检查 stalled tasks
    results.append(("Stalled Tasks", await check_stalled_tasks()))
    
    # 5. 检查任务队列
    results.append(("Task Queues", await check_task_queues()))
    
    # 6. 测试任务恢复
    results.append(("Task Resumption", await test_task_resumption()))
    
    # 总结
    print("\n" + "=" * 60)
    print("📋 诊断总结")
    print("=" * 60)
    
    all_passed = True
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ 所有检查通过！后端应该可以正常启动。")
        print("\n如果登录仍然失败，请检查:")
        print("  1. 后端日志中是否有 '🎉 Backend startup complete!' 消息")
        print("  2. 前端是否正确配置了 API 代理 (next.config.ts)")
        print("  3. 浏览器控制台是否有网络错误")
    else:
        print("❌ 发现问题！请根据上述错误信息修复。")
        print("\n常见解决方案:")
        print("  - Redis 连接失败: 检查 Redis 是否运行，环境变量是否正确")
        print("  - 数据库连接失败: 检查 PostgreSQL 是否运行，连接字符串是否正确")
        print("  - 任务恢复超时: 可能有大量 stalled tasks，考虑手动清理")
    print("=" * 60)
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

