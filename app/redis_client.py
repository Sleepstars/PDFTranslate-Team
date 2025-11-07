import json
from typing import Optional
import redis.asyncio as redis
from app.config import get_settings

settings = get_settings()

class RedisClient:
    def __init__(self):
        self.redis: Optional[redis.Redis] = None

    async def connect(self):
        self.redis = await redis.from_url(settings.redis_url, decode_responses=True)

    async def disconnect(self):
        if self.redis:
            await self.redis.close()

    async def enqueue_task(self, task_id: str, priority: str = "normal"):
        queue_name = f"tasks:{priority}"
        await self.redis.lpush(queue_name, task_id)

    async def dequeue_task(self, priority: str = "normal") -> Optional[str]:
        queue_name = f"tasks:{priority}"
        task_id = await self.redis.rpop(queue_name)
        return task_id

    async def get_queue_length(self, priority: str = "normal") -> int:
        queue_name = f"tasks:{priority}"
        return await self.redis.llen(queue_name)

    async def set_task_status(self, task_id: str, status: str, ttl: int = 3600):
        await self.redis.setex(f"task_status:{task_id}", ttl, status)

    async def get_task_status(self, task_id: str) -> Optional[str]:
        return await self.redis.get(f"task_status:{task_id}")

redis_client = RedisClient()

async def get_redis():
    return redis_client
