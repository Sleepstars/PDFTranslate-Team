import asyncio
from contextlib import asynccontextmanager
from typing import Dict


_semaphores: Dict[str, asyncio.Semaphore] = {}
_init_lock = asyncio.Lock()


async def _get_or_create_semaphore(key: str, limit: int) -> asyncio.Semaphore:
    # Double-checked locking for async
    sem = _semaphores.get(key)
    if sem is not None:
        return sem
    async with _init_lock:
        sem = _semaphores.get(key)
        if sem is None:
            # limit must be >= 1
            limit = max(1, int(limit or 1))
            sem = asyncio.Semaphore(limit)
            _semaphores[key] = sem
        return sem


@asynccontextmanager
async def acquire(key: str, limit: int):
    """
    Acquire a global, provider-scoped concurrency slot.

    key: provider identifier (e.g., provider_config.id or 'mineru:<id>'/'engine:<name>')
    limit: max concurrent requests allowed for this provider globally
    """
    sem = await _get_or_create_semaphore(key, limit)
    await sem.acquire()
    try:
        yield
    finally:
        sem.release()

