"""Remove user_provider_access table

Revision ID: 002
Revises: 001
Create Date: 2025-11-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Drop user_provider_access table and its indexes."""
    # Drop indexes first
    op.drop_index('ix_user_provider_access_provider_config_id', table_name='user_provider_access')
    op.drop_index('ix_user_provider_access_user_id', table_name='user_provider_access')

    # Drop the table
    op.drop_table('user_provider_access')


def downgrade() -> None:
    """Recreate user_provider_access table if needed to rollback."""
    # Recreate the table
    op.create_table(
        'user_provider_access',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('provider_config_id', sa.String(length=50), nullable=False),
        sa.Column('is_default', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['provider_config_id'], ['translation_provider_configs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Recreate indexes
    op.create_index('ix_user_provider_access_user_id', 'user_provider_access', ['user_id'], unique=False)
    op.create_index('ix_user_provider_access_provider_config_id', 'user_provider_access', ['provider_config_id'], unique=False)
