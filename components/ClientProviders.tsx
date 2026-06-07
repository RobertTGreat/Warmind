"use client";

import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { SWRConfig } from "swr";
import { DatabaseProvider } from "@/components/DatabaseProvider";

// Lazy load non-critical components to reduce main-thread work
const Toaster = dynamic(
  () => import("sonner").then((mod) => mod.Toaster),
  { ssr: false }
);

// Defer analytics to after page load
const Analytics = dynamic(
  () => import("@vercel/analytics/react").then((mod) => mod.Analytics),
  { ssr: false }
);

const SpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then((mod) => mod.SpeedInsights),
  { ssr: false }
);

export function ClientProviders({ children }: { children?: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 30 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error: any) => {
              const status = error?.response?.status;

              if (status === 401 || status === 403 || status === 404) {
                return false;
              }

              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SWRConfig
        value={{
          revalidateOnFocus: false,
          revalidateOnReconnect: true,
          dedupingInterval: 60_000,
          focusThrottleInterval: 120_000,
          errorRetryCount: 2,
          shouldRetryOnError: (error: any) => {
            const status = error?.response?.status;
            return status !== 401 && status !== 403 && status !== 404;
          },
          onErrorRetry: (error, _key, _config, revalidate, opts) => {
            const status = error?.response?.status;

            if (status === 429) {
              setTimeout(() => revalidate(opts), 10_000);
              return;
            }

            if (opts.retryCount >= 2) return;

            setTimeout(() => revalidate(opts), 2_000);
          },
        }}
      >
        <DatabaseProvider>
          {children}
          <Toaster position="bottom-center" theme="system" closeButton />
          <Analytics />
          <SpeedInsights />
        </DatabaseProvider>
      </SWRConfig>
    </QueryClientProvider>
  );
}

