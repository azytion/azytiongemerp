import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            networkMode: 'always', // Allow queries even if offline

            // Data stays fresh for this duration before refetching
            staleTime: 1000 * 20, // 20 seconds default

            // Cache data for this duration
            gcTime: 1000 * 60 * 5, // 5 minutes (formerly cacheTime)

            // Refetch on window focus
            refetchOnWindowFocus: true,

            // Refetch on reconnect
            refetchOnReconnect: true,

            // Retry failed requests
            retry: 1,

            // Refetch interval for critical data (can be overridden per query)
            refetchInterval: false, // Set per query
        },
        mutations: {
            networkMode: 'always', // Allow mutations even if offline
            // Retry failed mutations once
            retry: 1,
        },
    },
});
