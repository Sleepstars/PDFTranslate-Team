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
        self._schedule(task_id)
        return task

    async def list_tasks(self, owner_id: str) -> List[TranslationTask]:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(TranslationTask)
                .where(TranslationTask.owner_id == owner_id)
                .order_by(TranslationTask.created_at.desc())
            )
            return list(result.scalars().all())

    async def get_task(self, task_id: str) -> Optional[TranslationTask]:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(TranslationTask).where(TranslationTask.id == task_id))
            return result.scalar_one_or_none()

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
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(TranslationTask).where(TranslationTask.id == task_id))
            task = result.scalar_one_or_none()
            if not task:
                return None
            for key, value in updates.items():
                if hasattr(task, key):
                    setattr(task, key, value)
            if task.status == 'completed':
                task.progress = 100
                task.completed_at = task.completed_at or datetime.utcnow()
            await db.commit()
            await db.refresh(task)
            return task

    def _schedule(self, task_id: str) -> None:
        self._cancel_job(task_id)
        job = asyncio.create_task(self._lifecycle(task_id))
        self.jobs[task_id] = job
        job.add_done_callback(lambda _: self.jobs.pop(task_id, None))

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
            await self._update_task(task_id, status='processing', progress=10)

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

            # 下载输入文件
            if task.input_s3_key:
                response = s3.s3.get_object(Bucket=s3.bucket, Key=task.input_s3_key)
                with open(input_path, 'wb') as f:
                    f.write(response['Body'].read())
            else:
                raise Exception("输入文件不存在")

            await self._update_task(task_id, progress=30)

            # 解析模型配置
            model_config = json.loads(task.model_config) if task.model_config else {}
            service = task.engine if task.engine != 'babeldoc' else settings.babeldoc_service
            model = model_config.get('model') or settings.babeldoc_model or None
            threads = model_config.get('threads', settings.babeldoc_threads)

            await self._update_task(task_id, progress=40)

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

            await self._update_task(task_id, progress=80)

            # 上传输出文件
            if output_file and os.path.exists(output_file):
                with open(output_file, 'rb') as f:
                    output_data = f.read()

                output_s3_key = f"outputs/{task.owner_id}/{task_id}/output.pdf"
                s3.upload_file(output_data, output_s3_key)
                output_url = s3.get_presigned_url(output_s3_key, expiration=86400)

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
