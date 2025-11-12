'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '@/lib/types/user';
import type { ProviderConfig } from '@/lib/types/provider';

function buildWebSocketUrl(path: string): string | null {
  if (typeof window === 'undefined') return null;

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
            // 直接更新缓存,避免重新请求
            if (message.type === 'provider.created') {
              queryClient.setQueryData(['admin', 'providers'], (old: ProviderConfig[] = []) =>
                [...old, message.provider]
              );
            } else if (message.type === 'provider.updated') {
              queryClient.setQueryData(['admin', 'providers'], (old: ProviderConfig[] = []) =>
                old.map(p => p.id === message.provider.id ? message.provider : p)
              );
            } else if (message.type === 'provider.deleted') {
              queryClient.setQueryData(['admin', 'providers'], (old: ProviderConfig[] = []) =>
                old.filter(p => p.id !== message.providerId)
              );
            }
          } else if (resource === 'users') {
            // 直接更新缓存,避免重新请求
            if (message.type === 'user.created') {
              queryClient.setQueryData(['admin', 'users'], (old: User[] = []) =>
                [...old, message.user]
              );
            } else if (message.type === 'user.updated') {
              queryClient.setQueryData(['admin', 'users'], (old: User[] = []) =>
                old.map(u => u.id === message.user.id ? message.user : u)
              );
            } else if (message.type === 'user.deleted') {
              queryClient.setQueryData(['admin', 'users'], (old: User[] = []) =>
                old.filter(u => u.id !== message.userId)
              );
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
