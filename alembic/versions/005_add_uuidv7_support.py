"""Add UUIDv7 support

Revision ID: 005
Revises: 004
Create Date: 2025-11-11 20:36:32.947269

"""
from alembic import op


revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create UUIDv7 generation function based on RFC 9562
    # This function generates time-ordered UUIDs with millisecond precision
    op.execute("""
        CREATE OR REPLACE FUNCTION uuid_generate_v7()
        RETURNS uuid
        AS $$
        DECLARE
            unix_ts_ms BIGINT;
            uuid_bytes BYTEA;
        BEGIN
            -- Get current Unix timestamp in milliseconds
            unix_ts_ms = (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;

            -- Generate UUIDv7 according to RFC 9562
            -- Format: tttttttt-tttt-7xxx-yxxx-xxxxxxxxxxxx
            -- t = timestamp (48 bits)
            -- 7 = version (4 bits)
            -- y = variant (2 bits, always 10)
            -- x = random (remaining bits)
            uuid_bytes =
                -- 48-bit timestamp (6 bytes)
                substring(int8send(unix_ts_ms) from 3 for 6) ||
                -- Version (4 bits = 0x7) + random (12 bits)
                substring(gen_random_bytes(2) from 1 for 2) ||
                -- Variant (2 bits = 0b10) + random (62 bits)
                substring(gen_random_bytes(8) from 1 for 8);

            -- Set version bits (0x7 in position 6, bits 4-7)
            uuid_bytes = set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);

            -- Set variant bits (0b10 in position 8, bits 6-7)
            uuid_bytes = set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);

            RETURN encode(uuid_bytes, 'hex')::uuid;
        END;
        $$ LANGUAGE plpgsql VOLATILE;
    """)

    # Add default values to all primary key columns
    # Note: This will only affect NEW rows; existing rows keep their current IDs

    # Users table
    op.execute("ALTER TABLE users ALTER COLUMN id SET DEFAULT uuid_generate_v7()::text")

    # Translation provider configs table
    op.execute("ALTER TABLE translation_provider_configs ALTER COLUMN id SET DEFAULT uuid_generate_v7()::text")

    # Groups table
    op.execute("ALTER TABLE groups ALTER COLUMN id SET DEFAULT uuid_generate_v7()::text")

    # Group provider access table
    op.execute("ALTER TABLE group_provider_access ALTER COLUMN id SET DEFAULT uuid_generate_v7()::text")

    # Translation tasks table
    op.execute("ALTER TABLE translation_tasks ALTER COLUMN id SET DEFAULT uuid_generate_v7()::text")

    # Password reset tokens table
    op.execute("ALTER TABLE password_reset_tokens ALTER COLUMN id SET DEFAULT uuid_generate_v7()::text")

    # Email verification tokens table
    op.execute("ALTER TABLE email_verification_tokens ALTER COLUMN id SET DEFAULT uuid_generate_v7()::text")


def downgrade() -> None:
    # Remove default values from all primary key columns
    op.execute("ALTER TABLE users ALTER COLUMN id DROP DEFAULT")
    op.execute("ALTER TABLE translation_provider_configs ALTER COLUMN id DROP DEFAULT")
    op.execute("ALTER TABLE groups ALTER COLUMN id DROP DEFAULT")
    op.execute("ALTER TABLE group_provider_access ALTER COLUMN id DROP DEFAULT")
    op.execute("ALTER TABLE translation_tasks ALTER COLUMN id DROP DEFAULT")
    op.execute("ALTER TABLE password_reset_tokens ALTER COLUMN id DROP DEFAULT")
    op.execute("ALTER TABLE email_verification_tokens ALTER COLUMN id DROP DEFAULT")

    # Drop the UUIDv7 generation function
    op.execute("DROP FUNCTION IF EXISTS uuid_generate_v7()")
