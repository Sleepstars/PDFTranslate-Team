import asyncio
import json
import random
from datetime import datetime
from secrets import token_urlsafe
from typing import Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .config import PublicUser
from .models import TranslationTask
from .database import AsyncSessionLocal
from .redis_client import get_redis
from .s3_client import get_s3
from .settings_manager import get_s3_config


class TaskManager:
    def __init__(self) -> None:
        self.jobs: Dict[str, asyncio.Task] = {}
        # 并发控制信号量
        self.max_concurrent_tasks = 3
        self.task_semaphore = asyncio.Semaphore(self.max_concurrent_tasks)
        # 优先级队列配置
        self.priority_weights = {"high": 3, "normal": 2, "low": 1}
        
    async def _check_concurrent_limit(self) -> bool:
        """检查是否达到并发限制"""
        return len(self.jobs) >= self.max_concurrent_tasks
    
    async def _get_next_priority(self) -> str:
        """获取下一个要处理的任务优先级"""
        redis = await get_redis()
        queue_lengths = await redis.get_all_queues_length()
        
        # 按优先级权重排序处理
        for priority in ["high", "normal", "low"]:
            if queue_lengths.get(priority, 0) > 0:
                return priority
        return "normal"

    async def create_task(self, owner: PublicUser, payload: dict, file_data: Optional[bytes] = None) -> TranslationTask:
        task_id = token_urlsafe(6)

        input_s3_key = None
        async with AsyncSessionLocal() as db:
            if file_data:
                s3_config = await get_s3_config(db)
                s3 = get_s3(s3_config)
                input_s3_key = f"uploads/{owner.id}/{task_id}/input.pdf"
                s3.upload_file(file_data, input_s3_key)
            task = TranslationTask(
                id=task_id,
                owner_id=owner.id,
                owner_email=owner.email,
                document_name=payload['documentName'],
                source_lang=payload['sourceLang'],
                target_lang=payload['targetLang'],
                engine=payload['engine'],
                priority=payload.get('priority', 'normal'),
                notes=payload.get('notes'),
                status='queued',
                progress=0,
                input_s3_key=input_s3_key,
                model_config=json.dumps(payload.get('modelConfig', ))
            )
            db.add(task)
            await db.commit()
            await db.refresh(task)

        redis = await get_redis()
        await redis.enqueue_task(task_id, task.priority)
        
        # 立即尝试开始处理
        self._schedule(task_id)
        
        return task

    async def start_queue_monitor(self):
        """启动队列监控任务"""
        asyncio.create_task(self._queue_monitor_loop())

    async def _queue_monitor_loop(self):
        """队列监控循环"""
        while True:
            try:
                await self._process_pending_tasks()
                await asyncio.sleep(5)  # 每5秒检查一次
            except Exception as e:
                print(f"Queue monitor error: {e}")
                await asyncio.sleep(10)  # 错误时等待更长时间

    async def _process_pending_tasks(self):
        """处理等待中的任务"""
        # 尝试启动等待中的任务
        while len(self.jobs) < self.max_concurrent_tasks:
            priority = await self._get_next_priority()
            if not priority:
                break
                
            redis = await get_redis()
            task_id = await redis.dequeue_task(priority)
            if task_id:
                self._schedule(task_id)
            else:
                break

    def get_concurrent_status(self) -> dict:
        """获取并发状态信息"""
        return {
            "active_tasks": len(self.jobs),
            "max_concurrent": self.max_concurrent_tasks,
            "available_slots": self.max_concurrent_tasks - len(self.jobs)
        }

    async def list_tasks(self, owner_id: str, status: str = None, engine: str = None, 
                        priority: str = None, date_from: datetime = None, date_to: datetime = None,
                        limit: int = 50, offset: int = 0) -> List[TranslationTask]:
        redis = await get_redis()
        
        # 尝试从缓存获取（仅当没有筛选条件时）
        if not any([status, engine, priority, date_from, date_to]):
            cached_tasks = await redis.get_cached_user_tasks(owner_id)
            if cached_tasks is not None:
                tasks = []
                for task_dict in cached_tasks:
                    task = await self.get_task(task_dict['id'])
                    if task:
                        tasks.append(task)
                return tasks[offset:offset + limit]
        
        # 构建查询条件
        async with AsyncSessionLocal() as db:
            query = select(TranslationTask).where(TranslationTask.owner_id == owner_id)
            
            if status:
                query = query.where(TranslationTask.status == status)
            if engine:
                query = query.where(TranslationTask.engine == engine)
            if priority:
                query = query.where(TranslationTask.priority == priority)
            if date_from:
                query = query.where(TranslationTask.created_at >= date_from)
            if date_to:
                query = query.where(TranslationTask.created_at <= date_to)
            
            # 排序和分页
            query = query.order_by(TranslationTask.created_at.desc()).offset(offset).limit(limit)
            
            result = await db.execute(query)
            tasks = list(result.scalars().all())
            
            # 如果没有筛选条件，缓存结果
            if not any([status, engine, priority, date_from, date_to]):
                tasks_data = [task.to_dict() for task in tasks]
                await redis.cache_user_tasks(owner_id, tasks_data)
            
            return tasks

    async def get_task(self, task_id: str) -> Optional[TranslationTask]:
        redis = await get_redis()
        
        # 尝试从缓存获取
        cached_task = await redis.get_cached_task_details(task_id)
        if cached_task is not None:
            # 从数据库获取完整的任务对象
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(TranslationTask).where(TranslationTask.id == task_id))
                task = result.scalar_one_or_none()
                if task:
                    return task
        
        # 缓存未命中，从数据库查询
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(TranslationTask).where(TranslationTask.id == task_id))
            task = result.scalar_one_or_none()
            
            # 缓存任务详情
            if task:
                task_data = task.to_dict()
                await redis.cache_task_details(task_id, task_data)
            
            return task

    async def retry_task(self, task_id: str) -> Optional[TranslationTask]:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(TranslationTask).where(TranslationTask.id == task_id))
            task = result.scalar_one_or_none()
            if not task:
                return None
            task.status = 'queued'
            task.progress = 0
            task.error = None
            task.output_url = None
            task.completed_at = None
            await db.commit()
            await db.refresh(task)

        redis = await get_redis()
        await redis.enqueue_task(task_id, task.priority)
        self._schedule(task_id)
        return task

    async def cancel_task(self, task_id: str) -> Optional[TranslationTask]:
        self._cancel_job(task_id)
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(TranslationTask).where(TranslationTask.id == task_id))
            task = result.scalar_one_or_none()
            if task:
                task.status = 'canceled'
                task.progress = 0
                await db.commit()
                await db.refresh(task)
            return task

    async def _update_task(self, task_id: str, **updates) -> Optional[TranslationTask]:
        redis = await get_redis()
        
        # 更新数据库
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(TranslationTask).where(TranslationTask.id == task_id))
            task = result.scalar_one_or_none()
            if not task:
                return None
            
            # 保存owner_id用于缓存失效
            owner_id = task.owner_id
            
            for key, value in updates.items():
                if hasattr(task, key):
                    setattr(task, key, value)
            if task.status == 'completed':
                task.progress = 100
                task.completed_at = task.completed_at or datetime.utcnow()
            await db.commit()
            await db.refresh(task)
        
        # 失效相关缓存
        await redis.invalidate_task_details_cache(task_id)
        await redis.invalidate_user_tasks_cache(owner_id)
        await redis.set_task_status(task_id, task.status)
        
        return task

    def _schedule(self, task_id: str) -> None:
        self._cancel_job(task_id)
        
        # 检查并发限制
        if len(self.jobs) >= self.max_concurrent_tasks:
            return  # 暂时不启动，等待资源释放
        
        job = asyncio.create_task(self._lifecycle_with_semaphore(task_id))
        self.jobs[task_id] = job
        job.add_done_callback(lambda _: self.jobs.pop(task_id, None))

    async def _lifecycle_with_semaphore(self, task_id: str) -> None:
        """带并发控制的生命周期管理"""
        async with self.task_semaphore:
            await self._lifecycle(task_id)

    def _cancel_job(self, task_id: str) -> None:
        job = self.jobs.pop(task_id, None)
        if job:
            job.cancel()

    async def _lifecycle(self, task_id: str) -> None:
        import tempfile
        import os
        from .utils.babeldoc import translate_pdf
        from .config import get_settings

        try:
            # 更精确的进度跟踪
            await self._update_task(task_id, status='processing', progress=5)

            task = await self.get_task(task_id)
            if not task:
                return

            s3 = get_s3()
            settings = get_settings()

            # 创建临时目录
            temp_dir = tempfile.mkdtemp()
            input_path = os.path.join(temp_dir, 'input.pdf')
            output_dir = os.path.join(temp_dir, 'output')
            os.makedirs(output_dir, exist_ok=True)

            # 步骤1：下载和准备文件 (10%)
            if task.input_s3_key:
                response = s3.s3.get_object(Bucket=s3.bucket, Key=task.input_s3_key)
                with open(input_path, 'wb') as f:
                    f.write(response['Body'].read())
            else:
                raise Exception("输入文件不存在")

            await self._update_task(task_id, progress=15)

            # 步骤2：解析模型配置 (20%)
            model_config = json.loads(task.model_config) if task.model_config else {}
            service = task.engine if task.engine != 'babeldoc' else settings.babeldoc_service
            model = model_config.get('model') or settings.babeldoc_model or None
            threads = model_config.get('threads', settings.babeldoc_threads)

            await self._update_task(task_id, progress=25)

            # 步骤3：开始翻译 (30%)
            await self._update_task(task_id, progress=30)

            # 翻译 PDF
            success, error, output_file = await translate_pdf(
                input_path=input_path,
                output_dir=output_dir,
                service=service,
                lang_from=task.source_lang,
                lang_to=task.target_lang,
                model=model,
                threads=threads,
                model_config=model_config
            )

            if not success:
                await self._update_task(task_id, status='failed', error=error, progress=0)
                # 清理临时文件
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
                return

            # 步骤4：上传结果文件 (80-90%)
            if output_file and os.path.exists(output_file):
                with open(output_file, 'rb') as f:
                    output_data = f.read()

                # 文件上传进度
                await self._update_task(task_id, progress=85)

                output_s3_key = f"outputs/{task.owner_id}/{task_id}/output.pdf"
                s3.upload_file(output_data, output_s3_key)
                output_url = s3.get_presigned_url(output_s3_key, expiration=86400)

                # 步骤5：完成 (100%)
                await self._update_task(
                    task_id,
                    status='completed',
                    output_s3_key=output_s3_key,
                    output_url=output_url,
                    error=None,
                )
            else:
                await self._update_task(
                    task_id,
                    status='failed',
                    error="翻译完成但未找到输出文件",
                    progress=0,
                )

            # 清理临时文件
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)

        except asyncio.CancelledError:
            return
        except Exception as e:
            await self._update_task(
                task_id,
                status='failed',
                error=str(e),
                progress=0,
            )


task_manager = TaskManager()
