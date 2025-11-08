import json
from typing import Optional, List, Dict, Any
import pickle
import redis.asyncio as redis
from app.config import get_settings

settings = get_settings()

class RedisClient:
    def __init__(self):
        self.redis: Optional[redis.Redis] = None
        self.default_ttl = 3600  # 1小时默认TTL

    async def connect(self):
        self.redis = await redis.from_url(settings.redis_url, decode_responses=False)

    async def disconnect(self):
        if self.redis:
            await self.redis.close()

    # 任务队列相关
    async def enqueue_task(self, task_id: str, priority: str = "normal"):
        queue_name = f"tasks:{priority}"
        await self.redis.lpush(queue_name, task_id)

    async def dequeue_task(self, priority: str = "normal") -> Optional[str]:
        queue_name = f"tasks:{priority}"
        task_id = await self.redis.rpop(queue_name)
        return task_id.decode() if task_id else None

    async def get_queue_length(self, priority: str = "normal") -> int:
        queue_name = f"tasks:{priority}"
        return await self.redis.llen(queue_name)

    async def get_all_queues_length(self) -> Dict[str, int]:
        """获取所有队列的长度"""
        lengths = {}
        for priority in ["high", "normal", "low"]:
            queue_name = f"tasks:{priority}"
            lengths[priority] = await self.redis.llen(queue_name)
        return lengths

    async def remove_task_from_all_queues(self, task_id: str):
        """从所有优先级队列中移除指定任务"""
        if not self.redis:
            return
        for priority in ["high", "normal", "low"]:
            queue_name = f"tasks:{priority}"
            await self.redis.lrem(queue_name, 0, task_id)

    # 任务状态缓存
    async def set_task_status(self, task_id: str, status: str, ttl: int = None):
        ttl = ttl or self.default_ttl
        await self.redis.setex(f"task_status:{task_id}", ttl, status)

    async def delete_task_status(self, task_id: str):
        key = f"task_status:{task_id}"
        if self.redis:
            await self.redis.delete(key)

    async def get_task_status(self, task_id: str) -> Optional[str]:
        status = await self.redis.get(f"task_status:{task_id}")
        return status.decode() if status else None

    # 任务列表缓存
    async def cache_user_tasks(self, user_id: str, tasks_data: List[Dict], ttl: int = None):
        """缓存用户任务列表"""
        ttl = ttl or 300  # 5分钟缓存
        cache_key = f"user_tasks:{user_id}"
        await self.redis.setex(cache_key, ttl, pickle.dumps(tasks_data))

    async def get_cached_user_tasks(self, user_id: str) -> Optional[List[Dict]]:
        """获取缓存的用户任务列表"""
        cache_key = f"user_tasks:{user_id}"
        cached = await self.redis.get(cache_key)
        if cached:
            return pickle.loads(cached)
        return None

    async def invalidate_user_tasks_cache(self, user_id: str):
        """失效用户任务缓存"""
        cache_key = f"user_tasks:{user_id}"
        await self.redis.delete(cache_key)

    # 任务详情缓存
    async def cache_task_details(self, task_id: str, task_data: Dict, ttl: int = None):
        """缓存任务详情"""
        ttl = ttl or 600  # 10分钟缓存
        cache_key = f"task_details:{task_id}"
        await self.redis.setex(cache_key, ttl, pickle.dumps(task_data))

    async def get_cached_task_details(self, task_id: str) -> Optional[Dict]:
        """获取缓存的任务详情"""
        cache_key = f"task_details:{task_id}"
        cached = await self.redis.get(cache_key)
        if cached:
            return pickle.loads(cached)
        return None

    async def invalidate_task_details_cache(self, task_id: str):
        """失效任务详情缓存"""
        cache_key = f"task_details:{task_id}"
        await self.redis.delete(cache_key)

    # 统计信息缓存
    async def cache_task_stats(self, user_id: str, stats: Dict, ttl: int = None):
        """缓存任务统计信息"""
        ttl = ttl or 1800  # 30分钟缓存
        cache_key = f"task_stats:{user_id}"
        await self.redis.setex(cache_key, ttl, pickle.dumps(stats))

    async def get_cached_task_stats(self, user_id: str) -> Optional[Dict]:
        """获取缓存的任务统计信息"""
        cache_key = f"task_stats:{user_id}"
        cached = await self.redis.get(cache_key)
        if cached:
            return pickle.loads(cached)
        return None

    async def invalidate_all_user_cache(self, user_id: str):
        """失效用户所有相关缓存"""
        patterns = [
            f"user_tasks:{user_id}",
            f"task_stats:{user_id}"
        ]
        await self.redis.delete(*patterns)

    # 系统性能监控
    async def get_redis_info(self) -> Dict[str, Any]:
        """获取Redis服务器信息"""
        info = await self.redis.info()
        return {
            "used_memory": info.get("used_memory_human"),
            "connected_clients": info.get("connected_clients"),
            "total_commands_processed": info.get("total_commands_processed"),
            "keyspace_hits": info.get("keyspace_hits"),
            "keyspace_misses": info.get("keyspace_misses"),
            "hit_rate": info.get("keyspace_hits", 0) / max(info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0), 1)
        }

    # 批量操作优化
    async def batch_set_task_status(self, task_statuses: List[tuple], ttl: int = None):
        """批量设置任务状态"""
        ttl = ttl or self.default_ttl
        pipe = self.redis.pipeline()
        for task_id, status in task_statuses:
            pipe.setex(f"task_status:{task_id}", ttl, status)
        await pipe.execute()

    async def batch_invalidate_cache(self, keys: List[str]):
        """批量失效缓存"""
        if keys:
            await self.redis.delete(*keys)

redis_client = RedisClient()

async def get_redis():
    return redis_client
