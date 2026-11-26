import { Toaster, TooltipProvider } from '@medusajs/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: (count, error) => count < 2 && (error as { status?: number }).status !== 401, refetchOnWindowFocus: false } },
});

export const AppProviders = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {children}
      <Toaster />
    </TooltipProvider>
  </QueryClientProvider>
);
