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
6. [Admin - Group Management](#admin---group-management)
8. [Admin - Settings](#admin---settings)
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

Fields `monoOutputUrl`, `dualOutputUrl`, and `glossaryOutputUrl` provide direct download links for the mono, dual, and glossary artifacts. `zipOutputUrl` exposes the raw MinerU ZIP bundle (with the `images/` directory intact) so parsing workflows can retrieve every extracted asset at once, while `markdownOutputUrl` now rewrites image references to the tenant's S3 bucket for direct viewing. `progressMessage` surfaces the live stage text that now drives the finer-grained progress bar (values come from BabelDOC events).

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

Returns provider configurations the current user can select when creating tasks.

Selection rules:
- If the user belongs to a group, providers granted to that group are returned in group order.
- If the user has no group, an empty list is returned (no providers available).
- The first MinerU provider and the first non‑MinerU provider are flagged with `isDefault: true` to support sensible defaults for parsing vs. translation.

The list includes only providers granted through the user's **Group** (translation engines, OCR models, MinerU parsers, etc.)

**Response (200 OK):**
```json
[
  {
    "id": "google-free",
    "name": "Google Translate (Free)",
    "providerType": "google",
    "isActive": true,
    "isDefault": true,
    "settings": {}
  },
  {
    "id": "mineru-shared",
    "name": "MinerU Parser",
    "providerType": "mineru",
    "isActive": true,
    "isDefault": false,
    "settings": {
      "model_version": "vlm"
    }
  }
]

```

> **Note:** MinerU providers omit their `api_token` field in this response. Tokens remain securely stored in the backend, but clients still reference the provider ID when submitting parsing tasks.

### PATCH /api/admin/users/{id}

Update user fields. Supports `name`, `email`, `password`, `role`, `isActive`, `dailyPageLimit`, and `groupId`.

```json
{
  "name": "Jane",
  "email": "jane@example.com",
  "password": "optional-new-password", // omit or empty to keep unchanged
  "role": "user",
  "isActive": true,
  "dailyPageLimit": 100,
  "groupId": "default" // or empty string to clear
}
```

Email must be unique; attempting to set an existing email returns `400 Bad Request`.

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

### POST /api/tasks/batch

Upload multiple PDFs at once. Every file becomes its own task but shares the same language/provider settings.

**Request (multipart/form-data):**
```
files[]: <PDF file 1>
files[]: <PDF file 2>
documentNames: ["Doc 1", "Doc 2"]
sourceLang: "en"
targetLang: "zh"
engine: "openai"
providerConfigId: "<provider UUID>"
priority: "normal"
notes: "Optional notes"
modelConfig: "{\"api_key\": \"...\"}" (optional JSON string)
```

_2025-11-09 更新：批量上传会正确携带 `providerConfigId`，确保所选翻译服务（含第三方 OpenAI 代理）与单任务行为保持一致。_

**Response (201 Created):**
```json
{
  "count": 2,
  "tasks": [
    { "id": "task_a1", "...": "..." },
    { "id": "task_b2", "...": "..." }
  ]
}
```

If any validation fails (e.g., mismatch between `files[]` and `documentNames` length), the entire request is rejected so you can fix inputs in one go.

---

### GET /api/tasks

Get list of tasks for the current user.

_Tip_: 前端仪表盘每隔 4 秒调用该接口刷新任务列表，因此也可用于 CLI 或 Postman 中的实时轮询。

_2025-11-09 更新：后端重启后会自动将上次停在 `processing` 状态的任务重置为 `queued` 并重新入队。客户端无需额外操作即可在列表/WS 更新中看到任务继续执行。_

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
    "progressMessage": "段落排版 · Part 2/3",
    "outputUrl": "https://s3.../translated.pdf",
    "dualOutputUrl": "https://s3.../dual.pdf",
    "monoOutputUrl": "https://s3.../mono.pdf",
    "glossaryOutputUrl": "https://s3.../glossary.csv",
    "zipOutputUrl": "https://s3.../output.zip",
    "markdownOutputUrl": "https://s3.../output.md",
    "createdAt": "2025-11-08T12:00:00Z",
    "updatedAt": "2025-11-08T12:30:00Z"
  }
]
```

> **2025-11-11** – Responses now expose `zipOutputUrl` for MinerU parsing tasks so clients can download the original ZIP (with `images/`) directly. `markdownOutputUrl` already points inline image links to tenant-owned S3 URLs, so previews stay intact even if the ZIP is never downloaded.

---

### GET /api/tasks/{id}

Get details of a specific task.

_Use case_: 在前端“任务详情”面板或调试工具中，结合轮询可以获取单个任务的实时进度与错误信息。

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
  "progressMessage": "结果上传完成",
  "outputUrl": "https://s3.../translated.pdf",
  "dualOutputUrl": "https://s3.../dual.pdf",
  "monoOutputUrl": "https://s3.../mono.pdf",
  "glossaryOutputUrl": "https://s3.../glossary.csv",
  "zipOutputUrl": "https://s3.../output.zip",
  "markdownOutputUrl": "https://s3.../output.md",
  "createdAt": "2025-11-08T12:00:00Z",
  "updatedAt": "2025-11-08T12:30:00Z"
}
```

**Errors:**
- `404 Not Found`: Task not found or not owned by user

---

### WS /api/tasks/ws

建立 WebSocket 连接以获取属于当前登录用户的任务实时更新。握手时需要携带认证 Cookie（或在查询参数 `token` 中附带后端签发的 Session Token）。

**Event Payload:**
```json
{
  "type": "task.update",
  "task": {
    "id": "task_456",
    "documentName": "My Document",
    "status": "processing",
    "progress": 45,
    "progressMessage": "分段排版 · Part 1/3",
    "dualOutputUrl": null,
    "monoOutputUrl": null
  }
}
```

**Notes:**
- 服务端会在任务创建、状态/进度变化、完成、失败、取消时推送 `task.update`。
- 客户端无需发送任何消息即可保持连接；若断开可按需重连，后端仍会推送最新状态。
- 在没有 WebSocket 能力的环境下，仍可使用 `GET /api/tasks` 做轮询。

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

### DELETE /api/tasks/{id}

Delete any task you own (queued/processing tasks are canceled and removed before deletion). All related S3 files are deleted together, including:
- input PDF
- mono/dual/glossary outputs
- markdown and zip artifacts (parsing / parse+translate)
- MinerU mirrored images under `mineru/{mineruTaskId}/images/`

_2025-11-09 更新：新增批量删除任务支持，前端可通过复选框选择任意状态的任务。_
_2025-11-11 更新：删除任务时会清理 `outputs/{ownerId}/{taskId}/` 与 `mineru/{mineruTaskId}/` 前缀下的所有对象（包含 ZIP 与 images 目录），避免残留文件。_

**Response (204 No Content)**

**Errors:**
- `404 Not Found`: Task not found or not owned by user

---

### GET /api/tasks/{id}/download

Download the translated PDF file (defaults to the dual-language output when available). Prefer the `monoOutputUrl` / `dualOutputUrl` fields from task responses for direct downloads of the specific variant.

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
  "name": "OpenAI GPT-4",
  "providerType": "openai",
  "description": "OpenAI GPT-4 translation service",
  "isActive": true,
  "isDefault": false,
  "settings": {
    "api_key": "sk-...",
    "base_url": "https://api.openai.com/v1",
    "model": "gpt-4",
    "max_concurrency": 4
  }
}
```

**Provider Settings by Type:**

All providers support these common settings:
- `max_concurrency` (optional, 1-100, default: 4): Maximum concurrent translation tasks
- `requests_per_minute` (optional, 1-10000): API rate limit in requests per minute
- `model` (optional): Model name to use for translation

Provider-specific settings:
- **openai**: `api_key`, `base_url`, `model`, `max_concurrency`, `requests_per_minute`
- **azure_openai**: `api_key`, `endpoint`, `deployment_name`, `model`, `max_concurrency`, `requests_per_minute`
- **deepl**: `api_key`, `endpoint`, `max_concurrency`, `requests_per_minute`
- **ollama**: `endpoint`, `model`, `max_concurrency`, `requests_per_minute`
- **tencent**: `secret_id`, `secret_key`, `max_concurrency`, `requests_per_minute`
- **mineru**: `api_token` (required), `model_version` (defaults to `vlm`), `max_concurrency`, `requests_per_minute`
- **gemini, deepseek, zhipu, siliconflow, grok, groq**: `api_key`, `endpoint`, `model`, `max_concurrency`, `requests_per_minute`

> **2025-11-10** – MinerU provider settings now persist `api_token`/`model_version`. After updating the backend, open **Admin → Provider**, edit your MinerU entry, and re-save to ensure the token is stored。

> **2025-11-09** – The backend now feeds these credentials directly into pdf2zh-next's mandatory `translate_engine_settings`. Provider settings saved in **Admin → Provider** are automatically merged with any per-task `modelConfig` overrides (task-level keys win). Always include the required keys (or set the matching environment variables such as `OPENAI_API_KEY`, `DEEPL_AUTH_KEY`, `AZURE_OPENAI_API_KEY`, `TENCENT_SECRET_ID`, `TENCENT_SECRET_KEY`) to avoid validation errors like `translate_engine_settings -> Field required`.
> 
> Example payload that satisfies the new requirement:
> ```json
> {
>   "name": "OpenAI GPT-4",
>   "providerType": "openai",
>   "description": "OpenAI GPT-4 translation service",
>   "isActive": true,
>   "isDefault": false,
>   "settings": {
>     "api_key": "sk-***",
>     "base_url": "https://api.openai.com/v1",
>     "model": "gpt-4o-mini",
>     "max_concurrency": 4
>   }
> }
> ```

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

## Admin - System Settings

**All endpoints require `admin` role.**

### GET /api/admin/settings/s3

Get S3 storage configuration.

> **Note:** The backend now reads S3 configuration exclusively from the database. Environment variables such as `PDF_APP_S3_*` are ignored, so use this endpoint (or the Admin UI) to inspect/update the active values.

**Response (200 OK):**
```json
{
  "endpoint": "https://s3.amazonaws.com",
  "access_key": "AKIA****",
  "bucket": "pdftranslate",
  "region": "us-east-1",
  "ttl_days": 7
}
```

**Note:** The `access_key` is masked for security (only first 4 characters shown). The `secret_key` is never returned.

---

### PUT /api/admin/settings/s3

Update S3 storage configuration.

**Request:**
```json
{
  "endpoint": "https://s3.amazonaws.com",
  "access_key": "AKIAIOSFODNN7EXAMPLE",
  "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  "bucket": "pdftranslate",
  "region": "us-east-1",
  "ttl_days": 7
}
```

**Fields:**
- `endpoint` (optional): S3 endpoint URL. Leave empty for AWS S3, or provide custom endpoint for S3-compatible services
- `access_key` (required): AWS Access Key ID or equivalent
- `secret_key` (required): AWS Secret Access Key or equivalent
- `bucket` (required): S3 bucket name
- `region` (optional, default: "us-east-1"): AWS region
- `ttl_days` (optional, default: 7, range: 1-365): Number of days before files are automatically deleted (computed from each object's `LastModified` timestamp + TTL; no S3 object tagging required, works with MinIO and other compatible services)

**Response (200 OK):**
```json
{
  "message": "S3 configuration updated successfully"
}
```

---

### POST /api/admin/settings/s3/test

Test S3 connection with provided credentials.

**Request:**
```json
{
  "endpoint": "https://s3.amazonaws.com",
  "access_key": "AKIAIOSFODNN7EXAMPLE",
  "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  "bucket": "pdftranslate",
  "region": "us-east-1",
  "ttl_days": 7
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "S3 connection successful"
}
```

**Response (200 OK - Failed):**
```json
{
  "success": false,
  "message": "S3 connection failed: The specified bucket does not exist"
}
```

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
**Last Updated:** 2025-11-10
## Admin - Group Management

### GET /api/admin/groups

List groups.

Response:
```json
[
  { "id": "default", "name": "Default Group", "createdAt": "2025-11-10T10:00:00Z" }
]
```

### POST /api/admin/groups

Create a group.

Request:
```json
{ "name": "Team A" }
```
Response:
```json
{ "id": "<uuid>", "name": "Team A", "createdAt": "..." }
```

### GET /api/admin/groups/{groupId}/access

List provider access mappings for a group (sorted by `sortOrder`, then `createdAt`).

Response (200 OK):
```json
[
  { "id": "map_1", "groupId": "default", "providerConfigId": "mineru-shared", "sortOrder": 0, "createdAt": "..." },
  { "id": "map_2", "groupId": "default", "providerConfigId": "openai-proxy", "sortOrder": 1, "createdAt": "..." }
]
```

### POST /api/admin/groups/{groupId}/access

Grant a provider to the group.

Request:
```json
{ "providerConfigId": "<provider UUID>", "sortOrder": 0 }
```

Response (201 Created):
```json
{ "id": "map_1", "groupId": "default", "providerConfigId": "<provider UUID>", "sortOrder": 0, "createdAt": "..." }
```

Errors:
- 404 if group or provider not found
- 400 if already granted

### DELETE /api/admin/groups/{groupId}/access/{providerId}

Revoke a provider from the group.

Response: `204 No Content`

### POST /api/admin/groups/{groupId}/access/reorder

Reorder providers for a group. The array index becomes the new `sortOrder`.

Request:
```json
{ "providerIds": ["mineru-shared", "openai-proxy"] }
```

Response:
```json
{ "ok": true }
```
## Admin - Settings

All settings endpoints require admin privileges.

### GET /api/admin/settings/system

Returns system settings.

**Response (200 OK):**
```json
{ "allowRegistration": false }
```

### PUT /api/admin/settings/system

Update system settings.

**Request:**
```json
{ "allowRegistration": true }
```

---

### GET /api/admin/settings/email

Returns email (SMTP) configuration. The SMTP password is never returned.

**Response (200 OK):**
```json
{
  "smtpHost": "smtp.example.com",
  "smtpPort": 587,
  "smtpUsername": "no-reply",
  "smtpUseTLS": true,
  "smtpFromEmail": "no-reply@example.com",
  "allowedEmailSuffixes": ["@company.com", "@org.org"]
}
```

### PUT /api/admin/settings/email

Updates email (SMTP) configuration. Provide only fields you want to change. When setting `smtpPassword`, pass the new value; omit the field to keep unchanged.

**Request:**
```json
{
  "smtpHost": "smtp.example.com",
  "smtpPort": 587,
  "smtpUsername": "no-reply",
  "smtpPassword": "app-password",
  "smtpUseTLS": true,
  "smtpFromEmail": "no-reply@example.com",
  "allowedEmailSuffixes": ["@company.com", "@org.org"]
}
```
