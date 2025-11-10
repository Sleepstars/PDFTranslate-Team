import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from secrets import token_urlsafe
from typing import Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .config import PublicUser, get_settings
from .models import TranslationTask, TranslationProviderConfig
from .database import AsyncSessionLocal
from .redis_client import get_redis
from .s3_client import get_s3
from .settings_manager import get_s3_config, MissingS3Configuration
from .websocket_manager import task_ws_manager

logger = logging.getLogger(__name__)


class TaskManager:
    def __init__(self) -> None:
        self.jobs: Dict[str, asyncio.Task] = {}
        # 并发控制信号量
        self.max_concurrent_tasks = 3
        self.task_semaphore = asyncio.Semaphore(self.max_concurrent_tasks)
        # 优先级队列配置
        self.priority_weights = {"high": 3, "normal": 2, "low": 1}
        self._monitor_task: Optional[asyncio.Task] = None
        
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
                s3_config = await get_s3_config(db, strict=True)
                s3 = get_s3(s3_config)
                input_s3_key = f"uploads/{owner.id}/{task_id}/input.pdf"
                s3.upload_file(file_data, input_s3_key)

            model_config_dict = payload.get('modelConfig') or {}
            if model_config_dict and not isinstance(model_config_dict, dict):
                raise ValueError("modelConfig must be a dictionary")
            model_config_json = json.dumps(model_config_dict) if model_config_dict else None

            # Get task type, default to translation for backward compatibility
            task_type = payload.get('taskType', 'translation')

            task = TranslationTask(
                id=task_id,
                owner_id=owner.id,
                owner_email=owner.email,
                document_name=payload['documentName'],
                task_type=task_type,
                source_lang=payload.get('sourceLang', ''),
                target_lang=payload.get('targetLang', ''),
                engine=payload.get('engine', ''),
                priority=payload.get('priority', 'normal'),
                notes=payload.get('notes'),
                status='queued',
                progress=0,
                input_s3_key=input_s3_key,
                model_config=model_config_json,
                page_count=payload.get('pageCount', 0),
                provider_config_id=payload.get('providerConfigId')
            )
            db.add(task)
            await db.commit()
            await db.refresh(task)

        await task_ws_manager.send_task_update(owner.id, task.to_dict())

        redis = await get_redis()
        await redis.enqueue_task(task_id, task.priority)

        # 立即尝试开始处理
        self._schedule(task_id)

        return task

    async def start_queue_monitor(self):
        """启动队列监控任务"""
        if self._monitor_task and not self._monitor_task.done():
            return
        self._monitor_task = asyncio.create_task(self._queue_monitor_loop())

    async def _queue_monitor_loop(self):
        """队列监控循环"""
        import logging
        logger = logging.getLogger(__name__)
        logger.info("Queue monitor loop started")

        while True:
            try:
                await self._process_pending_tasks()
                await asyncio.sleep(5)  # 每5秒检查一次
            except asyncio.CancelledError:
                logger.info("Queue monitor loop cancelled")
                break
            except Exception as e:
                logger.error(f"Queue monitor error: {e}", exc_info=True)
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

    async def resume_stalled_tasks(self) -> None:
        """重启时将 processing 状态任务恢复到队列"""
        import logging
        logger = logging.getLogger(__name__)

        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(TranslationTask).where(TranslationTask.status == "processing")
                )
                stalled_tasks = result.scalars().all()

            if not stalled_tasks:
                logger.info("No stalled tasks to resume")
                return

            logger.info(f"Found {len(stalled_tasks)} stalled tasks to resume")
            redis = await get_redis()

            # 批量处理，避免逐个处理太慢
            resumed_count = 0
            failed_count = 0

            for task in stalled_tasks:
                try:
                    async with AsyncSessionLocal() as db:
                        result = await db.execute(
                            select(TranslationTask).where(TranslationTask.id == task.id)
                        )
                        current_task = result.scalar_one_or_none()
                        if not current_task:
                            continue

                        current_task.status = "queued"
                        current_task.progress = 0
                        current_task.progress_message = "系统重启自动恢复，已重新排队"
                        await db.commit()
                        await db.refresh(current_task)

                        # 缓存操作可以失败，不影响任务恢复
                        try:
                            await redis.invalidate_task_details_cache(task.id)
                            await redis.invalidate_user_tasks_cache(current_task.owner_id)
                            await redis.set_task_status(current_task.id, current_task.status)
                            await task_ws_manager.send_task_update(current_task.owner_id, current_task.to_dict())
                        except Exception as cache_error:
                            logger.warning(f"Cache/WebSocket update failed for task {task.id}: {cache_error}")

                    await redis.enqueue_task(task.id, task.priority)
                    resumed_count += 1
                    logger.debug(f"Resumed task {task.id}")

                except Exception as e:
                    failed_count += 1
                    logger.error(f"Failed to resume task {task.id}: {e}")
                    # 继续处理其他任务
                    continue

            logger.info(f"Task resumption complete: {resumed_count} resumed, {failed_count} failed")

        except Exception as e:
            logger.error(f"Critical error in resume_stalled_tasks: {e}")
            # 不抛出异常，避免阻塞应用启动
            raise

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
            task.progress_message = "等待重新处理"
            task.output_url = None
            task.output_s3_key = None
            task.mono_output_s3_key = None
            task.mono_output_url = None
            task.dual_output_s3_key = None
            task.dual_output_url = None
            task.glossary_output_s3_key = None
            task.glossary_output_url = None
            task.markdown_output_s3_key = None
            task.markdown_output_url = None
            task.translated_markdown_s3_key = None
            task.translated_markdown_url = None
            task.mineru_task_id = None
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
                task.progress_message = "任务已取消"
                await db.commit()
                await db.refresh(task)
            return task

    async def delete_task(self, task_id: str, owner_id: str) -> str:
        self._cancel_job(task_id)

        redis = await get_redis()
        await redis.remove_task_from_all_queues(task_id)

        s3_keys: list[Optional[str]] = []
        s3_client = None
        task_owner_id = owner_id
        mineru_task_id: Optional[str] = None

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(TranslationTask)
                .where(TranslationTask.id == task_id)
                .where(TranslationTask.owner_id == owner_id)
            )
            task = result.scalar_one_or_none()
            if not task:
                return "not_found"

            task_owner_id = task.owner_id
            s3_keys = [
                task.input_s3_key,
                task.output_s3_key,
                task.mono_output_s3_key,
                task.dual_output_s3_key,
                task.glossary_output_s3_key,
                task.zip_output_s3_key,
                task.markdown_output_s3_key,
                task.translated_markdown_s3_key,
            ]
            mineru_task_id = task.mineru_task_id

            try:
                s3_config = await get_s3_config(db, strict=False)
                required_fields = ("access_key", "secret_key", "bucket", "region")
                if all(s3_config.get(field) for field in required_fields):
                    s3_client = get_s3(s3_config)
            except Exception as exc:  # pragma: no cover - delete best-effort
                logger.warning("Unable to prepare S3 client for task deletion: %s", exc)
                s3_client = None

            await db.delete(task)
            await db.commit()

        if s3_client:
            unique_keys = {key for key in s3_keys if key}
            for key in unique_keys:
                try:
                    await asyncio.to_thread(s3_client.delete_file, key)
                except Exception as exc:  # pragma: no cover - delete best-effort
                    logger.warning("Failed to delete S3 object %s: %s", key, exc)

            # Also delete the task output folder to ensure all artifacts are removed
            try:
                outputs_prefix = f"outputs/{task_owner_id}/{task_id}/"
                await asyncio.to_thread(s3_client.delete_prefix, outputs_prefix)
            except Exception as exc:  # pragma: no cover - best-effort
                logger.warning("Failed to delete S3 prefix %s: %s", outputs_prefix, exc)

            # Delete MinerU mirrored images if present
            if mineru_task_id:
                try:
                    mineru_prefix = f"mineru/{mineru_task_id}/"
                    await asyncio.to_thread(s3_client.delete_prefix, mineru_prefix)
                except Exception as exc:  # pragma: no cover - best-effort
                    logger.warning("Failed to delete S3 prefix %s: %s", mineru_prefix, exc)

        await redis.invalidate_task_details_cache(task_id)
        await redis.invalidate_all_user_cache(task_owner_id)
        await redis.delete_task_status(task_id)
        return "deleted"

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
        await task_ws_manager.send_task_update(owner_id, task.to_dict())
        
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

    async def _resolve_mineru_credentials(
        self,
        preferred_provider: Optional[TranslationProviderConfig],
    ) -> tuple[str, str]:
        """
        Resolve MinerU API token and model version.

        Preference order:
        1. Selected provider_config (if MinerU and has token)
        2. Any active MinerU provider (default first)
        """
        candidates: List[TranslationProviderConfig] = []
        seen_ids: set[str] = set()

        def add_candidate(provider: Optional[TranslationProviderConfig]) -> None:
            if (
                provider
                and provider.provider_type == "mineru"
                and provider.id not in seen_ids
            ):
                seen_ids.add(provider.id)
                candidates.append(provider)

        add_candidate(preferred_provider)

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(TranslationProviderConfig)
                .where(
                    TranslationProviderConfig.provider_type == "mineru",
                    TranslationProviderConfig.is_active == True,
                )
                .order_by(
                    TranslationProviderConfig.is_default.desc(),
                    TranslationProviderConfig.created_at.asc(),
                )
            )
            for provider in result.scalars().all():
                add_candidate(provider)

        for provider in candidates:
            api_token, model_version = self._extract_mineru_settings(provider)
            if api_token:
                return api_token, model_version

        raise RuntimeError(
            "MinerU API token not configured. Please configure a MinerU provider in admin settings."
        )

    @staticmethod
    def _extract_mineru_settings(
        provider: Optional[TranslationProviderConfig],
    ) -> tuple[Optional[str], str]:
        if not provider:
            return None, "vlm"
        try:
            settings_dict = json.loads(provider.settings or "{}")
        except json.JSONDecodeError:
            logger.warning(
                "MinerU provider %s has invalid settings JSON", provider.id
            )
            return None, "vlm"

        api_token = settings_dict.get("api_token")
        model_version = settings_dict.get("model_version") or "vlm"
        return api_token, model_version

    def _cancel_job(self, task_id: str) -> None:
        job = self.jobs.pop(task_id, None)
        if job:
            job.cancel()

    async def _lifecycle(self, task_id: str) -> None:
        import tempfile
        import os
        from .utils.babeldoc import translate_pdf
        from .utils.mineru_client import parse_pdf_to_markdown
        from .utils.markdown_translator import translate_markdown

        try:
            # 更精确的进度跟踪
            await self._update_task(task_id, status='processing', progress=5)

            task = await self.get_task(task_id)
            if not task:
                return

            async with AsyncSessionLocal() as db:
                s3_config = await get_s3_config(db, strict=True)
                provider_config = None
                if task.provider_config_id:
                    result = await db.execute(
                        select(TranslationProviderConfig).where(
                            TranslationProviderConfig.id == task.provider_config_id
                        )
                    )
                    provider_config = result.scalar_one_or_none()
            s3 = get_s3(s3_config)
            settings = get_settings()

            # Route to appropriate workflow based on task type
            if task.task_type == "parsing":
                await self._lifecycle_parsing(task_id, task, s3, provider_config)
            elif task.task_type == "parse_and_translate":
                await self._lifecycle_parse_and_translate(task_id, task, s3, provider_config)
            else:  # translation (default)
                await self._lifecycle_translation(task_id, task, s3, provider_config)

        except MissingS3Configuration as exc:
            logger.error("Task %s aborted due to missing S3 config: %s", task_id, exc)
            await self._update_task(
                task_id,
                status='failed',
                error=str(exc),
                progress=0,
            )
            return
        except asyncio.CancelledError:
            logger.info("Task %s cancelled", task_id)
            return
        except Exception as e:
            logger.exception("Task %s crashed with unexpected error", task_id)
            await self._update_task(
                task_id,
                status='failed',
                error=str(e),
                progress=0,
            )

    async def _lifecycle_translation(self, task_id: str, task, s3, provider_config) -> None:
        """Original PDF translation workflow using pdf2zh-next"""
        import tempfile
        import os
        from .utils.babeldoc import translate_pdf

        settings = get_settings()

        # 创建临时目录
        temp_dir = tempfile.mkdtemp()
        input_path = os.path.join(temp_dir, 'input.pdf')
        output_dir = os.path.join(temp_dir, 'output')
        os.makedirs(output_dir, exist_ok=True)

        # 步骤1：下载和准备文件 (10%)
        if task.input_s3_key:
            def _download_input():
                response = s3.s3.get_object(Bucket=s3.bucket, Key=task.input_s3_key)
                with open(input_path, 'wb') as f:
                    f.write(response['Body'].read())

            await asyncio.to_thread(_download_input)
        else:
            raise Exception("输入文件不存在")

        await self._update_task(task_id, progress=15)

        # 步骤2：解析模型配置 (20%)
        provider_settings = {}
        provider_service = None
        if task.provider_config_id:
            if not provider_config:
                raise RuntimeError("选择的翻译服务不存在或已被删除，请重新配置。")
            if not provider_config.is_active:
                raise RuntimeError("选择的翻译服务已被禁用，请联系管理员或更换服务。")
            try:
                provider_settings = json.loads(provider_config.settings or "{}") or {}
            except json.JSONDecodeError:
                logger.error(
                    "Invalid provider settings JSON for provider %s",
                    provider_config.id,
                )
                provider_settings = {}
            if not isinstance(provider_settings, dict):
                provider_settings = {}
            provider_service = provider_config.provider_type

        task_model_config = {}
        if task.model_config:
            try:
                task_model_config = json.loads(task.model_config) or {}
            except json.JSONDecodeError:
                logger.warning("Task %s has invalid model_config, ignoring overrides.", task_id)
                task_model_config = {}
            if not isinstance(task_model_config, dict):
                task_model_config = {}

        model_config = {**provider_settings, **task_model_config}
        service = provider_service or (task.engine if task.engine != 'babeldoc' else settings.babeldoc_service)
        model = model_config.get('model') or settings.babeldoc_model or None
        try:
            threads = int(model_config.get('threads', settings.babeldoc_threads))
        except (TypeError, ValueError):
            threads = settings.babeldoc_threads

        await self._update_task(task_id, progress=25)

        # 步骤3：开始翻译 (30%)
        await self._update_task(task_id, progress=30, progress_message="准备翻译…")

        last_progress = 30
        last_message = None

        async def handle_progress(event: dict) -> None:
            nonlocal last_progress, last_message
            overall = event.get("overall_progress") or 0
            try:
                overall_value = max(0.0, min(100.0, float(overall)))
            except (TypeError, ValueError):
                overall_value = 0.0
            target_progress = 30 + int(50 * (overall_value / 100))
            stage = (event.get("stage") or "").strip() or "翻译中"
            part_index = event.get("part_index")
            total_parts = event.get("total_parts")
            stage_current = event.get("stage_current")
            stage_total = event.get("stage_total")
            segments = [stage]
            if part_index and total_parts:
                segments.append(f"Part {part_index}/{total_parts}")
            if stage_current and stage_total:
                segments.append(f"{stage_current}/{stage_total}")
            message = " · ".join(seg for seg in segments if seg)
            if target_progress <= last_progress and message == last_message:
                return
            last_progress = max(last_progress, target_progress)
            last_message = message
            await self._update_task(
                task_id,
                progress=last_progress,
                progress_message=message,
            )

        success, error, result_files = await translate_pdf(
            input_path=input_path,
            output_dir=output_dir,
            service=service,
            lang_from=task.source_lang,
            lang_to=task.target_lang,
            model=model,
            threads=threads,
            model_config=model_config,
            progress_callback=handle_progress,
        )

        if not success:
            logger.error("Task %s translation failed: %s", task_id, error)
            await self._update_task(
                task_id,
                status='failed',
                error=error,
                progress=0,
                progress_message=error,
            )
            # 清理临时文件
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
            return

        await self._update_task(
            task_id,
            progress=80,
            progress_message="翻译完成，准备上传结果…",
        )

        async def upload_variant(kind: str, local_path: Optional[str], content_type: str = "application/pdf"):
            if not local_path or not os.path.exists(local_path):
                return None, None
            file_path = Path(local_path)
            key_name = f"{kind}_{file_path.name}"
            s3_key = f"outputs/{task.owner_id}/{task_id}/{key_name}"

            def _read_bytes() -> bytes:
                with open(file_path, 'rb') as fp:
                    return fp.read()

            file_bytes = await asyncio.to_thread(_read_bytes)
            await asyncio.to_thread(s3.upload_file, file_bytes, s3_key, content_type)
            url = s3.get_presigned_url(s3_key, expiration=86400)
            return s3_key, url

        mono_key, mono_url = await upload_variant("mono", result_files.get("mono"))
        dual_key, dual_url = await upload_variant("dual", result_files.get("dual"))
        glossary_key, glossary_url = await upload_variant(
            "glossary",
            result_files.get("glossary"),
            content_type="text/csv",
        )

        if not any([mono_key, dual_key]):
            logger.error("Task %s finished without output file", task_id)
            await self._update_task(
                task_id,
                status='failed',
                error="翻译完成但未找到输出文件",
                progress=0,
                progress_message="翻译完成但未找到输出文件",
            )
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
            return

        await self._update_task(
            task_id,
            progress=85,
            progress_message="结果上传完成",
        )

        primary_key = dual_key or mono_key
        primary_url = dual_url or mono_url

        await self._update_task(
            task_id,
            status='completed',
            output_s3_key=primary_key,
            output_url=primary_url,
            mono_output_s3_key=mono_key,
            mono_output_url=mono_url,
            dual_output_s3_key=dual_key,
            dual_output_url=dual_url,
            glossary_output_s3_key=glossary_key,
            glossary_output_url=glossary_url,
            error=None,
            progress_message="翻译完成",
        )

        # 清理临时文件
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

    async def _lifecycle_parsing(self, task_id: str, task, s3, provider_config) -> None:
        """MinerU PDF parsing workflow (no translation)"""
        # Get PDF public URL from S3
        if not task.input_s3_key:
            raise Exception("输入文件不存在")

        pdf_url = s3.get_presigned_url(task.input_s3_key, expiration=3600)

        await self._update_task(task_id, progress=10, progress_message="准备解析PDF...")

        mineru_api_token, mineru_model_version = await self._resolve_mineru_credentials(
            provider_config
        )

        # Progress callback
        async def handle_progress(event: dict) -> None:
            progress = event.get("overall_progress", 0)
            stage = event.get("stage", "解析中")
            mineru_task_id = event.get("mineru_task_id")

            updates = {
                "progress": int(progress),
                "progress_message": stage
            }
            if mineru_task_id:
                updates["mineru_task_id"] = mineru_task_id

            await self._update_task(task_id, **updates)

        # Parse PDF with MinerU
        from .utils.mineru_client import parse_pdf_to_markdown
        success, error, markdown_content, zip_bytes = await parse_pdf_to_markdown(
            pdf_url=pdf_url,
            api_token=mineru_api_token,
            model_version=mineru_model_version,
            progress_callback=handle_progress,
            s3_client=s3
        )

        if not success:
            logger.error("Task %s parsing failed: %s", task_id, error)
            await self._update_task(
                task_id,
                status='failed',
                error=error,
                progress=0,
                progress_message=error,
            )
            return

        # Upload markdown and ZIP to S3
        await self._update_task(task_id, progress=90, progress_message="上传结果...")

        markdown_s3_key = f"outputs/{task.owner_id}/{task_id}/output.md"
        markdown_bytes = markdown_content.encode('utf-8')
        await asyncio.to_thread(s3.upload_file, markdown_bytes, markdown_s3_key, "text/markdown")
        markdown_url = s3.get_presigned_url(markdown_s3_key, expiration=86400)

        zip_s3_key = None
        zip_url = None
        if zip_bytes:
            zip_s3_key = f"outputs/{task.owner_id}/{task_id}/output.zip"
            await asyncio.to_thread(s3.upload_file, zip_bytes, zip_s3_key, "application/zip")
            zip_url = s3.get_presigned_url(zip_s3_key, expiration=86400)

        await self._update_task(
            task_id,
            status='completed',
            markdown_output_s3_key=markdown_s3_key,
            markdown_output_url=markdown_url,
            zip_output_s3_key=zip_s3_key,
            zip_output_url=zip_url,
            error=None,
            progress_message="解析完成",
        )

    async def _lifecycle_parse_and_translate(self, task_id: str, task, s3, provider_config) -> None:
        """MinerU PDF parsing + markdown translation workflow"""
        # Step 1: Parse PDF with MinerU (similar to parsing workflow)
        if not task.input_s3_key:
            raise Exception("输入文件不存在")

        pdf_url = s3.get_presigned_url(task.input_s3_key, expiration=3600)

        await self._update_task(task_id, progress=5, progress_message="准备解析PDF...")

        mineru_api_token, mineru_model_version = await self._resolve_mineru_credentials(
            provider_config if provider_config and provider_config.provider_type == "mineru" else None
        )

        # Progress callback for parsing (0-50%)
        async def handle_parse_progress(event: dict) -> None:
            progress = event.get("overall_progress", 0)
            stage = event.get("stage", "解析中")
            mineru_task_id = event.get("mineru_task_id")

            # Map 0-100% to 5-50%
            mapped_progress = 5 + int(progress * 0.45)

            updates = {
                "progress": mapped_progress,
                "progress_message": f"步骤1: {stage}"
            }
            if mineru_task_id:
                updates["mineru_task_id"] = mineru_task_id

            await self._update_task(task_id, **updates)

        # Parse PDF
        from .utils.mineru_client import parse_pdf_to_markdown
        success, error, markdown_content, zip_bytes = await parse_pdf_to_markdown(
            pdf_url=pdf_url,
            api_token=mineru_api_token,
            model_version=mineru_model_version,
            progress_callback=handle_parse_progress,
            s3_client=s3
        )

        if not success:
            logger.error("Task %s parsing failed: %s", task_id, error)
            await self._update_task(
                task_id,
                status='failed',
                error=error,
                progress=0,
                progress_message=error,
            )
            return

        # Upload original markdown and ZIP
        await self._update_task(task_id, progress=50, progress_message="上传原始结果...")

        if zip_bytes:
            zip_s3_key = f"outputs/{task.owner_id}/{task_id}/original.zip"
            await asyncio.to_thread(s3.upload_file, zip_bytes, zip_s3_key, "application/zip")
            zip_url = s3.get_presigned_url(zip_s3_key, expiration=86400)
            await self._update_task(task_id, zip_output_s3_key=zip_s3_key, zip_output_url=zip_url)
        markdown_s3_key = f"outputs/{task.owner_id}/{task_id}/original.md"
        markdown_bytes = markdown_content.encode('utf-8')
        await asyncio.to_thread(s3.upload_file, markdown_bytes, markdown_s3_key, "text/markdown")
        markdown_url = s3.get_presigned_url(markdown_s3_key, expiration=86400)

        # Step 2: Translate markdown (50-90%)
        await self._update_task(task_id, progress=55, progress_message="准备翻译Markdown...")

        # Get translation provider settings
        provider_settings = {}
        if provider_config:
            try:
                provider_settings = json.loads(provider_config.settings or "{}") or {}
            except json.JSONDecodeError:
                provider_settings = {}

        task_model_config = {}
        if task.model_config:
            try:
                task_model_config = json.loads(task.model_config) or {}
            except json.JSONDecodeError:
                task_model_config = {}

        model_config = {**provider_settings, **task_model_config}
        service = task.engine or "google"

        # Progress callback for translation (50-90%)
        async def handle_translate_progress(event: dict) -> None:
            progress = event.get("overall_progress", 0)
            stage = event.get("stage", "翻译中")

            # Map 0-100% to 55-90%
            mapped_progress = 55 + int(progress * 0.35)

            await self._update_task(
                task_id,
                progress=mapped_progress,
                progress_message=f"步骤2: {stage}"
            )

        # Translate markdown
        from .utils.markdown_translator import translate_markdown
        success, error, translated_markdown = await translate_markdown(
            markdown_content=markdown_content,
            service=service,
            lang_from=task.source_lang,
            lang_to=task.target_lang,
            model_config=model_config,
            progress_callback=handle_translate_progress
        )

        if not success:
            logger.error("Task %s markdown translation failed: %s", task_id, error)
            await self._update_task(
                task_id,
                status='failed',
                error=error,
                progress=0,
                progress_message=error,
            )
            return

        # Upload translated markdown
        await self._update_task(task_id, progress=90, progress_message="上传翻译后的Markdown...")
        translated_s3_key = f"outputs/{task.owner_id}/{task_id}/translated.md"
        translated_bytes = translated_markdown.encode('utf-8')
        await asyncio.to_thread(s3.upload_file, translated_bytes, translated_s3_key, "text/markdown")
        translated_url = s3.get_presigned_url(translated_s3_key, expiration=86400)

        await self._update_task(
            task_id,
            status='completed',
            markdown_output_s3_key=markdown_s3_key,
            markdown_output_url=markdown_url,
            translated_markdown_s3_key=translated_s3_key,
            translated_markdown_url=translated_url,
            error=None,
            progress_message="解析和翻译完成",
        )


task_manager = TaskManager()
