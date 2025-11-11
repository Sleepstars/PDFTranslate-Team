#!/usr/bin/env python3
"""
Database initialization script for PDFTranslate Team.
This script:
1. Runs Alembic migrations to create/update database schema
2. Seeds default data (admin user, default Google provider)
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import select, text
from app.database import get_async_session_context
from app.models import (
    User,
    TranslationProviderConfig,
    Group,
    GroupProviderAccess,
)
from app.auth import hash_password
import uuid


async def seed_default_data():
    """Seed default data into the database."""
    print("🌱 Seeding default data...")
    
    async with get_async_session_context() as db:
        # 1. Update existing admin user to have admin role
        result = await db.execute(
            select(User).where(User.email == "admin@example.com")
        )
        admin_user = result.scalar_one_or_none()
        
        if admin_user:
            print(f"✅ Found existing admin user: {admin_user.email}")
            if admin_user.role != "admin":
                admin_user.role = "admin"
                admin_user.daily_page_limit = 1000  # Give admin higher quota
                await db.commit()
                print(f"✅ Updated admin user role to 'admin' with 1000 pages/day quota")
        else:
            # Create default admin user if not exists
            admin_user = User(
                id=str(uuid.uuid4()),
                email="admin@example.com",
                name="Admin",
                password_hash=hash_password("admin123"),
                role="admin",
                is_active=True,
                daily_page_limit=1000
            )
            db.add(admin_user)
            await db.commit()
            print(f"✅ Created default admin user: admin@example.com (password: admin123)")
        
        # 2. Create default Google Translate provider (free, no API key needed)
        result = await db.execute(
            select(TranslationProviderConfig).where(
                TranslationProviderConfig.id == "google-default"
            )
        )
        google_provider = result.scalar_one_or_none()
        
        if not google_provider:
            google_provider = TranslationProviderConfig(
                id="google-default",
                name="Google Translate (Free)",
                provider_type="google",
                is_active=True,
                is_default=True,
                settings="{}"  # No settings needed for free Google Translate
            )
            db.add(google_provider)
            await db.commit()
            print(f"✅ Created default Google Translate provider")
        else:
            print(f"✅ Default Google Translate provider already exists")

        # 3. Ensure default group exists (created by migration 001, but tolerate manual DBs)
        result = await db.execute(select(Group).where(Group.id == "default"))
        default_group = result.scalar_one_or_none()
        if not default_group:
            default_group = Group(id="default", name="Default Group")
            db.add(default_group)
            await db.commit()
            print("✅ Created default group 'default'")
        else:
            print("✅ Default group exists")

        # 4. Assign all users without a group into the default group
        result = await db.execute(select(User))
        all_users = result.scalars().all()
        updated_users = 0
        for user in all_users:
            if getattr(user, "group_id", None) is None:
                user.group_id = "default"
                updated_users += 1
        if updated_users:
            await db.commit()
        print(f"✅ Assigned {updated_users} user(s) to default group")

        # 5. Grant default group access to the default provider
        access_exists = await db.execute(
            select(GroupProviderAccess).where(
                GroupProviderAccess.group_id == "default",
                GroupProviderAccess.provider_config_id == "google-default",
            )
        )
        if access_exists.scalar_one_or_none() is None:
            db.add(
                GroupProviderAccess(
                    id=str(uuid.uuid4()),
                    group_id="default",
                    provider_config_id="google-default",
                    sort_order=0,
                )
            )
            await db.commit()
            print("✅ Granted default group access to Google Translate")
        else:
            print("✅ Default group already has access to Google Translate")

        print("✅ Group-based access initialized")


async def check_migration_status():
    """Check if migrations have been applied."""
    print("🔍 Checking migration status...")
    
    async with get_async_session_context() as db:
        try:
            # Check if alembic_version table exists
            result = await db.execute(
                text("SELECT version_num FROM alembic_version")
            )
            version = result.scalar_one_or_none()
            
            if version:
                print(f"✅ Database is at migration version: {version}")
                return True
            else:
                print("⚠️  No migration version found")
                return False
        except Exception as e:
            print(f"⚠️  Migration check failed: {e}")
            return False


async def main():
    """Main initialization function."""
    print("=" * 60)
    print("PDFTranslate Team - Database Initialization")
    print("=" * 60)
    
    # Check migration status
    migration_applied = await check_migration_status()
    
    if not migration_applied:
        print("\n⚠️  Please run migrations first:")
        print("   pixi run alembic upgrade head")
        print("\nOr if using Docker:")
        print("   docker-compose exec backend pixi run alembic upgrade head")
        return 1
    
    # Seed default data
    try:
        await seed_default_data()
        print("\n" + "=" * 60)
        print("✅ Database initialization completed successfully!")
        print("=" * 60)
        print("\nDefault credentials:")
        print("  Email: admin@example.com")
        print("  Password: admin123")
        print("\n⚠️  Please change the admin password after first login!")
        return 0
    except Exception as e:
        print(f"\n❌ Error during initialization: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
