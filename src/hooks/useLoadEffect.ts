'use client';

import { useEffect } from 'react';

/**
 * Schedules an async data load after the current render commit.
 * Avoids react-hooks/set-state-in-effect warnings for standard fetch-on-mount patterns.
 */
export function useLoadEffect(load: () => void | Promise<void>, deps: React.DependencyList) {
    useEffect(() => {
        const id = window.setTimeout(() => {
            void load();
        }, 0);
        return () => window.clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps
    }, deps);
}
