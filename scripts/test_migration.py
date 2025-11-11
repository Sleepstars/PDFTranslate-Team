#!/usr/bin/env python3
"""
Test script to verify database migration and initialization.
This script checks:
1. Database connection
2. Migration status
3. Table existence
4. Default data initialization
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text, inspect
from app.database import engine, AsyncSessionLocal
from app.models import (
    User,
    TranslationProviderConfig,
    TranslationTask,
    Group,
    GroupProviderAccess,
)


async def check_database_connection():
    """Check if database is accessible"""
    print("🔍 Checking database connection...")
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT 1"))
            result.fetchone()
        print("✅ Database connection successful")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False


async def check_tables_exist():
    """Check if all required tables exist"""
    print("\n🔍 Checking table existence...")
    
    required_tables = [
        "users",
        "translation_tasks",
        "translation_provider_configs",
        "groups",
        "group_provider_access",
    ]
    
    try:
        async with engine.begin() as conn:
            inspector = inspect(engine.sync_engine)
            existing_tables = inspector.get_table_names()
            
            all_exist = True
            for table in required_tables:
                if table in existing_tables:
                    print(f"  ✅ Table '{table}' exists")
                else:
                    print(f"  ❌ Table '{table}' missing")
                    all_exist = False
            
            return all_exist
    except Exception as e:
        print(f"❌ Error checking tables: {e}")
        return False


async def check_user_columns():
    """Check if User table has new columns"""
    print("\n🔍 Checking User table columns...")
    
    required_columns = [
        "role",
        "is_active",
        "daily_page_limit",
        "daily_page_used",
        "last_quota_reset",
    ]
    
    try:
        async with engine.begin() as conn:
            inspector = inspect(engine.sync_engine)
            columns = [col["name"] for col in inspector.get_columns("users")]
            
            all_exist = True
            for column in required_columns:
                if column in columns:
                    print(f"  ✅ Column 'users.{column}' exists")
                else:
                    print(f"  ❌ Column 'users.{column}' missing")
                    all_exist = False
            
            return all_exist
    except Exception as e:
        print(f"❌ Error checking columns: {e}")
        return False


async def check_task_columns():
    """Check if TranslationTask table has new columns"""
    print("\n🔍 Checking TranslationTask table columns...")
    
    required_columns = ["page_count", "provider_config_id"]
    
    try:
        async with engine.begin() as conn:
            inspector = inspect(engine.sync_engine)
            columns = [col["name"] for col in inspector.get_columns("translation_tasks")]
            
            all_exist = True
            for column in required_columns:
                if column in columns:
                    print(f"  ✅ Column 'translation_tasks.{column}' exists")
                else:
                    print(f"  ❌ Column 'translation_tasks.{column}' missing")
                    all_exist = False
            
            return all_exist
    except Exception as e:
        print(f"❌ Error checking columns: {e}")
        return False


async def check_default_data():
    """Check if default data exists"""
    print("\n🔍 Checking default data...")
    
    try:
        async with AsyncSessionLocal() as db:
            # Check for admin user
            admin_result = await db.execute(
                text("SELECT * FROM users WHERE role = 'admin' LIMIT 1")
            )
            admin = admin_result.fetchone()
            
            if admin:
                print(f"  ✅ Admin user exists: {admin.email}")
            else:
                print("  ⚠️  No admin user found")
            
            # Check for default provider
            provider_result = await db.execute(
                text("SELECT * FROM translation_provider_configs WHERE is_default = true LIMIT 1")
            )
            provider = provider_result.fetchone()
            
            if provider:
                print(f"  ✅ Default provider exists: {provider.name}")
            else:
                print("  ⚠️  No default provider found")
            
            # Count total users
            user_count_result = await db.execute(text("SELECT COUNT(*) FROM users"))
            user_count = user_count_result.scalar()
            print(f"  ℹ️  Total users: {user_count}")
            
            # Count total providers
            provider_count_result = await db.execute(
                text("SELECT COUNT(*) FROM translation_provider_configs")
            )
            provider_count = provider_count_result.scalar()
            print(f"  ℹ️  Total providers: {provider_count}")
            
            # Count total group access grants
            access_count_result = await db.execute(
                text("SELECT COUNT(*) FROM group_provider_access")
            )
            access_count = access_count_result.scalar()
            print(f"  ℹ️  Total group access grants: {access_count}")
            
            return True
    except Exception as e:
        print(f"❌ Error checking default data: {e}")
        return False


async def check_foreign_keys():
    """Check if foreign keys are properly set up"""
    print("\n🔍 Checking foreign key constraints...")
    
    try:
        async with engine.begin() as conn:
            inspector = inspect(engine.sync_engine)
            
            # Check translation_tasks foreign key
            task_fks = inspector.get_foreign_keys("translation_tasks")
            has_provider_fk = any(
                fk["referred_table"] == "translation_provider_configs"
                for fk in task_fks
            )
            
            if has_provider_fk:
                print("  ✅ translation_tasks -> translation_provider_configs FK exists")
            else:
                print("  ❌ translation_tasks -> translation_provider_configs FK missing")
            
            # Check group_provider_access foreign keys
            access_fks = inspector.get_foreign_keys("group_provider_access")
            has_group_fk = any(fk["referred_table"] == "groups" for fk in access_fks)
            has_provider_fk = any(
                fk["referred_table"] == "translation_provider_configs"
                for fk in access_fks
            )

            if has_group_fk:
                print("  ✅ group_provider_access -> groups FK exists")
            else:
                print("  ❌ group_provider_access -> groups FK missing")

            if has_provider_fk:
                print("  ✅ group_provider_access -> translation_provider_configs FK exists")
            else:
                print("  ❌ group_provider_access -> translation_provider_configs FK missing")
            
            return True
    except Exception as e:
        print(f"❌ Error checking foreign keys: {e}")
        return False


async def main():
    """Run all checks"""
    print("=" * 60)
    print("DATABASE MIGRATION & INITIALIZATION TEST")
    print("=" * 60)
    
    results = []
    
    # Run all checks
    results.append(("Database Connection", await check_database_connection()))
    results.append(("Tables Exist", await check_tables_exist()))
    results.append(("User Columns", await check_user_columns()))
    results.append(("Task Columns", await check_task_columns()))
    results.append(("Foreign Keys", await check_foreign_keys()))
    results.append(("Default Data", await check_default_data()))
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for check_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {check_name}")
    
    print(f"\nTotal: {passed}/{total} checks passed")
    
    if passed == total:
        print("\n🎉 All checks passed! Database is ready.")
        return 0
    else:
        print("\n⚠️  Some checks failed. Please review the output above.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
