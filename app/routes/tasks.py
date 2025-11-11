from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, WebSocket, WebSocketDisconnect, Response
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
import json
import time
from pathlib import Path
from ..config import PublicUser
from ..dependencies import get_current_user, get_current_user_from_db
from ..schemas import TaskActionRequest
from ..tasks import task_manager
from ..database import get_db
from ..models import User
from ..quota import check_quota, consume_quota, count_pdf_pages
from ..access import assert_provider_access
from ..auth import get_session
from ..config import get_settings
from ..websocket_manager import task_ws_manager
from ..s3_client import get_s3
from ..settings_manager import get_s3_config, MissingS3Configuration

router = APIRouter(prefix="/tasks", tags=["tasks"])
settings = get_settings()


def _parse_model_config_field(raw: str):
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="modelConfig must be valid JSON")
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="modelConfig must be a JSON object")
    return data


@router.get("")
async def list_tasks(
    status: str = None,
    engine: str = None,
    priority: str = None,
    date_from: str = None,
    date_to: str = None,
    limit: int = 50,
    offset: int = 0,
    user: PublicUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取任务列表，支持筛选和分页"""
    from datetime import datetime

    # 解析日期参数
    date_from_dt = None
    date_to_dt = None

    if date_from:
        try:
            date_from_dt = datetime.fromisoformat(date_from)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_from format. Use ISO format (YYYY-MM-DDTHH:MM:SS)")

    if date_to:
        try:
            date_to_dt = datetime.fromisoformat(date_to)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_to format. Use ISO format (YYYY-MM-DDTHH:MM:SS)")

    tasks = await task_manager.list_tasks(
        owner_id=user.id,
        status=status,
        engine=engine,
        priority=priority,
        date_from=date_from_dt,
        date_to=date_to_dt,
        limit=limit,
        offset=offset
    )

    try:
        s3_config = await get_s3_config(db)
        s3 = get_s3(s3_config)
    except MissingS3Configuration:
        s3 = None

    return {
        "tasks": [task.to_dict(s3) for task in tasks],
        "total": len(tasks),
        "limit": limit,
        "offset": offset,
        "filters": {
            "status": status,
            "engine": engine,
            "priority": priority,
            "date_from": date_from,
            "date_to": date_to
        }
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_task(
    file: UploadFile = File(...),
    documentName: str = Form(...),
    taskType: str = Form("translation"),  # New field: translation, parsing, parse_and_translate
    sourceLang: str = Form(None),  # Optional for parsing-only tasks
    targetLang: str = Form(None),  # Optional for parsing-only tasks
    engine: str = Form(None),  # Optional for parsing-only tasks
    priority: str = Form("normal"),
    notes: str = Form(None),
    modelConfig: str = Form(None),
    providerConfigId: str = Form(None),
    user_obj: User = Depends(get_current_user_from_db),
    db: AsyncSession = Depends(get_db)
):
    # Validate taskType
    if taskType not in ["translation", "parsing", "parse_and_translate"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid taskType. Must be one of: translation, parsing, parse_and_translate"
        )

    # Validate required fields based on task type
    if taskType == "translation":
        if not all([sourceLang, targetLang, engine]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="sourceLang, targetLang, and engine are required for translation tasks"
            )
    elif taskType == "parse_and_translate":
        if not all([sourceLang, targetLang, engine]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="sourceLang, targetLang, and engine are required for parse_and_translate tasks"
            )

    # Enforce provider access by task type
    await assert_provider_access(user_obj, providerConfigId, taskType, db)

    # Read file and count pages
    file_data = await file.read()
    page_count = count_pdf_pages(file_data)

    # Check quota
    has_quota, error_msg = await check_quota(user_obj, page_count, db)
    if not has_quota:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_msg
        )

    # Consume quota
    await consume_quota(user_obj, page_count, db)

    # Create PublicUser for task manager
    from ..config import PublicUser
    user = PublicUser(id=user_obj.id, name=user_obj.name, email=user_obj.email)

    model_config_dict = _parse_model_config_field(modelConfig) if modelConfig else {}

    payload = {
        "documentName": documentName,
        "taskType": taskType,
        "sourceLang": sourceLang or "",
        "targetLang": targetLang or "",
        "engine": engine or "",
        "priority": priority,
        "notes": notes,
        "modelConfig": model_config_dict,
        "providerConfigId": providerConfigId,
        "pageCount": page_count
    }

    try:
        task = await task_manager.create_task(user, payload, file_data)
        try:
            s3_config = await get_s3_config(db)
            s3 = get_s3(s3_config)
        except MissingS3Configuration:
            s3 = None
        return {"task": task.to_dict(s3)}
    except MissingS3Configuration as exc:
        from ..quota import refund_quota
        await refund_quota(user_obj, page_count, db)
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        # Refund quota if task creation fails
        from ..quota import refund_quota
        await refund_quota(user_obj, page_count, db)
        raise


@router.get("/{task_id}")
async def get_task(task_id: str, user: PublicUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = await task_manager.get_task(task_id)
    if not task or task.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    try:
        s3_config = await get_s3_config(db)
        s3 = get_s3(s3_config)
    except MissingS3Configuration:
        s3 = None

    return {"task": task.to_dict(s3)}


@router.post("/batch", status_code=status.HTTP_201_CREATED)
async def create_batch_tasks(
    files: List[UploadFile] = File(...),
    documentNames: str = Form(...),
    # Support multiple task types like single create API
    taskType: str = Form("translation"),  # translation | parsing | parse_and_translate
    sourceLang: str = Form(None),  # Optional for parsing-only tasks
    targetLang: str = Form(None),  # Optional for parsing-only tasks
    engine: str = Form(None),      # Optional for parsing-only tasks
    priority: str = Form("normal"),
    notes: str = Form(None),
    modelConfig: str = Form(None),
    providerConfigId: str = Form(None),
    user_obj: User = Depends(get_current_user_from_db),
    db: AsyncSession = Depends(get_db)
):
    """批量创建任务（翻译/解析/解析后翻译）"""
    from fastapi import HTTPException
    try:
        # Validate taskType
        if taskType not in ["translation", "parsing", "parse_and_translate"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid taskType. Must be one of: translation, parsing, parse_and_translate",
            )

        # Validate required fields based on task type
        if taskType in ("translation", "parse_and_translate"):
            if not all([sourceLang, targetLang, engine]):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="sourceLang, targetLang, and engine are required for translation or parse_and_translate",
                )

        # Enforce provider access by task type
        await assert_provider_access(user_obj, providerConfigId, taskType, db)

        document_names = json.loads(documentNames)
        if len(files) != len(document_names):
            raise HTTPException(status_code=400, detail="Files count must match document names count")

        model_config_dict = _parse_model_config_field(modelConfig) if modelConfig else {}

        # 预先计算所有文件的页数
        file_page_counts = []
        total_pages = 0

        for i, file in enumerate(files):
            file_data = await file.read()
            page_count = count_pdf_pages(file_data)
            file_page_counts.append((file_data, page_count))
            total_pages += page_count

        # 检查总配额是否足够
        has_quota, error_msg = await check_quota(user_obj, total_pages, db)
        if not has_quota:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg
            )

        # 消耗总配额
        await consume_quota(user_obj, total_pages, db)

        # 创建PublicUser用于task manager
        from ..config import PublicUser
        user = PublicUser(id=user_obj.id, name=user_obj.name, email=user_obj.email)

        tasks = []
        try:
            s3_config = await get_s3_config(db)
            s3 = get_s3(s3_config)
        except MissingS3Configuration:
            s3 = None

        try:
            for i, (file_data, page_count) in enumerate(file_page_counts):
                payload = {
                    "documentName": document_names[i],
                    "taskType": taskType,
                    "sourceLang": sourceLang or "",
                    "targetLang": targetLang or "",
                    "engine": engine or "",
                    "priority": priority,
                    "notes": notes,
                    "modelConfig": model_config_dict,
                    "providerConfigId": providerConfigId,
                    "pageCount": page_count,
                }
                task = await task_manager.create_task(user, payload, file_data)
                tasks.append(task.to_dict(s3))

            return {"tasks": tasks, "count": len(tasks)}

        except Exception as e:
            # 如果任务创建失败，回滚配额
            from ..quota import refund_quota
            await refund_quota(user_obj, total_pages, db)
            # 保持错误信息
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=f"Batch creation failed: {str(e)}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid document names JSON")
    except HTTPException:
        # 保持已定义的HTTP错误码
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch creation failed: {str(e)}")


@router.get("/batch/{batch_id}/status")
async def get_batch_status(batch_id: str, user: PublicUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """获取批量任务状态"""
    # 这里可以扩展为按批次ID查询
    # 目前返回用户的任务列表
    tasks = await task_manager.list_tasks(user.id)

    try:
        s3_config = await get_s3_config(db)
        s3 = get_s3(s3_config)
    except MissingS3Configuration:
        s3 = None

    return {"tasks": [task.to_dict(s3) for task in tasks]}


@router.get("/stats/overview")
async def get_task_stats(user: PublicUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """获取任务统计信息"""
    tasks = await task_manager.list_tasks(user.id)

    stats = {
        "total": len(tasks),
        "by_status": {},
        "by_engine": {},
        "by_priority": {},
        "recent_activity": []
    }

    # 统计按状态
    for task in tasks:
        status = task.status
        stats["by_status"][status] = stats["by_status"].get(status, 0) + 1

        # 统计按引擎
        engine = task.engine
        stats["by_engine"][engine] = stats["by_engine"].get(engine, 0) + 1

        # 统计按优先级
        priority = task.priority
        stats["by_priority"][priority] = stats["by_priority"].get(priority, 0) + 1

    try:
        s3_config = await get_s3_config(db)
        s3 = get_s3(s3_config)
    except MissingS3Configuration:
        s3 = None

    # 最近活动（最近10个任务）
    recent_tasks = sorted(tasks, key=lambda x: x.updated_at, reverse=True)[:10]
    stats["recent_activity"] = [task.to_dict(s3) for task in recent_tasks]

    return stats


@router.post("/download/batch")
async def download_batch_tasks(
    task_ids: List[str],
    user: PublicUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """批量下载翻译结果"""
    try:
        # 验证任务所有权
        valid_tasks = []
        invalid_task_ids = []

        for task_id in task_ids:
            task = await task_manager.get_task(task_id)
            has_outputs = (
                task
                and task.owner_id == user.id
                and task.status == "completed"
                and (
                    task.dual_output_url
                    or task.mono_output_url
                    or task.output_url
                )
            )
            if has_outputs:
                valid_tasks.append(task)
            else:
                invalid_task_ids.append(task_id)

        if not valid_tasks:
            raise HTTPException(status_code=404, detail="No valid completed tasks found for download")

        try:
            s3_config = await get_s3_config(db)
            s3 = get_s3(s3_config)
        except MissingS3Configuration:
            s3 = None

        # 创建ZIP打包URL（这里简化处理，实际应该生成临时ZIP文件）
        download_info = {
            "batch_id": f"batch_{int(time.time())}",
            "tasks": [task.to_dict(s3) for task in valid_tasks],
            "download_urls": [
                task.dual_output_url or task.mono_output_url or task.output_url
                for task in valid_tasks
            ],
            "results": [
                {
                    "taskId": task.id,
                    "documentName": task.document_name,
                    "dual": task.dual_output_url,
                    "mono": task.mono_output_url,
                    "glossary": task.glossary_output_url,
                }
                for task in valid_tasks
            ],
            "invalid_task_ids": invalid_task_ids,
            "total_count": len(task_ids),
            "valid_count": len(valid_tasks),
            "invalid_count": len(invalid_task_ids)
        }
        
        return download_info
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch download failed: {str(e)}")


@router.get("/download/zip/{task_ids}")
async def download_zip_package(
    task_ids: str,
    user: PublicUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """下载ZIP打包的翻译结果"""
    import zipfile
    import tempfile
    import os
    from fastapi.responses import StreamingResponse
    import io
    import time
    
    try:
        # 解析任务ID列表
        task_id_list = task_ids.split(",")
        
        # 获取S3客户端
        s3_config = await get_s3_config(db, strict=True)
        s3 = get_s3(s3_config)
        
        # 创建内存中的ZIP文件
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            valid_files = 0
            
            for task_id in task_id_list:
                task = await task_manager.get_task(task_id.strip())
                if not task or task.owner_id != user.id or task.status != "completed":
                    continue

                variants = []
                if task.dual_output_s3_key:
                    variants.append(("dual", task.dual_output_s3_key, "application/pdf", ".pdf"))
                if task.mono_output_s3_key and task.mono_output_s3_key != task.dual_output_s3_key:
                    variants.append(("mono", task.mono_output_s3_key, "application/pdf", ".pdf"))
                if not variants and task.output_s3_key:
                    variants.append(("result", task.output_s3_key, "application/pdf", ".pdf"))
                if task.glossary_output_s3_key:
                    variants.append(("glossary", task.glossary_output_s3_key, "text/csv", ".csv"))

                if not variants:
                    continue

                base_name = task.document_name.replace('/', '_').replace(' ', '_') or task.id

                for variant_name, key, _, default_suffix in variants:
                    try:
                        response = s3.s3.get_object(Bucket=s3.bucket, Key=key)
                        file_content = response['Body'].read()
                        suffix = Path(key).suffix or default_suffix
                        safe_filename = f"{base_name}_{variant_name}{suffix}"
                        zip_file.writestr(safe_filename, file_content)
                        valid_files += 1
                    except Exception as e:
                        print(f"Failed to add file for task {task_id} ({variant_name}): {e}")
                        continue
            
            if valid_files == 0:
                raise HTTPException(status_code=404, detail="No valid files found for download")
        
        # 重置缓冲区位置
        zip_buffer.seek(0)
        
        # 返回ZIP文件
        filename = f"translation_results_{int(time.time())}.zip"
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except MissingS3Configuration as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ZIP download failed: {str(e)}")


@router.get("/concurrent/status")
async def get_concurrent_status(user: PublicUser = Depends(get_current_user)):
    """获取并发处理状态"""
    return task_manager.get_concurrent_status()


@router.patch("/{task_id}")
async def mutate_task(task_id: str, payload: TaskActionRequest, user: PublicUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = await task_manager.get_task(task_id)
    if not task or task.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    try:
        s3_config = await get_s3_config(db)
        s3 = get_s3(s3_config)
    except MissingS3Configuration:
        s3 = None

    if payload.action == 'cancel':
        updated = await task_manager.cancel_task(task_id)
        return {"task": updated.to_dict(s3) if updated else task.to_dict(s3)}

    rerun = await task_manager.retry_task(task_id)
    if not rerun:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return {"task": rerun.to_dict(s3)}


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: str, user: PublicUser = Depends(get_current_user)):
    result = await task_manager.delete_task(task_id, user.id)
    if result == "not_found":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.websocket("/ws")
async def task_updates(websocket: WebSocket):
    token = websocket.cookies.get(settings.session_cookie_name) or websocket.query_params.get("token")
    session = await get_session(token)
    if not session:
        await websocket.close(code=1008)
        return

    await task_ws_manager.connect(session.id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await task_ws_manager.disconnect(session.id, websocket)
