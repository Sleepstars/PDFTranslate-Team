# API Reference

**Project:** PDFTranslate Team  
**Version:** 1.0.0  
**Base URL:** `http://localhost:8000` (development) or `https://api.your-domain.com` (production)

---

## Table of Contents

1. [Authentication](#authentication)
2. [User Endpoints](#user-endpoints)
3. [Task Endpoints](#task-endpoints)
4. [Admin - User Management](#admin---user-management)
5. [Admin - Provider Management](#admin---provider-management)
6. [Admin - Access Control](#admin---access-control)
7. [Error Responses](#error-responses)

---

## Authentication

All API requests (except login) require authentication via session cookies.

### POST /auth/login

Login with email and password.

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

**Response (200 OK):**
```json
{
  "id": "user_123",
  "email": "admin@example.com",
  "name": "Admin User",
  "role": "admin"
}
```

**Errors:**
- `401 Unauthorized`: Invalid credentials

---

### POST /auth/logout

Logout and invalidate session.

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

---

### GET /auth/me

Get current authenticated user info.

**Response (200 OK):**
```json
{
  "id": "user_123",
  "email": "admin@example.com",
  "name": "Admin User",
  "role": "admin"
}
```

**Errors:**
- `401 Unauthorized`: Not authenticated

---

## User Endpoints

### GET /api/users/me

Get detailed information about the current user.

**Response (200 OK):**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user",
  "isActive": true,
  "dailyPageLimit": 100,
  "dailyPageUsed": 25,
  "createdAt": "2025-11-08T10:00:00Z"
}
```

---

### GET /api/users/me/quota

Get current user's quota status.

**Response (200 OK):**
```json
{
  "dailyPageLimit": 100,
  "dailyPageUsed": 25,
  "remainingPages": 75,
  "lastQuotaReset": "2025-11-08T00:00:00Z",
  "nextResetAt": "2025-11-09T00:00:00Z"
}
```

---

### GET /api/users/me/providers

Get translation providers accessible to the current user.

**Response (200 OK):**
```json
[
  {
    "id": "google-free",
    "name": "Google Translate (Free)",
    "providerType": "google",
    "isActive": true,
    "isDefault": true
  },
  {
    "id": "deepl-pro",
    "name": "DeepL Pro",
    "providerType": "deepl",
    "isActive": true,
    "isDefault": false
  }
]
```

---

## Task Endpoints

### POST /api/tasks

Create a new translation task.

**Request (multipart/form-data):**
```
file: <PDF file>
documentName: "My Document"
sourceLang: "en"
targetLang: "zh"
priority: "normal"
providerConfigId: "google-free" (optional)
notes: "Translation notes" (optional)
```

**Response (201 Created):**
```json
{
  "id": "task_456",
  "documentName": "My Document",
  "sourceLang": "en",
  "targetLang": "zh",
  "status": "queued",
  "progress": 0,
  "pageCount": 10,
  "priority": "normal",
  "notes": "Translation notes",
  "createdAt": "2025-11-08T12:00:00Z",
  "updatedAt": "2025-11-08T12:00:00Z"
}
```

**Errors:**
- `400 Bad Request`: Invalid file or parameters
- `403 Forbidden`: Quota exceeded or no access to provider
- `413 Payload Too Large`: File too large

---

### GET /api/tasks

Get list of tasks for the current user.

**Query Parameters:**
- `status` (optional): Filter by status (queued, processing, completed, failed, canceled)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response (200 OK):**
```json
[
  {
    "id": "task_456",
    "documentName": "My Document",
    "sourceLang": "en",
    "targetLang": "zh",
    "status": "completed",
    "progress": 100,
    "pageCount": 10,
    "outputUrl": "https://s3.../translated.pdf",
    "createdAt": "2025-11-08T12:00:00Z",
    "updatedAt": "2025-11-08T12:30:00Z"
  }
]
```

---

### GET /api/tasks/{id}

Get details of a specific task.

**Response (200 OK):**
```json
{
  "id": "task_456",
  "documentName": "My Document",
  "sourceLang": "en",
  "targetLang": "zh",
  "status": "completed",
  "progress": 100,
  "pageCount": 10,
  "priority": "normal",
  "notes": "Translation notes",
  "outputUrl": "https://s3.../translated.pdf",
  "createdAt": "2025-11-08T12:00:00Z",
  "updatedAt": "2025-11-08T12:30:00Z"
}
```

**Errors:**
- `404 Not Found`: Task not found or not owned by user

---

### POST /api/tasks/{id}/retry

Retry a failed task.

**Response (200 OK):**
```json
{
  "id": "task_456",
  "status": "queued",
  "progress": 0,
  "updatedAt": "2025-11-08T13:00:00Z"
}
```

**Errors:**
- `400 Bad Request`: Task is not in failed state
- `404 Not Found`: Task not found

---

### POST /api/tasks/{id}/cancel

Cancel a queued or processing task.

**Response (200 OK):**
```json
{
  "id": "task_456",
  "status": "canceled",
  "updatedAt": "2025-11-08T13:00:00Z"
}
```

**Errors:**
- `400 Bad Request`: Task cannot be canceled (already completed/failed)
- `404 Not Found`: Task not found

---

### GET /api/tasks/{id}/download

Download the translated PDF file.

**Response (200 OK):**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="translated.pdf"`

**Errors:**
- `404 Not Found`: Task not found or not completed
- `410 Gone`: File expired or deleted

---

## Admin - User Management

**All endpoints require `admin` role.**

### GET /api/admin/users

Get list of all users.

**Response (200 OK):**
```json
[
  {
    "id": "user_123",
    "email": "admin@example.com",
    "name": "Admin User",
    "role": "admin",
    "isActive": true,
    "dailyPageLimit": 1000,
    "dailyPageUsed": 50,
    "createdAt": "2025-11-01T00:00:00Z"
  },
  {
    "id": "user_456",
    "email": "user@example.com",
    "name": "Regular User",
    "role": "user",
    "isActive": true,
    "dailyPageLimit": 100,
    "dailyPageUsed": 25,
    "createdAt": "2025-11-08T10:00:00Z"
  }
]
```

---

### POST /api/admin/users

Create a new user.

**Request:**
```json
{
  "email": "newuser@example.com",
  "name": "New User",
  "password": "secure_password",
  "role": "user",
  "dailyPageLimit": 100
}
```

**Response (201 Created):**
```json
{
  "id": "user_789",
  "email": "newuser@example.com",
  "name": "New User",
  "role": "user",
  "isActive": true,
  "dailyPageLimit": 100,
  "dailyPageUsed": 0,
  "createdAt": "2025-11-08T14:00:00Z"
}
```

**Errors:**
- `400 Bad Request`: Invalid data or email already exists
- `403 Forbidden`: Not an admin

---

### GET /api/admin/users/{id}

Get details of a specific user.

**Response (200 OK):**
```json
{
  "id": "user_456",
  "email": "user@example.com",
  "name": "Regular User",
  "role": "user",
  "isActive": true,
  "dailyPageLimit": 100,
  "dailyPageUsed": 25,
  "lastQuotaReset": "2025-11-08T00:00:00Z",
  "createdAt": "2025-11-08T10:00:00Z"
}
```

**Errors:**
- `404 Not Found`: User not found

---

### PATCH /api/admin/users/{id}

Update user information.

**Request:**
```json
{
  "name": "Updated Name",
  "isActive": true
}
```

**Response (200 OK):**
```json
{
  "id": "user_456",
  "email": "user@example.com",
  "name": "Updated Name",
  "role": "user",
  "isActive": true,
  "dailyPageLimit": 100,
  "dailyPageUsed": 25,
  "createdAt": "2025-11-08T10:00:00Z"
}
```

---

### DELETE /api/admin/users/{id}

Delete a user.

**Response (204 No Content)**

**Errors:**
- `404 Not Found`: User not found
- `400 Bad Request`: Cannot delete yourself

---

### PATCH /api/admin/users/{id}/quota

Update user's daily page limit.

**Request:**
```json
{
  "dailyPageLimit": 200
}
```

**Response (200 OK):**
```json
{
  "id": "user_456",
  "dailyPageLimit": 200,
  "dailyPageUsed": 25,
  "remainingPages": 175
}
```

---

## Admin - Provider Management

**All endpoints require `admin` role.**

### GET /api/admin/providers

Get list of all translation provider configurations.

**Response (200 OK):**
```json
[
  {
    "id": "google-free",
    "name": "Google Translate (Free)",
    "providerType": "google",
    "description": "Free Google Translate service",
    "isActive": true,
    "isDefault": true,
    "settings": "{}",
    "createdAt": "2025-11-08T00:00:00Z",
    "updatedAt": "2025-11-08T00:00:00Z"
  }
]
```

---

### POST /api/admin/providers

Create a new provider configuration.

**Request:**
```json
{
  "id": "deepl-pro",
  "name": "DeepL Pro",
  "providerType": "deepl",
  "description": "DeepL Pro API",
  "isActive": true,
  "isDefault": false,
  "settings": "{\"api_key\": \"your-api-key\"}"
}
```

**Response (201 Created):**
```json
{
  "id": "deepl-pro",
  "name": "DeepL Pro",
  "providerType": "deepl",
  "description": "DeepL Pro API",
  "isActive": true,
  "isDefault": false,
  "settings": "{\"api_key\": \"your-api-key\"}",
  "createdAt": "2025-11-08T14:00:00Z",
  "updatedAt": "2025-11-08T14:00:00Z"
}
```

**Errors:**
- `400 Bad Request`: Invalid data or ID already exists

---

### GET /api/admin/providers/{id}

Get details of a specific provider.

**Response (200 OK):**
```json
{
  "id": "deepl-pro",
  "name": "DeepL Pro",
  "providerType": "deepl",
  "description": "DeepL Pro API",
  "isActive": true,
  "isDefault": false,
  "settings": "{\"api_key\": \"your-api-key\"}",
  "createdAt": "2025-11-08T14:00:00Z",
  "updatedAt": "2025-11-08T14:00:00Z"
}
```

---

### PATCH /api/admin/providers/{id}

Update provider configuration.

**Request:**
```json
{
  "name": "DeepL Pro (Updated)",
  "isActive": false,
  "settings": "{\"api_key\": \"new-api-key\"}"
}
```

**Response (200 OK):**
```json
{
  "id": "deepl-pro",
  "name": "DeepL Pro (Updated)",
  "providerType": "deepl",
  "isActive": false,
  "isDefault": false,
  "settings": "{\"api_key\": \"new-api-key\"}",
  "updatedAt": "2025-11-08T15:00:00Z"
}
```

---

### DELETE /api/admin/providers/{id}

Delete a provider configuration.

**Response (204 No Content)**

**Errors:**
- `404 Not Found`: Provider not found
- `400 Bad Request`: Cannot delete provider with active users

---

## Admin - Access Control

**All endpoints require `admin` role.**

### GET /api/admin/providers/access/all

Get all user-provider access grants.

**Response (200 OK):**
```json
[
  {
    "id": "access_123",
    "userId": "user_456",
    "providerConfigId": "google-free",
    "isDefault": true,
    "createdAt": "2025-11-08T10:00:00Z",
    "user": {
      "email": "user@example.com",
      "name": "Regular User"
    },
    "provider": {
      "name": "Google Translate (Free)",
      "providerType": "google"
    }
  }
]
```

---

### POST /api/admin/providers/access

Grant a user access to a provider.

**Request:**
```json
{
  "userId": "user_456",
  "providerConfigId": "deepl-pro",
  "isDefault": false
}
```

**Response (201 Created):**
```json
{
  "id": "access_456",
  "userId": "user_456",
  "providerConfigId": "deepl-pro",
  "isDefault": false,
  "createdAt": "2025-11-08T15:00:00Z"
}
```

**Errors:**
- `400 Bad Request`: Access already exists
- `404 Not Found`: User or provider not found

---

### DELETE /api/admin/providers/access/{id}

Revoke a user's access to a provider.

**Response (204 No Content)**

**Errors:**
- `404 Not Found`: Access grant not found

---

## Error Responses

All error responses follow this format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `204 No Content`: Request successful, no content to return
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required or failed
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `413 Payload Too Large`: File too large
- `422 Unprocessable Entity`: Validation error
- `500 Internal Server Error`: Server error

---

**API Reference Version:** 1.0  
**Last Updated:** 2025-11-08

