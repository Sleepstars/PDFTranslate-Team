#!/usr/bin/env python3
"""
修复 stalled tasks 的脚本

用法:
    # 查看 stalled tasks
    python scripts/fix_stalled_tasks.py --list
    
    # 将所有 stalled tasks 标记为 failed
    python scripts/fix_stalled_tasks.py --mark-failed
    
    # 将所有 stalled tasks 重新排队
    python scripts/fix_stalled_tasks.py --requeue
"""

import asyncio
import sys
import argparse
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))


async def list_stalled_tasks():
    """列出所有 stalled tasks"""
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
            return []
        
        print(f"发现 {len(stalled_tasks)} 个 stalled tasks:\n")
        print(f"{'ID':<40} {'Document':<30} {'Owner':<30} {'Progress':<10}")
        print("-" * 110)
        
        for task in stalled_tasks:
            print(f"{task.id:<40} {task.document_name[:28]:<30} {task.owner_email[:28]:<30} {task.progress}%")
        
        return stalled_tasks


async def mark_failed():
    """将所有 stalled tasks 标记为 failed"""
    from app.database import AsyncSessionLocal
    from app.models import TranslationTask
    from app.redis_client import redis_client
    from sqlalchemy import select
    
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(TranslationTask).where(TranslationTask.status == "processing")
        )
        stalled_tasks = result.scalars().all()
        
        if not stalled_tasks:
            print("✅ 没有 stalled tasks 需要处理")
            return
        
        print(f"将 {len(stalled_tasks)} 个 stalled tasks 标记为 failed...")
        
        await redis_client.connect()
        
        for task in stalled_tasks:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(TranslationTask).where(TranslationTask.id == task.id)
                )
                current_task = result.scalar_one_or_none()
                if not current_task:
                    continue
                
                current_task.status = "failed"
                current_task.error = "系统重启时任务被中断"
                current_task.progress_message = "任务已失败"
                await db.commit()
                
                # 清理缓存
                try:
                    await redis_client.invalidate_task_details_cache(task.id)
                    await redis_client.invalidate_user_tasks_cache(current_task.owner_id)
                    await redis_client.set_task_status(current_task.id, current_task.status)
                except Exception as e:
                    print(f"⚠️  清理缓存失败 (task {task.id}): {e}")
                
                print(f"✅ Marked task {task.id} as failed")
        
        await redis_client.disconnect()
        print(f"\n✅ 完成！{len(stalled_tasks)} 个任务已标记为 failed")


async def requeue_tasks():
    """将所有 stalled tasks 重新排队"""
    from app.database import AsyncSessionLocal
    from app.models import TranslationTask
    from app.redis_client import redis_client
    from sqlalchemy import select
    
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(TranslationTask).where(TranslationTask.status == "processing")
        )
        stalled_tasks = result.scalars().all()
        
        if not stalled_tasks:
            print("✅ 没有 stalled tasks 需要处理")
            return
        
        print(f"将 {len(stalled_tasks)} 个 stalled tasks 重新排队...")
        
        await redis_client.connect()
        
        for task in stalled_tasks:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(TranslationTask).where(TranslationTask.id == task.id)
                )
                current_task = result.scalar_one_or_none()
                if not current_task:
                    continue
                
                current_task.status = "queued"
                current_task.progress = 0
                current_task.progress_message = "手动重新排队"
                await db.commit()
                
                # 清理缓存
                try:
                    await redis_client.invalidate_task_details_cache(task.id)
                    await redis_client.invalidate_user_tasks_cache(current_task.owner_id)
                    await redis_client.set_task_status(current_task.id, current_task.status)
                except Exception as e:
                    print(f"⚠️  清理缓存失败 (task {task.id}): {e}")
                
                # 重新入队
                await redis_client.enqueue_task(task.id, task.priority)
                print(f"✅ Requeued task {task.id}")
        
        await redis_client.disconnect()
        print(f"\n✅ 完成！{len(stalled_tasks)} 个任务已重新排队")


async def main():
    parser = argparse.ArgumentParser(description="修复 stalled tasks")
    parser.add_argument("--list", action="store_true", help="列出所有 stalled tasks")
    parser.add_argument("--mark-failed", action="store_true", help="将所有 stalled tasks 标记为 failed")
    parser.add_argument("--requeue", action="store_true", help="将所有 stalled tasks 重新排队")
    
    args = parser.parse_args()
    
    if not any([args.list, args.mark_failed, args.requeue]):
        parser.print_help()
        return 1
    
    print("=" * 60)
    print("🔧 Stalled Tasks 修复工具")
    print("=" * 60)
    print()
    
    if args.list:
        await list_stalled_tasks()
    
    if args.mark_failed:
        confirm = input("\n⚠️  确认将所有 stalled tasks 标记为 failed? (yes/no): ")
        if confirm.lower() == "yes":
            await mark_failed()
        else:
            print("❌ 操作已取消")
    
    if args.requeue:
        confirm = input("\n⚠️  确认将所有 stalled tasks 重新排队? (yes/no): ")
        if confirm.lower() == "yes":
            await requeue_tasks()
        else:
            print("❌ 操作已取消")
    
    print("\n" + "=" * 60)
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

