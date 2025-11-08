from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
import json
from ..config import PublicUser
from ..dependencies import get_current_user, get_current_user_from_db
from ..schemas import TaskActionRequest
from ..tasks import task_manager
from ..database import get_db
from ..models import User
from ..quota import check_quota, consume_quota, count_pdf_pages

router = APIRouter(prefix="/tasks", tags=["tasks"])


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

    payload = {
        "documentName": documentName,
        "sourceLang": sourceLang,
        "targetLang": targetLang,
        "engine": engine,
        "priority": priority,
        "notes": notes,
        "modelConfig": modelConfig,
        "providerConfigId": providerConfigId,
        "pageCount": page_count
    }

    try:
        task = await task_manager.create_task(user, payload, file_data)
        return {"task": task.to_dict()}
    except Exception as e:
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
    user: PublicUser = Depends(get_current_user)
):
    """批量创建翻译任务"""
    try:
        document_names = json.loads(documentNames)
        if len(files) != len(document_names):
            raise HTTPException(status_code=400, detail="Files count must match document names count")
        
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
                "modelConfig": modelConfig
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
            if task and task.owner_id == user.id and task.status == "completed" and task.output_url:
                valid_tasks.append(task)
            else:
                invalid_task_ids.append(task_id)
        
        if not valid_tasks:
            raise HTTPException(status_code=404, detail="No valid completed tasks found for download")
        
        # 创建ZIP打包URL（这里简化处理，实际应该生成临时ZIP文件）
        download_info = {
            "batch_id": f"batch_{int(time.time())}",
            "tasks": [task.to_dict() for task in valid_tasks],
            "download_urls": [task.output_url for task in valid_tasks],
            "invalid_task_ids": invalid_task_ids,
            "total_count": len(task_ids),
            "valid_count": len(valid_tasks),
            "invalid_count": len(invalid_task_ids)
        }
        
        return download_info
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch download failed: {str(e)}")


@router.get("/download/zip/{task_ids}")
async def download_zip_package(task_ids: str, user: PublicUser = Depends(get_current_user)):
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
        s3 = get_s3()
        
        # 创建内存中的ZIP文件
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            valid_files = 0
            
            for task_id in task_id_list:
                task = await task_manager.get_task(task_id.strip())
                if task and task.owner_id == user.id and task.status == "completed" and task.output_s3_key:
                    try:
                        # 从S3下载文件
                        response = s3.s3.get_object(Bucket=s3.bucket, Key=task.output_s3_key)
                        file_content = response['Body'].read()
                        
                        # 添加到ZIP文件，使用文档名作为文件名
                        safe_filename = f"{task.document_name.replace('/', '_').replace(' ', '_')}.pdf"
                        zip_file.writestr(safe_filename, file_content)
                        valid_files += 1
                        
                    except Exception as e:
                        print(f"Failed to add file for task {task_id}: {e}")
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
