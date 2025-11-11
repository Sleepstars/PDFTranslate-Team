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
7. [Admin - Analytics](#admin---analytics)
8. [Admin - All Tasks](#admin---all-tasks)
9. [Admin - Settings](#admin---settings)
10. [Error Responses](#error-responses)

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

Note on ALTCHA (when enabled):
- Include `altchaPayload` from the ALTCHA v2 widget in the request body:
  ```json
  {
    "email": "admin@example.com",
    "password": "admin123",
    "altchaPayload": "<base64 JSON>"
  }
  ```
- The payload decodes to JSON fields: `algorithm`, `challenge`, `number`, `salt`, `signature`, `took` (v2 does not include `expires`).
- Server verification: `sha256(salt + number) == challenge` and `HMAC(secret, challenge + salt) == signature`.

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
taskType: "translation" | "parsing" | "parse_and_translate" (default: "translation")
sourceLang: "en"          # required when taskType is translation/parse_and_translate
targetLang: "zh"           # required when taskType is translation/parse_and_translate
engine: "openai"           # required when taskType is translation/parse_and_translate; for parsing usually "mineru"
providerConfigId: "<provider UUID>"  # required; must match taskType category
priority: "normal"
notes: "Optional notes"
modelConfig: "{\"model\": \"gpt-4o-mini\"}" (optional JSON string)
```

Notes:
- When `taskType` is `parsing`, `providerConfigId` must be a MinerU provider and `sourceLang/targetLang/engine` are not required.
- When `taskType` is `parse_and_translate`, `providerConfigId` must be a non-MinerU provider used for the translation phase; MinerU credentials are resolved automatically from active providers.

_2025-11-11 更新：批量上传新增 `taskType` 参数，并修复了将客户端 4xx 错误错误包装为 500 的问题。_

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

If any validation fails (e.g., mismatch between `files[]` and `documentNames` length), the entire request is rejected (returns 4xx) so you can fix inputs in one go.

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

> 2025-11-11 – Markdown translation now uses paragraph-based chunking to avoid API length limits. Text blocks are split by blank lines while fenced code blocks are preserved as-is. All paragraphs are translated concurrently (and paragraphs longer than the limit are hard-sliced and those slices are translated concurrently as well, then reassembled in order). Tune via:
> - `modelConfig.max_chars_per_request` (alias `maxCharsPerRequest`, default `4000`)
> - `modelConfig.max_concurrent_requests` (alias `maxConcurrentRequests`, default `4`) – local concurrency per task; a global provider-level limiter caps combined concurrency across all tasks.
> - For OpenAI‑compatible LLM providers (OpenAI, DeepSeek, Zhipu, Groq, Grok, SiliconFlow), the translator uses a unified prompt and the Chat Completions API. Supply `api_key` and `base_url` in `modelConfig` for these services.
> Progress reflects chunk-level status during the translation phase.

> Note (2025-11-10): If S3 is not configured yet (fresh startup), this endpoint still returns successfully, but URL fields such as `inputUrl`, `outputUrl`, `monoOutputUrl`, `dualOutputUrl`, `glossaryOutputUrl`, `zipOutputUrl`, and `markdownOutputUrl` will be `null`.

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

> Note (2025-11-10): When S3 is not configured, URL fields in the task payload will be `null`, but the endpoint still returns task metadata.

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

**All endpoints require `admin` role.**

### GET /api/admin/groups

List all groups with statistics.

**Response (200 OK):**
```json
[
  {
    "id": "default",
    "name": "Default Group",
    "createdAt": "2025-11-10T10:00:00Z",
    "userCount": 5,
    "providerCount": 3
  },
  {
    "id": "team-a-uuid",
    "name": "Team A",
    "createdAt": "2025-11-11T08:00:00Z",
    "userCount": 2,
    "providerCount": 1
  }
]
```

---

### POST /api/admin/groups

Create a new group.

**Request:**
```json
{
  "name": "Team A"
}
```

**Response (201 Created):**
```json
{
  "id": "<uuid>",
  "name": "Team A",
  "createdAt": "2025-11-11T08:00:00Z",
  "userCount": 0,
  "providerCount": 0
}
```

**Errors:**
- `400 Bad Request`: Invalid data or name already exists

---

### PATCH /api/admin/groups/{groupId}

Update (rename) a group.

**Request:**
```json
{
  "name": "Team A - Updated"
}
```

**Response (200 OK):**
```json
{
  "id": "<uuid>",
  "name": "Team A - Updated",
  "createdAt": "2025-11-11T08:00:00Z",
  "userCount": 2,
  "providerCount": 1
}
```

**Errors:**
- `404 Not Found`: Group not found
- `400 Bad Request`: Cannot rename the default group

---

### DELETE /api/admin/groups/{groupId}

Delete a group. The group must have no users assigned before deletion.

**Response (204 No Content)**

**Errors:**
- `404 Not Found`: Group not found
- `400 Bad Request`: Cannot delete the default group, or group has users assigned

**Notes:**
- Users must be reassigned to another group before deleting
- Provider access mappings are automatically deleted (CASCADE)

---

### POST /api/admin/groups/{targetGroupId}/merge

Merge multiple groups into a target group. Source groups are deleted after merge.

**Request:**
```json
{
  "sourceGroupIds": ["group-uuid-1", "group-uuid-2"]
}
```

**Response (200 OK):**
```json
{
  "id": "target-group-uuid",
  "name": "Target Group",
  "createdAt": "2025-11-10T10:00:00Z",
  "userCount": 10,
  "providerCount": 5
}
```

**Behavior:**
- All users from source groups are reassigned to the target group
- Provider access is merged (union of all providers)
- If a provider exists in multiple groups, the highest priority (lowest sortOrder) is kept
- Source groups are deleted after successful merge

**Errors:**
- `404 Not Found`: Target group or source group not found
- `400 Bad Request`: Cannot merge a group into itself, or cannot merge the default group

---

### GET /api/admin/groups/{groupId}/access

List provider access mappings for a group (sorted by `sortOrder`, then `createdAt`).

**Response (200 OK):**
```json
[
  {
    "id": "map_1",
    "groupId": "default",
    "providerConfigId": "mineru-shared",
    "sortOrder": 0,
    "createdAt": "2025-11-10T10:00:00Z"
  },
  {
    "id": "map_2",
    "groupId": "default",
    "providerConfigId": "openai-proxy",
    "sortOrder": 1,
    "createdAt": "2025-11-10T10:05:00Z"
  }
]
```

**Errors:**
- `404 Not Found`: Group not found

---

### POST /api/admin/groups/{groupId}/access

Grant a provider to the group.

**Request:**
```json
{
  "providerConfigId": "<provider UUID>",
  "sortOrder": 0
}
```

**Response (201 Created):**
```json
{
  "id": "map_1",
  "groupId": "default",
  "providerConfigId": "<provider UUID>",
  "sortOrder": 0,
  "createdAt": "2025-11-11T10:00:00Z"
}
```

**Errors:**
- `404 Not Found`: Group or provider not found
- `400 Bad Request`: Provider already granted to this group

---

### DELETE /api/admin/groups/{groupId}/access/{providerId}

Revoke a provider from the group.

**Response (204 No Content)**

---

### POST /api/admin/groups/{groupId}/access/reorder

Reorder providers for a group. The array index becomes the new `sortOrder`.

**Request:**
```json
{
  "providerIds": ["mineru-shared", "openai-proxy"]
}
```

**Response (200 OK):**
```json
{
  "ok": true
}
```

**Errors:**
- `404 Not Found`: Group not found

---

## Admin - Analytics

All endpoints require admin role.

### GET /api/admin/analytics/overview

Today's overview metrics.

Response (200 OK):
```json
{
  "todayTranslations": 12,
  "todayPages": 234,
  "totalUsers": 45,
  "activeUsers": 9
}
```

### GET /api/admin/analytics/daily-stats?days=30

Daily translation count and page totals over the last N days (1–365, default 30).

Response (200 OK):
```json
{
  "stats": [
    { "date": "2025-11-01", "translations": 5, "pages": 120 },
    { "date": "2025-11-02", "translations": 7, "pages": 210 }
  ]
}
```

### GET /api/admin/analytics/top-users?limit=10&days=30

Top users by page consumption, optionally limited to the last N days.

Response (200 OK):
```json
{
  "users": [
    {
      "userId": "...",
      "userName": "Alice",
      "userEmail": "alice@example.com",
      "totalPages": 1024,
      "totalTasks": 37
    }
  ]
}
```

---

## Admin - All Tasks

List tasks across all users with filters. Requires admin role.

### GET /api/admin/tasks

Default: returns all tasks (across all users) ordered by newest first.

Query parameters (all optional):
- `ownerId`: filter by user ID (alias: owner_id)
- `ownerEmail`: filter by user email
- `status`: pending | processing | completed | failed | cancelled
- `engine`: engine key/name
- `priority`: normal | high
- `dateFrom` / `dateTo`: ISO date string (e.g. 2025-11-11 or 2025-11-11T00:00:00)
- `limit` (1–500, default 50)
- `offset` (>= 0)

Response (200 OK):
```json
{
  "tasks": [ { "id": "...", "documentName": "...", "ownerId": "...", "ownerEmail": "...", "status": "processing", "priority": "normal", "pageCount": 12, "progress": 45, "createdAt": "..." } ],
  "total": 1,
  "limit": 50,
  "offset": 0,
  "filters": { "ownerId": null, "status": null, "engine": null, "priority": null, "dateFrom": null, "dateTo": null }
}
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
- POST /auth/forgot-password

  Request body:
  {
    "email": "user@example.com",
    "altchaPayload": "<payload>"  // required when ALTCHA is enabled
  }

  Response: always returns 200 with
  {
    "message": "If the email exists, a reset link has been sent."
  }

  Notes:
  - No account enumeration: response does not reveal whether the email exists.
  - Requires SMTP configured in Admin → Settings → Email.
  - Reset tokens expire in 30 minutes.

- POST /auth/reset-password

  Request body:
  {
    "token": "<reset-token>",
    "newPassword": "<new-password>",
    "altchaPayload": "<payload>"  // required when ALTCHA is enabled
  }

  Responses:
  - 200: { "message": "Password has been reset." }
  - 400: invalid/expired token or password too short

  Notes:
  - Tokens are single-use; using a token invalidates it.
  - When ALTCHA is enabled, both forgot/reset operations require a valid ALTCHA payload.
