"""optimize indexes for better query performance

Revision ID: 003
Revises: 002
Create Date: 2025-11-08

"""
from alembic import op
import sqlalchemy as sa

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 添加复合索引优化查询性能
    
    # 优化用户任务列表查询 (owner_id + created_at)
    op.create_index(
        'ix_translation_tasks_owner_created',
        'translation_tasks',
        ['owner_id', 'created_at'],
        unique=False
    )
    
    # 优化按状态和时间查询 (status + created_at)
    op.create_index(
        'ix_translation_tasks_status_created',
        'translation_tasks',
        ['status', 'created_at'],
        unique=False
    )
    
    # 优化用户特定状态查询 (owner_id + status)
    op.create_index(
        'ix_translation_tasks_owner_status',
        'translation_tasks',
        ['owner_id', 'status'],
        unique=False
    )
    
    # 优化优先级和时间查询 (priority + created_at)
    op.create_index(
        'ix_translation_tasks_priority_created',
        'translation_tasks',
        ['priority', 'created_at'],
        unique=False
    )
    
    # 添加按邮箱查询的索引
    op.create_index(
        'ix_translation_tasks_owner_email',
        'translation_tasks',
        ['owner_email'],
        unique=False
    )
    
    # 添加引擎和状态复合索引，用于统计查询
    op.create_index(
        'ix_translation_tasks_engine_status',
        'translation_tasks',
        ['engine', 'status'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_translation_tasks_engine_status', table_name='translation_tasks')
    op.drop_index('ix_translation_tasks_owner_email', table_name='translation_tasks')
    op.drop_index('ix_translation_tasks_priority_created', table_name='translation_tasks')
    op.drop_index('ix_translation_tasks_owner_status', table_name='translation_tasks')
    op.drop_index('ix_translation_tasks_status_created', table_name='translation_tasks')
    op.drop_index('ix_translation_tasks_owner_created', table_name='translation_tasks')
