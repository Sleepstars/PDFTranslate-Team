'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

function buildWebSocketUrl(path: string): string | null {
  if (typeof window === 'undefined') return null;

  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (envBase) {
    try {
      const baseUrl = new URL(envBase);
      baseUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, '')}${path}`;
      baseUrl.search = '';
      return baseUrl.toString();
    } catch {
      // fall through to window origin
    }
  }

  const { protocol, host } = window.location;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${host}${path}`;
}

export function useAdminUpdates(resource: 'providers' | 'users') {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const reconnectDelay = useRef(1000);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let shouldReconnect = true;

    const path = resource === 'providers' ? '/api/admin/providers/ws' : '/api/admin/users/ws';

    const connect = () => {
      const url = buildWebSocketUrl(path);
      if (!url) return;

      ws = new WebSocket(url);

      ws.onopen = () => {
        reconnectDelay.current = 1000;
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (resource === 'providers') {
            if (message.type === 'provider.created' || message.type === 'provider.updated' || message.type === 'provider.deleted') {
              queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
            }
          } else if (resource === 'users') {
            if (message.type === 'user.created' || message.type === 'user.updated' || message.type === 'user.deleted') {
              queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            }
          }
        } catch (error) {
          console.error(`Failed to parse ${resource} websocket payload`, error);
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
  }, [queryClient, resource]);

  return connected;
}
