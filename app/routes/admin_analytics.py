from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models import User, TranslationTask
from app.schemas import (
    AnalyticsOverviewResponse,
    DailyStatsResponse,
    DailyStatsItem,
    TopUsersResponse,
    TopUserItem
)
from app.tasks import task_manager
from app.s3_client import get_s3
from app.settings_manager import get_s3_config, MissingS3Configuration

router = APIRouter(prefix="/api/admin", tags=["admin-analytics"])


# Note: Frontend expects paths under /api/admin/analytics/*
# Keep router prefix as /api/admin to preserve /api/admin/tasks below,
# and add /analytics prefix on analytics endpoints.
@router.get("/analytics/overview", response_model=AnalyticsOverviewResponse)
async def get_analytics_overview(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get today's analytics overview"""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Today's translations count
    today_translations = await db.execute(
        select(func.count(TranslationTask.id))
        .where(TranslationTask.created_at >= today_start)
    )
    translations_count = today_translations.scalar() or 0

    # Today's pages count
    today_pages = await db.execute(
        select(func.sum(TranslationTask.page_count))
        .where(and_(
            TranslationTask.created_at >= today_start,
            TranslationTask.page_count.isnot(None)
        ))
    )
    pages_count = today_pages.scalar() or 0

    # Total users
    total_users = await db.execute(select(func.count(User.id)))
    total_users_count = total_users.scalar() or 0

    # Active users (users with tasks in last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    active_users = await db.execute(
        select(func.count(func.distinct(TranslationTask.owner_id)))
        .where(TranslationTask.created_at >= week_ago)
    )
    active_users_count = active_users.scalar() or 0

    return AnalyticsOverviewResponse(
        todayTranslations=translations_count,
        todayPages=pages_count,
        totalUsers=total_users_count,
        activeUsers=active_users_count
    )


@router.get("/analytics/daily-stats", response_model=DailyStatsResponse)
async def get_daily_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    days: int = Query(default=30, ge=1, le=365)
):
    """Get daily statistics for the specified number of days"""
    start_date = datetime.utcnow() - timedelta(days=days)

    # Query tasks grouped by date
    result = await db.execute(
        select(
            func.date(TranslationTask.created_at).label('date'),
            func.count(TranslationTask.id).label('translations'),
            func.sum(TranslationTask.page_count).label('pages')
        )
        .where(TranslationTask.created_at >= start_date)
        .group_by(func.date(TranslationTask.created_at))
        .order_by(func.date(TranslationTask.created_at))
    )

    stats = []
    for row in result:
        stats.append(DailyStatsItem(
            date=row.date.isoformat(),
            translations=row.translations,
            pages=row.pages or 0
        ))

    return DailyStatsResponse(stats=stats)


@router.get("/analytics/top-users", response_model=TopUsersResponse)
async def get_top_users(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=10, ge=1, le=100),
    days: Optional[int] = Query(default=None, ge=1, le=365)
):
    """Get top users by page consumption"""
    query = select(
        TranslationTask.owner_id,
        func.count(TranslationTask.id).label('total_tasks'),
        func.sum(TranslationTask.page_count).label('total_pages')
    )

    if days:
        start_date = datetime.utcnow() - timedelta(days=days)
        query = query.where(TranslationTask.created_at >= start_date)

    query = query.group_by(TranslationTask.owner_id).order_by(func.sum(TranslationTask.page_count).desc()).limit(limit)

    result = await db.execute(query)

    users = []
    for row in result:
        # Get user details
        user_result = await db.execute(select(User).where(User.id == row.owner_id))
        user = user_result.scalar_one_or_none()

        if user:
            users.append(TopUserItem(
                userId=user.id,
                userName=user.name,
                userEmail=user.email,
                totalPages=row.total_pages or 0,
                totalTasks=row.total_tasks
            ))

    return TopUsersResponse(users=users)


@router.get("/tasks")
async def get_admin_tasks(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    owner_id: Optional[str] = Query(default=None, alias="ownerId"),
    owner_email: Optional[str] = Query(default=None, alias="ownerEmail"),
    status: Optional[str] = Query(default=None),
    engine: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None, alias="dateFrom"),
    date_to: Optional[str] = Query(default=None, alias="dateTo"),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0)
):
    """Admin: list tasks across all users.

    Defaults to returning all tasks when no owner filters are provided.
    Supports pagination via limit/offset and optional filtering by ownerId or ownerEmail.
    """
    from sqlalchemy import and_ as sa_and
    from sqlalchemy import desc
    from fastapi import HTTPException

    # Parse dates (ISO 8601 string)
    date_from_dt = None
    date_to_dt = None
    if date_from:
        try:
            date_from_dt = datetime.fromisoformat(date_from)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid dateFrom format")
    if date_to:
        try:
            date_to_dt = datetime.fromisoformat(date_to)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid dateTo format")

    # Build base query
    conditions = []
    if owner_id:
        conditions.append(TranslationTask.owner_id == owner_id)
    if owner_email:
        conditions.append(TranslationTask.owner_email == owner_email)
    if status:
        conditions.append(TranslationTask.status == status)
    if engine:
        conditions.append(TranslationTask.engine == engine)
    if priority:
        conditions.append(TranslationTask.priority == priority)
    if date_from_dt:
        conditions.append(TranslationTask.created_at >= date_from_dt)
    if date_to_dt:
        conditions.append(TranslationTask.created_at <= date_to_dt)

    base_query = select(TranslationTask)
    count_query = select(func.count(TranslationTask.id))
    if conditions:
        base_query = base_query.where(sa_and(*conditions))
        count_query = count_query.where(sa_and(*conditions))

    # Apply ordering and pagination
    base_query = base_query.order_by(desc(TranslationTask.created_at)).offset(offset).limit(limit)

    # Execute queries
    result = await db.execute(base_query)
    rows = list(result.scalars().all())
    total_result = await db.execute(count_query)
    total_count = int(total_result.scalar() or 0)

    # S3 optional on read
    try:
        s3_config = await get_s3_config(db)
        s3 = get_s3(s3_config)
    except MissingS3Configuration:
        s3 = None

    return {
        "tasks": [task.to_dict(s3) for task in rows],
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "filters": {
            "ownerId": owner_id,
            "ownerEmail": owner_email,
            "status": status,
            "engine": engine,
            "priority": priority,
            "dateFrom": date_from,
            "dateTo": date_to,
        },
    }
