"""
Consolidated initial schema (squashed)

Revision ID: 001
Revises: None (squashed)
Create Date: 2025-11-10
"""

from alembic import op
import sqlalchemy as sa


revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # groups
    op.create_table(
        "groups",
        sa.Column("id", sa.String(length=50), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # translation_provider_configs
    op.create_table(
        "translation_provider_configs",
        sa.Column("id", sa.String(length=50), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("provider_type", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("settings", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index(
        op.f("ix_translation_provider_configs_provider_type"),
        "translation_provider_configs",
        ["provider_type"],
        unique=False,
    )

    # users (FK to groups)
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=50), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="user"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("group_id", sa.String(length=50), nullable=True),
        sa.Column("daily_page_limit", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("daily_page_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_quota_reset", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_group_id"), "users", ["group_id"], unique=False)
    op.create_foreign_key("fk_users_group_id", "users", "groups", ["group_id"], ["id"], ondelete="SET NULL")

    # group_provider_access
    op.create_table(
        "group_provider_access",
        sa.Column("id", sa.String(length=50), primary_key=True),
        sa.Column("group_id", sa.String(length=50), nullable=False),
        sa.Column("provider_config_id", sa.String(length=50), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["provider_config_id"], ["translation_provider_configs.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_group_provider_access_group_id"), "group_provider_access", ["group_id"], unique=False)
    op.create_index(op.f("ix_group_provider_access_provider_config_id"), "group_provider_access", ["provider_config_id"], unique=False)

    # user_provider_access
    op.create_table(
        "user_provider_access",
        sa.Column("id", sa.String(length=50), primary_key=True),
        sa.Column("user_id", sa.String(length=50), nullable=False),
        sa.Column("provider_config_id", sa.String(length=50), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["provider_config_id"], ["translation_provider_configs.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_user_provider_access_user_id"), "user_provider_access", ["user_id"], unique=False)
    op.create_index(op.f("ix_user_provider_access_provider_config_id"), "user_provider_access", ["provider_config_id"], unique=False)

    # system_settings
    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(length=100), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )

    # translation_tasks (full schema)
    op.create_table(
        "translation_tasks",
        sa.Column("id", sa.String(length=50), primary_key=True),
        sa.Column("owner_id", sa.String(length=50), nullable=False),
        sa.Column("owner_email", sa.String(length=255), nullable=False),
        sa.Column("document_name", sa.String(length=500), nullable=False),
        sa.Column("source_lang", sa.String(length=10), nullable=False),
        sa.Column("target_lang", sa.String(length=10), nullable=False),
        sa.Column("engine", sa.String(length=50), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("input_s3_key", sa.String(length=500), nullable=True),
        sa.Column("output_s3_key", sa.String(length=500), nullable=True),
        sa.Column("output_url", sa.String(length=1000), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("model_config", sa.Text(), nullable=True),
        sa.Column("progress_message", sa.Text(), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("provider_config_id", sa.String(length=50), nullable=True),
        sa.Column("mono_output_s3_key", sa.String(length=500), nullable=True),
        sa.Column("mono_output_url", sa.String(length=1000), nullable=True),
        sa.Column("dual_output_s3_key", sa.String(length=500), nullable=True),
        sa.Column("dual_output_url", sa.String(length=1000), nullable=True),
        sa.Column("glossary_output_s3_key", sa.String(length=500), nullable=True),
        sa.Column("glossary_output_url", sa.String(length=1000), nullable=True),
        sa.Column("zip_output_s3_key", sa.String(length=500), nullable=True),
        sa.Column("zip_output_url", sa.String(length=1000), nullable=True),
        sa.Column("task_type", sa.String(length=20), nullable=False, server_default="translation"),
        sa.Column("markdown_output_s3_key", sa.String(length=500), nullable=True),
        sa.Column("markdown_output_url", sa.String(length=1000), nullable=True),
        sa.Column("translated_markdown_s3_key", sa.String(length=500), nullable=True),
        sa.Column("translated_markdown_url", sa.String(length=1000), nullable=True),
        sa.Column("mineru_task_id", sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(["provider_config_id"], ["translation_provider_configs.id"], ondelete="SET NULL"),
    )
    # indexes for tasks
    op.create_index("ix_translation_tasks_owner_created", "translation_tasks", ["owner_id", "created_at"], unique=False)
    op.create_index("ix_translation_tasks_status_created", "translation_tasks", ["status", "created_at"], unique=False)
    op.create_index("ix_translation_tasks_owner_status", "translation_tasks", ["owner_id", "status"], unique=False)
    op.create_index("ix_translation_tasks_priority_created", "translation_tasks", ["priority", "created_at"], unique=False)
    op.create_index("ix_translation_tasks_owner_email", "translation_tasks", ["owner_email"], unique=False)
    op.create_index("ix_translation_tasks_engine_status", "translation_tasks", ["engine", "status"], unique=False)
    op.create_index(op.f("ix_translation_tasks_task_type"), "translation_tasks", ["task_type"], unique=False)

    # seed default group
    op.execute("INSERT INTO groups (id, name, created_at) VALUES ('default', 'Default Group', CURRENT_TIMESTAMP)")


def downgrade() -> None:
    # drop task indexes and table
    op.drop_index(op.f("ix_translation_tasks_task_type"), table_name="translation_tasks")
    op.drop_index("ix_translation_tasks_engine_status", table_name="translation_tasks")
    op.drop_index("ix_translation_tasks_owner_email", table_name="translation_tasks")
    op.drop_index("ix_translation_tasks_priority_created", table_name="translation_tasks")
    op.drop_index("ix_translation_tasks_owner_status", table_name="translation_tasks")
    op.drop_index("ix_translation_tasks_status_created", table_name="translation_tasks")
    op.drop_index("ix_translation_tasks_owner_created", table_name="translation_tasks")
    op.drop_table("translation_tasks")

    op.drop_table("system_settings")

    op.drop_index(op.f("ix_user_provider_access_provider_config_id"), table_name="user_provider_access")
    op.drop_index(op.f("ix_user_provider_access_user_id"), table_name="user_provider_access")
    op.drop_table("user_provider_access")

    op.drop_index(op.f("ix_group_provider_access_provider_config_id"), table_name="group_provider_access")
    op.drop_index(op.f("ix_group_provider_access_group_id"), table_name="group_provider_access")
    op.drop_table("group_provider_access")

    op.drop_constraint("fk_users_group_id", "users", type_="foreignkey")
    op.drop_index(op.f("ix_users_group_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    op.drop_index(op.f("ix_translation_provider_configs_provider_type"), table_name="translation_provider_configs")
    op.drop_table("translation_provider_configs")

    op.drop_table("groups")

