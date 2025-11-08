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
from app.models import User, TranslationProviderConfig, UserProviderAccess
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
        
        # 3. Grant all users access to default Google provider
        result = await db.execute(select(User))
        all_users = result.scalars().all()
        
        for user in all_users:
            # Check if user already has access
            access_result = await db.execute(
                select(UserProviderAccess).where(
                    UserProviderAccess.user_id == user.id,
                    UserProviderAccess.provider_config_id == "google-default"
                )
            )
            existing_access = access_result.scalar_one_or_none()
            
            if not existing_access:
                access = UserProviderAccess(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    provider_config_id="google-default",
                    is_default=True
                )
                db.add(access)
                print(f"✅ Granted {user.email} access to Google Translate")
        
        await db.commit()
        print("✅ All users have access to default Google Translate provider")


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

