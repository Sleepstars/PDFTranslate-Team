from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, WebSocket, WebSocketDisconnect
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
    user: PublicUser = Depends(get_current_user)
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
    
    return {
        "tasks": [task.to_dict() for task in tasks],
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
    sourceLang: str = Form(...),
    targetLang: str = Form(...),
    engine: str = Form(...),
    priority: str = Form("normal"),
    notes: str = Form(None),
    modelConfig: str = Form(None),
    providerConfigId: str = Form(None),
    user_obj: User = Depends(get_current_user_from_db),
    db: AsyncSession = Depends(get_db)
):
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
        "sourceLang": sourceLang,
        "targetLang": targetLang,
        "engine": engine,
        "priority": priority,
        "notes": notes,
        "modelConfig": model_config_dict,
        "providerConfigId": providerConfigId,
        "pageCount": page_count
    }

    try:
        task = await task_manager.create_task(user, payload, file_data)
        return {"task": task.to_dict()}
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
async def get_task(task_id: str, user: PublicUser = Depends(get_current_user)):
    task = await task_manager.get_task(task_id)
    if not task or task.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return {"task": task.to_dict()}


@router.post("/batch")
async def create_batch_tasks(
    files: List[UploadFile] = File(...),
    documentNames: str = Form(...),
    sourceLang: str = Form(...),
    targetLang: str = Form(...),
    engine: str = Form(...),
    priority: str = Form("normal"),
    notes: str = Form(None),
    modelConfig: str = Form(None),
    providerConfigId: str = Form(None),
    user: PublicUser = Depends(get_current_user)
):
    """批量创建翻译任务"""
    try:
        document_names = json.loads(documentNames)
        if len(files) != len(document_names):
            raise HTTPException(status_code=400, detail="Files count must match document names count")
        
        model_config_dict = _parse_model_config_field(modelConfig) if modelConfig else {}

        tasks = []
        for i, file in enumerate(files):
            file_data = await file.read()
            payload = {
                "documentName": document_names[i],
                "sourceLang": sourceLang,
                "targetLang": targetLang,
                "engine": engine,
                "priority": priority,
                "notes": notes,
                "modelConfig": model_config_dict,
                "providerConfigId": providerConfigId,
            }
            task = await task_manager.create_task(user, payload, file_data)
            tasks.append(task.to_dict())
        
        return {"tasks": tasks, "count": len(tasks)}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid document names JSON")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch creation failed: {str(e)}")


@router.get("/batch/{batch_id}/status")
async def get_batch_status(batch_id: str, user: PublicUser = Depends(get_current_user)):
    """获取批量任务状态"""
    # 这里可以扩展为按批次ID查询
    # 目前返回用户的任务列表
    tasks = await task_manager.list_tasks(user.id)
    return {"tasks": [task.to_dict() for task in tasks]}


@router.get("/stats/overview")
async def get_task_stats(user: PublicUser = Depends(get_current_user)):
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
    
    # 最近活动（最近10个任务）
    recent_tasks = sorted(tasks, key=lambda x: x.updated_at, reverse=True)[:10]
    stats["recent_activity"] = [task.to_dict() for task in recent_tasks]
    
    return stats


@router.post("/download/batch")
async def download_batch_tasks(
    task_ids: List[str],
    user: PublicUser = Depends(get_current_user)
):
    """批量下载翻译结果"""
    try:
        redis = await get_redis()
        
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
        
        # 创建ZIP打包URL（这里简化处理，实际应该生成临时ZIP文件）
        download_info = {
            "batch_id": f"batch_{int(time.time())}",
            "tasks": [task.to_dict() for task in valid_tasks],
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
async def mutate_task(task_id: str, payload: TaskActionRequest, user: PublicUser = Depends(get_current_user)):
    task = await task_manager.get_task(task_id)
    if not task or task.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if payload.action == 'cancel':
        updated = await task_manager.cancel_task(task_id)
        return {"task": updated.to_dict() if updated else task.to_dict()}

    rerun = await task_manager.retry_task(task_id)
    if not rerun:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return {"task": rerun.to_dict()}


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
