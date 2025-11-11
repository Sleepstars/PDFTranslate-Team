# Changelog

## 2025-11-11 (DB Auto‑migrate & UUIDv7)

### Fixed
- Startup error when creating tables on fresh databases: `function uuid_generate_v7() does not exist`. Backend now runs Alembic migrations at startup before any schema access.
- Alembic `005` ensures `pgcrypto` is installed (`CREATE EXTENSION IF NOT EXISTS pgcrypto`) so the `uuid_generate_v7()` function can use `gen_random_bytes` reliably.

### Changed
- Backend startup applies `alembic upgrade head` automatically. Manual migration commands remain available for troubleshooting and CI.

## 2025-11-11 (ALTCHA v2 Verification)

### Fixed
- Backend ALTCHA verification now matches the v2 widget payload. The widget returns a base64 JSON with fields: `algorithm`, `challenge`, `number`, `salt`, `signature`, and `took` (no `expires`).
- Server signature is computed and verified using `HMAC(secret, challenge + salt)`, and the numeric solution is validated via `sha256(salt + number) === challenge`.
- This resolves "ALTCHA verification failed" errors when valid payloads are submitted from the v2 widget.

### Notes
- Optional expiration can still be enforced at the server or via widget config, but the payload does not carry `expires` in v2.

## 2025-11-11 (ALTCHA UI Size)

### Changed
- Increased ALTCHA widget prominence across auth pages (login/register/forgot/reset): larger max width, thicker border, rounded corners, and a 1.15x scale for better visibility.
- Colors now follow the app theme via CSS variables.

## 2025-11-11 (Admin Analytics Paths)

### Fixed
- Backend analytics routes now live under `/api/admin/analytics/*` to match frontend calls. Previously, endpoints were registered as `/api/admin/overview`, `/api/admin/daily-stats`, and `/api/admin/top-users`, causing 404s when the UI requested `/api/admin/analytics/*`.
- Preserved the admin all-tasks endpoint at `/api/admin/tasks` (unchanged).

### Docs
- Added "Admin - Analytics" and "Admin - All Tasks" sections to `docs/API_REFERENCE.md`.

## 2025-11-11 (Admin All Tasks Defaults & Filters)

### Changed
- `/api/admin/tasks` now returns all tasks by default (no owner filter) and supports proper pagination with a `total` count matching filters.

### Added
- Support filtering by `ownerEmail` (exact match). Existing camelCase params are accepted: `ownerId`, `ownerEmail`, `dateFrom`, `dateTo`.

### Frontend
- Admin → Tasks uses email as the filter field and consumes the updated `total` for pagination.

## 2025-11-11 (Forgot Password + ALTCHA)

### Added
- Backend: password reset flow with two endpoints:
  - `POST /api/auth/forgot-password` (email reset link; always returns generic success)
  - `POST /api/auth/reset-password` (set new password with token)
- Backend: `password_reset_tokens` table to store single-use, time-limited reset tokens (SHA-256 hashed).
- Alembic `003`: adds `password_reset_tokens` table and indexes; tolerant if table exists from metadata on older runs.
- Backend: simple SMTP email sender using configured system settings.
- Frontend: pages `/(auth)/forgot-password` and `/(auth)/reset-password` with ALTCHA widget integration.

### Changed
- Require ALTCHA verification (when enabled) for login, registration, forgot password, and reset password operations.
- Login page now includes ALTCHA widget when enabled.

### Notes
- Reset tokens expire in 30 minutes and are single-use. SMTP must be configured in Admin → Settings → Email.

## 2025-11-11 (Tasks UI)

### Fixed
- Preserve `inputUrl` in realtime task updates so the "下载原文" button remains visible for in-progress tasks. Previously, WebSocket payloads omitted `inputUrl`, overwriting the initial list data and hiding the original download action until completion.

## 2025-11-11 (Markdown Chunking)

### Changed
- Markdown translation now performs paragraph-based chunking to avoid API length limits across engines (OpenAI, DeepL, googletrans). Text blocks are split by blank lines; all paragraphs translate concurrently; paragraphs exceeding the limit are hard-sliced and their slices are translated concurrently; code fences remain untouched.

### Config
- New optional modelConfig overrides:
  - `max_chars_per_request` (alias `maxCharsPerRequest`, default 4000): per-request size threshold.
  - `max_concurrent_requests` (alias `maxConcurrentRequests`, default 4): per-task local concurrency (paragraphs and slices). A global provider limiter caps combined concurrency.

### Global Provider Concurrency
- Introduced a provider-scoped global concurrency limiter applied across the entire app:
  - Markdown translation chunks acquire slots per request.
  - PDF translation (pdf2zh-next) holds a slot during the engine-bound phase.
  - MinerU parsing wraps task submission and ZIP downloads with the limiter.
  - Limit value is read from Provider settings (keys: `max_concurrent_requests`, `maxConcurrentRequests`, `max_concurrency`, `concurrency`), falling back to reasonable defaults.

### LLM Prompt Unification
- Markdown translation now applies the same translation prompt to all OpenAI‑compatible LLM providers (OpenAI, DeepSeek, Zhipu, Groq, Grok, SiliconFlow) via the Chat Completions API when `api_key` and `base_url` are provided in `modelConfig`.
- Updated prompt to enforce strict paragraph/format preservation, tag awareness, untranslatable content handling, and no extra text in output. Optional additions can be passed via `title_prompt`, `summary_prompt`, `terms_prompt` (camelCase also supported).

### Progress
- Progress within the translation phase now reflects chunk-level progress (e.g., 12/35), mapped into the existing 20%–90% window used by parse-and-translate tasks.

## 2025-11-11 (Batch Tasks)

### Fixed
- `POST /api/tasks/batch` now accepts `taskType` (translation | parsing | parse_and_translate), validates required fields accordingly, and preserves proper HTTP error codes (no longer wraps 4xx into 500). This resolves 500 errors when submitting parsing or parse-and-translate batches with mismatched providers.

### Docs
- Updated `docs/API_REFERENCE.md` to document `taskType` and validation rules for batch uploads.

## 2025-11-11 (Bun Migration)

### Changed
- **前端包管理迁移**：从 npm 迁移到 bun 生态系统
- **依赖管理**：使用 `bun.lock` 替代 `package-lock.json`，提升安装速度
- **构建配置**：更新 pixi.toml 和构建脚本以使用 bun 运行时
- **文档更新**：README 和相关文档已更新以反映新的包管理方式

### Technical
- 前端依赖现在使用 `bun install` 进行安装
- 更新了所有 npm 相关脚本为 `bun run` 格式
- 简化构建脚本，删除 node_modules 冗余支持
- 更新 GitHub CI 流程使用 bun 替代 npm
- 清理冗余的 package-lock.json 文件

## 2025-11-10 (S3 Optional on Read)

### Fixed
- Avoid 500 on `GET /api/tasks` and other read paths when S3 is not configured on fresh startup. Backend now treats S3 as optional for read-only endpoints and surfaces `MissingS3Configuration` internally so routes gracefully return tasks with `null` URL fields instead of failing.

## 2025-11-10 (Admin Settings & User Editing)

### Added
- Admin Settings second-level menu with System, Email, and S3 tabs.
- Backend endpoints to manage system registration toggle and SMTP settings (host/port/username/password/TLS/from/allowed suffixes).
- Admin Users: edit user email and password; backend validates email uniqueness and hashes new passwords.


## 2025-11-10 (Groups)

### Added
- Group-based access control foundation: `groups`, `group_provider_access`, and `users.group_id` (Alembic `008`).
- Server-side enforcement that provider selection is allowed for the user and matches task type (parsing vs translation).
- `/api/users/me/providers` now prefers group-based allowlists and marks the first provider per category as `isDefault`.
- Frontend task dialog auto-selects the first allowed provider per category to reduce user friction.

### Changed
- Alembic `002`: removes legacy `user_provider_access` in favor of `group_provider_access`.
- Seed/init scripts now assign all users to the default group and grant provider access via that group.

### Frontend
- Added Admin → Groups page to manage groups, assign allowed providers, and reorder provider priority per group.
- Sidebar now includes a Groups entry under Admin.

### Docs
- Updated API reference with group access endpoints; README explains group defaults and admin workflow.

## 2025-11-10 (Migrations Squash)

### Changed
- Squashed historical Alembic migrations into a single baseline `001_full_initial.py` for clean redeploys.
- Fresh deployments only need `alembic upgrade head`. Existing databases should be backed up and recreated before applying the new baseline.


## 2025-11-11

### Added
- MinerU parsing tasks now persist a `zipOutputUrl` pointing to the original ZIP (with the `images/` folder) and the dashboard exposes a "Download ZIP" action so assets can be fetched in one click.

### Fixed
- Markdown artifacts returned by parsing workflows now rewrite `images/` links to S3-hosted URLs, ensuring inline previews no longer break when the ZIP is unavailable.
 - Deleting a task now removes all related S3 objects: includes `zipOutput` files, the entire `outputs/{ownerId}/{taskId}/` prefix, and any mirrored MinerU images under `mineru/{mineruTaskId}/`.

## 2025-11-10

### Added
- `/api/users/me/providers` now always returns active MinerU providers (with tokens removed) so PDF parsing can be selected without manual access grants.
- Documented the provider endpoint behavior in `docs/API_REFERENCE.md`.

### Fixed
- Admin `POST/PATCH /api/admin/providers` now validates MinerU settings, so `api_token`/`model_version` persist; re-save MinerU providers once to populate the missing token.
- MinerU parsing workflows share a single credential resolver and now pass the configured `model_version` to the MinerU client, preventing "API token not configured" crashes when provider data is incomplete.

## 2025-11-10 (UI)

### Fixed
- Dashboard action menus now render in a Portal (`position: fixed`) so they break out of scroll containers and overlay above content. Also reserved space for the vertical scrollbar via `scrollbar-gutter-stable` to avoid icons being overlapped at the far right.
