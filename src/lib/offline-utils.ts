/**
 * Check if the application has internet connectivity
 */
export async function isOnline(): Promise<boolean> {
    if (typeof window === 'undefined') {
        // Server-side: always assume online for now
        return true;
    }

    // Check browser's online status
    if (!navigator.onLine) {
        return false;
    }

    // Additional check: try to fetch a lightweight resource
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        await fetch('https://www.google.com/favicon.ico', {
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return true;
    } catch {
        return false;
    }
}

/**
 * Execute a function only if online, otherwise show a warning
 */
export async function executeIfOnline<T>(
    fn: () => Promise<T>,
    offlineMessage: string = 'This feature requires an internet connection'
): Promise<T | null> {
    const online = await isOnline();

    if (!online) {
        console.warn(offlineMessage);
        // You can integrate with your toast notification system here
        if (typeof window !== 'undefined') {
            // Assuming you're using sonner for toasts
            const { toast } = await import('sonner');
            toast.warning(offlineMessage);
        }
        return null;
    }

    return fn();
}

/**
 * Queue an action to be executed when online
 * Useful for email notifications, AI features, etc.
 */
class OfflineQueue {
    private queue: Array<{ fn: () => Promise<any>; name: string }> = [];
    private processing = false;

    add(fn: () => Promise<any>, name: string) {
        this.queue.push({ fn, name });
        console.log(`Queued offline action: ${name}`);
    }

    async processQueue() {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        const online = await isOnline();
        if (!online) {
            console.log('Still offline, queue not processed');
            return;
        }

        this.processing = true;
        console.log(`Processing ${this.queue.length} queued actions...`);

        while (this.queue.length > 0) {
            const item = this.queue.shift();
            if (item) {
                try {
                    await item.fn();
                    console.log(`Completed queued action: ${item.name}`);
                } catch (error) {
                    console.error(`Failed queued action: ${item.name}`, error);
                    // Re-queue if failed
                    this.queue.push(item);
                }
            }
        }

        this.processing = false;
    }

    getQueueLength() {
        return this.queue.length;
    }
}

export const offlineQueue = new OfflineQueue();

// Auto-process queue when coming back online
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('Connection restored, processing offline queue...');
        offlineQueue.processQueue();
    });
}
