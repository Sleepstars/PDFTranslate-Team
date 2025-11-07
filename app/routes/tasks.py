from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from ..config import PublicUser
from ..dependencies import get_current_user
from ..schemas import TaskActionRequest
from ..tasks import task_manager

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("")
async def list_tasks(user: PublicUser = Depends(get_current_user)):
    tasks = await task_manager.list_tasks(user.id)
    return {"tasks": [task.to_dict() for task in tasks]}


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
    user: PublicUser = Depends(get_current_user)
):
    file_data = await file.read()
    payload = {
        "documentName": documentName,
        "sourceLang": sourceLang,
        "targetLang": targetLang,
        "engine": engine,
        "priority": priority,
        "notes": notes,
        "modelConfig": modelConfig
    }
    task = await task_manager.create_task(user, payload, file_data)
    return {"task": task.to_dict()}


@router.get("/{task_id}")
async def get_task(task_id: str, user: PublicUser = Depends(get_current_user)):
    task = await task_manager.get_task(task_id)
    if not task or task.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return {"task": task.to_dict()}


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
