import asyncio
from typing import Dict, Set
from fastapi import WebSocket


class TaskWebSocketManager:
    def __init__(self) -> None:
        self._connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(user_id, set()).add(websocket)

    async def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            connections = self._connections.get(user_id)
            if not connections:
                return
            connections.discard(websocket)
            if not connections:
                self._connections.pop(user_id, None)

    async def send_task_update(self, user_id: str, payload: dict) -> None:
        async with self._lock:
            connections = list(self._connections.get(user_id, set()))

        if not connections:
            return

        message = {"type": "task.update", "task": payload}
        dead_connections = []

        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead_connections.append(ws)

        if dead_connections:
            async with self._lock:
                live = self._connections.get(user_id)
                if not live:
                    return
                for ws in dead_connections:
                    live.discard(ws)
                if not live:
                    self._connections.pop(user_id, None)


class AdminWebSocketManager:
    def __init__(self) -> None:
        self._connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def broadcast(self, message_type: str, payload: dict) -> None:
        async with self._lock:
            connections = list(self._connections)

        if not connections:
            return

        message = {"type": message_type, "data": payload}
        dead_connections = []

        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead_connections.append(ws)

        if dead_connections:
            async with self._lock:
                for ws in dead_connections:
                    self._connections.discard(ws)


task_ws_manager = TaskWebSocketManager()
admin_ws_manager = AdminWebSocketManager()
