'use client';

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,      // 5 分钟 - 减少不必要的重新请求
        gcTime: 10 * 60 * 1000,        // 10 分钟 - 缓存保留时间
        refetchOnWindowFocus: false,   // 避免窗口聚焦时自动刷新
        retry: 1,                      // 失败后只重试 1 次
        retryDelay: 1000,              // 重试延迟 1 秒
      },
      mutations: {
        retry: 0,                      // mutation 不重试,避免重复操作
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <Toaster position="top-right" richColors closeButton />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
