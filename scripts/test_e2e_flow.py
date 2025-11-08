#!/usr/bin/env python3
"""
End-to-end test script for critical user flows.
Tests the complete flow from login to task creation.
"""

import asyncio
import sys
from pathlib import Path
import io

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
from app.config import settings


BASE_URL = f"http://localhost:{settings.PORT}"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"


class E2ETest:
    def __init__(self):
        self.client = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0, follow_redirects=True)
        self.admin_cookies = None
        self.user_cookies = None
        self.test_user_email = "e2e_test@example.com"
        self.test_user_password = "e2e_test123"
        self.test_user_id = None
        self.test_provider_id = None
        self.test_task_id = None
    
    async def close(self):
        await self.client.aclose()
    
    async def test_admin_login(self):
        """Test 1: Admin can login"""
        print("\n📝 Test 1: Admin Login")
        try:
            response = await self.client.post(
                "/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            )
            
            if response.status_code == 200:
                self.admin_cookies = response.cookies
                print("  ✅ PASS: Admin login successful")
                return True
            else:
                print(f"  ❌ FAIL: Login failed with status {response.status_code}")
                return False
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
            return False
    
    async def test_create_user(self):
        """Test 2: Admin can create a new user"""
        print("\n📝 Test 2: Create User")
        try:
            # First, try to delete existing test user
            users_response = await self.client.get("/api/admin/users", cookies=self.admin_cookies)
            if users_response.status_code == 200:
                users = users_response.json()
                existing_user = next((u for u in users if u["email"] == self.test_user_email), None)
                if existing_user:
                    await self.client.delete(
                        f"/api/admin/users/{existing_user['id']}",
                        cookies=self.admin_cookies
                    )
                    print("  ℹ️  Deleted existing test user")
            
            # Create new user
            response = await self.client.post(
                "/api/admin/users",
                json={
                    "email": self.test_user_email,
                    "name": "E2E Test User",
                    "password": self.test_user_password,
                    "role": "user",
                    "dailyPageLimit": 100
                },
                cookies=self.admin_cookies
            )
            
            if response.status_code == 201:
                user = response.json()
                self.test_user_id = user["id"]
                print(f"  ✅ PASS: User created with ID {self.test_user_id}")
                return True
            else:
                print(f"  ❌ FAIL: Create user failed with status {response.status_code}")
                print(f"     Response: {response.text}")
                return False
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
            return False
    
    async def test_user_login(self):
        """Test 3: New user can login"""
        print("\n📝 Test 3: User Login")
        try:
            response = await self.client.post(
                "/auth/login",
                json={"email": self.test_user_email, "password": self.test_user_password}
            )
            
            if response.status_code == 200:
                self.user_cookies = response.cookies
                print("  ✅ PASS: User login successful")
                return True
            else:
                print(f"  ❌ FAIL: Login failed with status {response.status_code}")
                return False
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
            return False
    
    async def test_user_quota(self):
        """Test 4: User can check quota"""
        print("\n📝 Test 4: Check User Quota")
        try:
            response = await self.client.get("/api/users/me/quota", cookies=self.user_cookies)
            
            if response.status_code == 200:
                quota = response.json()
                remaining = quota.get("remainingPages")
                limit = quota.get("dailyPageLimit")
                print(f"  ✅ PASS: Quota check successful ({remaining}/{limit} pages)")
                return True
            else:
                print(f"  ❌ FAIL: Quota check failed with status {response.status_code}")
                return False
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
            return False
    
    async def test_get_providers(self):
        """Test 5: User can get available providers"""
        print("\n📝 Test 5: Get Available Providers")
        try:
            response = await self.client.get("/api/users/me/providers", cookies=self.user_cookies)
            
            if response.status_code == 200:
                providers = response.json()
                if providers:
                    self.test_provider_id = providers[0]["id"]
                    print(f"  ✅ PASS: Found {len(providers)} providers")
                    return True
                else:
                    print("  ⚠️  WARNING: No providers available")
                    return True
            else:
                print(f"  ❌ FAIL: Get providers failed with status {response.status_code}")
                return False
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
            return False
    
    async def test_create_task(self):
        """Test 6: User can create a task"""
        print("\n📝 Test 6: Create Translation Task")
        try:
            # Create a dummy PDF file (just for testing, not a real PDF)
            pdf_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n"
            pdf_file = io.BytesIO(pdf_content)
            
            files = {
                "file": ("test.pdf", pdf_file, "application/pdf")
            }
            data = {
                "documentName": "E2E Test Document",
                "sourceLang": "en",
                "targetLang": "zh",
                "priority": "normal",
                "notes": "E2E test task"
            }
            
            if self.test_provider_id:
                data["providerConfigId"] = self.test_provider_id
            
            response = await self.client.post(
                "/api/tasks",
                files=files,
                data=data,
                cookies=self.user_cookies
            )
            
            if response.status_code == 201:
                task = response.json()
                self.test_task_id = task["id"]
                print(f"  ✅ PASS: Task created with ID {self.test_task_id}")
                return True
            else:
                print(f"  ❌ FAIL: Create task failed with status {response.status_code}")
                print(f"     Response: {response.text}")
                return False
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
            return False
    
    async def test_list_tasks(self):
        """Test 7: User can list their tasks"""
        print("\n📝 Test 7: List User Tasks")
        try:
            response = await self.client.get("/api/tasks", cookies=self.user_cookies)
            
            if response.status_code == 200:
                tasks = response.json()
                user_task = next((t for t in tasks if t["id"] == self.test_task_id), None)
                if user_task:
                    print(f"  ✅ PASS: Found task in list (status: {user_task['status']})")
                    return True
                else:
                    print("  ❌ FAIL: Created task not found in list")
                    return False
            else:
                print(f"  ❌ FAIL: List tasks failed with status {response.status_code}")
                return False
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
            return False
    
    async def test_admin_can_manage_providers(self):
        """Test 8: Admin can manage providers"""
        print("\n📝 Test 8: Admin Manage Providers")
        try:
            # List providers
            response = await self.client.get("/api/admin/providers", cookies=self.admin_cookies)
            
            if response.status_code == 200:
                providers = response.json()
                print(f"  ✅ PASS: Admin can list {len(providers)} providers")
                return True
            else:
                print(f"  ❌ FAIL: List providers failed with status {response.status_code}")
                return False
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
            return False
    
    async def test_user_cannot_access_admin(self):
        """Test 9: Regular user cannot access admin endpoints"""
        print("\n📝 Test 9: User Access Control")
        try:
            response = await self.client.get("/api/admin/users", cookies=self.user_cookies)
            
            if response.status_code == 403:
                print("  ✅ PASS: User correctly denied access to admin endpoint")
                return True
            else:
                print(f"  ❌ FAIL: Expected 403, got {response.status_code}")
                return False
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
            return False
    
    async def test_logout(self):
        """Test 10: User can logout"""
        print("\n📝 Test 10: User Logout")
        try:
            response = await self.client.post("/auth/logout", cookies=self.user_cookies)
            
            if response.status_code == 200:
                # Try to access protected endpoint
                check_response = await self.client.get("/api/users/me", cookies=self.user_cookies)
                if check_response.status_code == 401:
                    print("  ✅ PASS: Logout successful, session invalidated")
                    return True
                else:
                    print("  ⚠️  WARNING: Logout succeeded but session still valid")
                    return True
            else:
                print(f"  ❌ FAIL: Logout failed with status {response.status_code}")
                return False
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
            return False


async def main():
    """Run all E2E tests"""
    print("=" * 60)
    print("END-TO-END INTEGRATION TEST")
    print("=" * 60)
    print(f"\nBase URL: {BASE_URL}")
    print("Testing complete user flow from login to task creation")
    
    tester = E2ETest()
    results = []
    
    try:
        # Run tests in sequence
        results.append(("Admin Login", await tester.test_admin_login()))
        
        if not tester.admin_cookies:
            print("\n❌ Cannot proceed without admin login")
            return 1
        
        results.append(("Create User", await tester.test_create_user()))
        results.append(("User Login", await tester.test_user_login()))
        
        if not tester.user_cookies:
            print("\n❌ Cannot proceed without user login")
            return 1
        
        results.append(("Check Quota", await tester.test_user_quota()))
        results.append(("Get Providers", await tester.test_get_providers()))
        results.append(("Create Task", await tester.test_create_task()))
        results.append(("List Tasks", await tester.test_list_tasks()))
        results.append(("Admin Manage Providers", await tester.test_admin_can_manage_providers()))
        results.append(("User Access Control", await tester.test_user_cannot_access_admin()))
        results.append(("User Logout", await tester.test_logout()))
        
    finally:
        await tester.close()
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({passed*100//total}%)")
    
    if passed == total:
        print("\n🎉 All E2E tests passed!")
        return 0
    else:
        print("\n⚠️  Some E2E tests failed. Please review the output above.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

