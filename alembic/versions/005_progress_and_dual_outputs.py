"""add detailed progress and dual output columns

Revision ID: 005
Revises: 004
Create Date: 2025-11-09
"""

from alembic import op
import sqlalchemy as sa


revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "translation_tasks",
        sa.Column("progress_message", sa.Text(), nullable=True),
    )
    op.add_column(
        "translation_tasks",
        sa.Column("mono_output_s3_key", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "translation_tasks",
        sa.Column("mono_output_url", sa.String(length=1000), nullable=True),
    )
    op.add_column(
        "translation_tasks",
        sa.Column("dual_output_s3_key", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "translation_tasks",
        sa.Column("dual_output_url", sa.String(length=1000), nullable=True),
    )
    op.add_column(
        "translation_tasks",
        sa.Column("glossary_output_s3_key", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "translation_tasks",
        sa.Column("glossary_output_url", sa.String(length=1000), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("translation_tasks", "glossary_output_url")
    op.drop_column("translation_tasks", "glossary_output_s3_key")
    op.drop_column("translation_tasks", "dual_output_url")
    op.drop_column("translation_tasks", "dual_output_s3_key")
    op.drop_column("translation_tasks", "mono_output_url")
    op.drop_column("translation_tasks", "mono_output_s3_key")
    op.drop_column("translation_tasks", "progress_message")
