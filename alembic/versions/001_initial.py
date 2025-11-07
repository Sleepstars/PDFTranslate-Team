"""initial migration

Revision ID: 001
Revises:
Create Date: 2025-01-07

"""
from alembic import op
import sqlalchemy as sa

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('users',
    sa.Column('id', sa.String(length=50), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    op.create_table('translation_tasks',
    sa.Column('id', sa.String(length=50), nullable=False),
    sa.Column('owner_id', sa.String(length=50), nullable=False),
    sa.Column('owner_email', sa.String(length=255), nullable=False),
    sa.Column('document_name', sa.String(length=500), nullable=False),
    sa.Column('source_lang', sa.String(length=10), nullable=False),
    sa.Column('target_lang', sa.String(length=10), nullable=False),
    sa.Column('engine', sa.String(length=50), nullable=False),
    sa.Column('priority', sa.String(length=20), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('progress', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.Column('input_s3_key', sa.String(length=500), nullable=True),
    sa.Column('output_s3_key', sa.String(length=500), nullable=True),
    sa.Column('output_url', sa.String(length=1000), nullable=True),
    sa.Column('error', sa.Text(), nullable=True),
    sa.Column('model_config', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_translation_tasks_owner_id'), 'translation_tasks', ['owner_id'], unique=False)
    op.create_index(op.f('ix_translation_tasks_status'), 'translation_tasks', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_translation_tasks_status'), table_name='translation_tasks')
    op.drop_index(op.f('ix_translation_tasks_owner_id'), table_name='translation_tasks')
    op.drop_table('translation_tasks')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
