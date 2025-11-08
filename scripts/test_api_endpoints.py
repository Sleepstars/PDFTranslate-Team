#!/usr/bin/env python3
"""
Test script to verify all API endpoints are working correctly.
This script tests:
1. Authentication endpoints
2. User management endpoints (admin)
3. Provider management endpoints (admin)
4. User endpoints
5. Task endpoints
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
from app.config import settings


BASE_URL = f"http://localhost:{settings.PORT}"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"


class APITester:
    def __init__(self):
        self.client = httpx.AsyncClient(base_url=BASE_URL, timeout=10.0)
        self.admin_cookies = None
        self.test_user_id = None
        self.test_provider_id = None
    
    async def close(self):
        await self.client.aclose()
    
    async def login_admin(self):
        """Login as admin and store cookies"""
        print("\n🔐 Testing admin login...")
        try:
            response = await self.client.post(
                "/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            )
            
            if response.status_code == 200:
                self.admin_cookies = response.cookies
                print("  ✅ Admin login successful")
                return True
            else:
                print(f"  ❌ Admin login failed: {response.status_code}")
                print(f"     Response: {response.text}")
                return False
        except Exception as e:
            print(f"  ❌ Admin login error: {e}")
            return False
    
    async def test_auth_me(self):
        """Test /auth/me endpoint"""
        print("\n🔍 Testing /auth/me...")
        try:
            response = await self.client.get("/auth/me", cookies=self.admin_cookies)
            
            if response.status_code == 200:
                data = response.json()
                print(f"  ✅ Auth me successful: {data.get('email')}")
                return True
            else:
                print(f"  ❌ Auth me failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"  ❌ Auth me error: {e}")
            return False
    
    async def test_list_users(self):
        """Test GET /api/admin/users"""
        print("\n🔍 Testing GET /api/admin/users...")
        try:
            response = await self.client.get("/api/admin/users", cookies=self.admin_cookies)
            
            if response.status_code == 200:
                users = response.json()
                print(f"  ✅ List users successful: {len(users)} users")
                return True
            else:
                print(f"  ❌ List users failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"  ❌ List users error: {e}")
            return False
    
    async def test_create_user(self):
        """Test POST /api/admin/users"""
        print("\n🔍 Testing POST /api/admin/users...")
        try:
            response = await self.client.post(
                "/api/admin/users",
                json={
                    "email": "test@example.com",
                    "name": "Test User",
                    "password": "test123",
                    "role": "user",
                    "dailyPageLimit": 100
                },
                cookies=self.admin_cookies
            )
            
            if response.status_code == 201:
                user = response.json()
                self.test_user_id = user.get("id")
                print(f"  ✅ Create user successful: {user.get('email')}")
                return True
            elif response.status_code == 400:
                print("  ⚠️  User already exists (expected if running multiple times)")
                # Try to get existing user
                response = await self.client.get("/api/admin/users", cookies=self.admin_cookies)
                if response.status_code == 200:
                    users = response.json()
                    test_user = next((u for u in users if u["email"] == "test@example.com"), None)
                    if test_user:
                        self.test_user_id = test_user["id"]
                return True
            else:
                print(f"  ❌ Create user failed: {response.status_code}")
                print(f"     Response: {response.text}")
                return False
        except Exception as e:
            print(f"  ❌ Create user error: {e}")
            return False
    
    async def test_get_user_quota(self):
        """Test GET /api/users/me/quota"""
        print("\n🔍 Testing GET /api/users/me/quota...")
        try:
            response = await self.client.get("/api/users/me/quota", cookies=self.admin_cookies)
            
            if response.status_code == 200:
                quota = response.json()
                print(f"  ✅ Get quota successful: {quota.get('remainingPages')}/{quota.get('dailyPageLimit')} pages")
                return True
            else:
                print(f"  ❌ Get quota failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"  ❌ Get quota error: {e}")
            return False
    
    async def test_list_providers(self):
        """Test GET /api/admin/providers"""
        print("\n🔍 Testing GET /api/admin/providers...")
        try:
            response = await self.client.get("/api/admin/providers", cookies=self.admin_cookies)
            
            if response.status_code == 200:
                providers = response.json()
                print(f"  ✅ List providers successful: {len(providers)} providers")
                if providers:
                    self.test_provider_id = providers[0]["id"]
                return True
            else:
                print(f"  ❌ List providers failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"  ❌ List providers error: {e}")
            return False
    
    async def test_get_user_providers(self):
        """Test GET /api/users/me/providers"""
        print("\n🔍 Testing GET /api/users/me/providers...")
        try:
            response = await self.client.get("/api/users/me/providers", cookies=self.admin_cookies)
            
            if response.status_code == 200:
                providers = response.json()
                print(f"  ✅ Get user providers successful: {len(providers)} providers")
                return True
            else:
                print(f"  ❌ Get user providers failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"  ❌ Get user providers error: {e}")
            return False
    
    async def test_list_tasks(self):
        """Test GET /api/tasks"""
        print("\n🔍 Testing GET /api/tasks...")
        try:
            response = await self.client.get("/api/tasks", cookies=self.admin_cookies)
            
            if response.status_code == 200:
                tasks = response.json()
                print(f"  ✅ List tasks successful: {len(tasks)} tasks")
                return True
            else:
                print(f"  ❌ List tasks failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"  ❌ List tasks error: {e}")
            return False
    
    async def test_health_check(self):
        """Test /health endpoint"""
        print("\n🔍 Testing /health...")
        try:
            response = await self.client.get("/health")
            
            if response.status_code == 200:
                print("  ✅ Health check successful")
                return True
            else:
                print(f"  ❌ Health check failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"  ❌ Health check error: {e}")
            return False


async def main():
    """Run all API tests"""
    print("=" * 60)
    print("API ENDPOINTS VALIDATION TEST")
    print("=" * 60)
    print(f"\nBase URL: {BASE_URL}")
    print(f"Admin Email: {ADMIN_EMAIL}")
    
    tester = APITester()
    results = []
    
    try:
        # Authentication tests
        results.append(("Health Check", await tester.test_health_check()))
        results.append(("Admin Login", await tester.login_admin()))
        
        if not tester.admin_cookies:
            print("\n❌ Cannot proceed without admin login")
            return 1
        
        results.append(("Auth Me", await tester.test_auth_me()))
        
        # User management tests
        results.append(("List Users", await tester.test_list_users()))
        results.append(("Create User", await tester.test_create_user()))
        results.append(("Get User Quota", await tester.test_get_user_quota()))
        
        # Provider management tests
        results.append(("List Providers", await tester.test_list_providers()))
        results.append(("Get User Providers", await tester.test_get_user_providers()))
        
        # Task tests
        results.append(("List Tasks", await tester.test_list_tasks()))
        
    finally:
        await tester.close()
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All API tests passed!")
        return 0
    else:
        print("\n⚠️  Some API tests failed. Please review the output above.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

