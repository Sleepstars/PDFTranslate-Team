'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Task, TaskSocketMessage, TasksListResponse } from '@/lib/types/task';

const DEFAULT_FILTERS = {
  status: null,
  engine: null,
  priority: null,
  date_from: null,
  date_to: null,
};

function buildWebSocketUrl(): string | null {
  if (typeof window === 'undefined') return null;

  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (envBase) {
    try {
      const baseUrl = new URL(envBase);
      baseUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, '')}/tasks/ws`;
      baseUrl.search = '';
      return baseUrl.toString();
    } catch {
      // fall through to window origin
    }
  }

  const { protocol, host } = window.location;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${host}/api/tasks/ws`;
}

function upsertTask(existing: TasksListResponse | undefined, updated: Task): TasksListResponse {
  if (!existing) {
    return {
      tasks: [updated],
      total: 1,
      limit: 50,
      offset: 0,
      filters: { ...DEFAULT_FILTERS },
    };
  }

  const tasks = existing.tasks ?? [];
  const index = tasks.findIndex((task) => task.id === updated.id);

  // Merge with existing to avoid losing stable fields (e.g., inputUrl from S3)
  const nextTasks = index === -1
    ? [updated, ...tasks]
    : tasks.map((task) => {
        if (task.id !== updated.id) return task;
        const merged: Task = { ...task, ...updated };
        // Preserve previously known inputUrl when websocket update omits it
        if (!updated.inputUrl && task.inputUrl) {
          merged.inputUrl = task.inputUrl;
        }
        return merged;
      });
  const currentTotal = typeof existing.total === 'number' ? existing.total : tasks.length;
  const total = index === -1 ? currentTotal + 1 : currentTotal;

  return {
    ...existing,
    tasks: nextTasks,
    total,
  };
}

export function useTaskUpdates() {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const reconnectDelay = useRef(1000);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let shouldReconnect = true;

    const connect = () => {
      const url = buildWebSocketUrl();
      if (!url) {
        return;
      }

      ws = new WebSocket(url);

      ws.onopen = () => {
        reconnectDelay.current = 1000;
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message: TaskSocketMessage = JSON.parse(event.data);
          if (message.type === 'task.update') {
            queryClient.setQueryData<TasksListResponse | undefined>(['tasks'], (prev) => upsertTask(prev, message.task));
          }
        } catch (error) {
          console.error('Failed to parse task websocket payload', error);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!shouldReconnect) return;
        retryTimer = setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 10000);
          connect();
        }, reconnectDelay.current);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      setConnected(false);
      if (retryTimer) clearTimeout(retryTimer);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [queryClient]);

  return connected;
}
