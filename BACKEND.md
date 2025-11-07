# PDFTranslate Backend

FastAPI service that powers authentication and translation task orchestration for the PDFTranslate Team portal.

## Features
- Cookie-based session auth with configurable admin credentials
- REST APIs for login/logout/session check and task CRUD
- In-memory task queue + async worker that simulates BabelDOC execution
- Ready-to-replace hook (`app/utils/babeldoc.py`) for invoking real BabelDOC/PDFMathTranslate jobs

## Run locally
```bash
# 推荐：使用 pixi
pixi run start-backend

# 或使用 uv/pip
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

> Using [uv](https://github.com/astral-sh/uv) is recommended if Pixi is unavailable.

## Environment variables
| Var | Description | Default |
| --- | --- | --- |
| `PDF_APP_ADMIN_EMAIL` | Login email | `admin@example.com` |
| `PDF_APP_ADMIN_PASSWORD` | Login password | `changeme` |
| `PDF_APP_ADMIN_NAME` | Display name | `PDF Admin` |
| `PDF_APP_ADMIN_ID` | Internal user id | `admin` |
| `PDF_APP_SESSION_COOKIE_NAME` | Cookie key | `pdftranslate_session` |
| `PDF_APP_SESSION_TTL_SECONDS` | Session TTL | `43200` |
| `PDF_APP_SESSION_COOKIE_SECURE` | Cookie secure 标志 | `false` |
| `PDF_APP_CORS_ORIGINS` | JSON list of allowed origins | `["http://localhost:3000"]` |

Add them to `.env.backend` (project root) or provide via Docker/Compose.
