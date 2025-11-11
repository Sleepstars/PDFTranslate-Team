"""Add password reset tokens table

Revision ID: 003
Revises: 002
Create Date: 2025-11-11

"""
from alembic import op
import sqlalchemy as sa


revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Be tolerant if the app created the table via metadata.create_all earlier
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if 'password_reset_tokens' in tables:
        # Ensure indexes exist (PostgreSQL IF NOT EXISTS)
        op.execute('CREATE UNIQUE INDEX IF NOT EXISTS ix_password_reset_tokens_token_hash ON password_reset_tokens (token_hash)')
        op.execute('CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user_id ON password_reset_tokens (user_id)')
        op.execute('CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_expires_at ON password_reset_tokens (expires_at)')
        op.execute('CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_used ON password_reset_tokens (used)')
        return

    op.create_table(
        'password_reset_tokens',
        sa.Column('id', sa.String(length=50), primary_key=True),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False, unique=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index(op.f('ix_password_reset_tokens_user_id'), 'password_reset_tokens', ['user_id'], unique=False)
    op.create_index(op.f('ix_password_reset_tokens_expires_at'), 'password_reset_tokens', ['expires_at'], unique=False)
    op.create_index(op.f('ix_password_reset_tokens_used'), 'password_reset_tokens', ['used'], unique=False)
    op.create_index(op.f('ix_password_reset_tokens_token_hash'), 'password_reset_tokens', ['token_hash'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_password_reset_tokens_token_hash'), table_name='password_reset_tokens')
    op.drop_index(op.f('ix_password_reset_tokens_used'), table_name='password_reset_tokens')
    op.drop_index(op.f('ix_password_reset_tokens_expires_at'), table_name='password_reset_tokens')
    op.drop_index(op.f('ix_password_reset_tokens_user_id'), table_name='password_reset_tokens')
    op.drop_table('password_reset_tokens')
