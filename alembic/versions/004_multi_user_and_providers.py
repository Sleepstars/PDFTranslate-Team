"""multi user roles and provider configs

Revision ID: 004
Revises: 003
Create Date: 2025-11-08

"""

from alembic import op
import sqlalchemy as sa


revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(length=20), nullable=False, server_default="user"))
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("users", sa.Column("daily_page_limit", sa.Integer(), nullable=False, server_default="50"))
    op.add_column("users", sa.Column("daily_page_used", sa.Integer(), nullable=False, server_default="0"))
    op.add_column(
        "users",
        sa.Column(
            "last_quota_reset",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    op.create_table(
        "translation_provider_configs",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("provider_type", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("settings", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_translation_provider_configs_provider_type"),
        "translation_provider_configs",
        ["provider_type"],
        unique=False,
    )

    op.add_column("translation_tasks", sa.Column("page_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column(
        "translation_tasks",
        sa.Column("provider_config_id", sa.String(length=50), nullable=True),
    )
    op.create_foreign_key(
        "fk_translation_tasks_provider",
        "translation_tasks",
        "translation_provider_configs",
        ["provider_config_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "user_provider_access",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("user_id", sa.String(length=50), nullable=False),
        sa.Column("provider_config_id", sa.String(length=50), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["provider_config_id"], ["translation_provider_configs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_provider_access_user_id"), "user_provider_access", ["user_id"], unique=False)
    op.create_index(
        op.f("ix_user_provider_access_provider_config_id"),
        "user_provider_access",
        ["provider_config_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_user_provider_access_provider_config_id"), table_name="user_provider_access")
    op.drop_index(op.f("ix_user_provider_access_user_id"), table_name="user_provider_access")
    op.drop_table("user_provider_access")

    op.drop_constraint("fk_translation_tasks_provider", "translation_tasks", type_="foreignkey")
    op.drop_column("translation_tasks", "provider_config_id")
    op.drop_column("translation_tasks", "page_count")

    op.drop_index(op.f("ix_translation_provider_configs_provider_type"), table_name="translation_provider_configs")
    op.drop_table("translation_provider_configs")

    op.drop_column("users", "last_quota_reset")
    op.drop_column("users", "daily_page_used")
    op.drop_column("users", "daily_page_limit")
    op.drop_column("users", "is_active")
    op.drop_column("users", "role")
