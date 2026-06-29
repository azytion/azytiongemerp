import type { Metadata } from "next";
import { Toaster } from 'sonner';
import { ConfirmProvider } from '@/components/ConfirmDialog';
import { QueryProvider } from '@/providers/QueryProvider';
import { SidebarProvider } from '@/components/SidebarProvider';
import { getSession } from '@/app/actions/auth';
import { APP_NAME, APP_TAGLINE } from '@/lib/branding';
import CommandPalette from '@/components/CommandPalette';
import AppShell from '@/components/AppShell';
import OfflineBanner from '@/components/OfflineBanner';
import InstallPWA from '@/components/InstallPWA';
import './globals.css';

import type { Viewport } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: APP_NAME,
    applicationName: APP_NAME,
    description: APP_TAGLINE,
    manifest: '/manifest.json?v=7',
  };
}

export const viewport: Viewport = {
  themeColor: '#D4AF37',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const { warmTimezoneCache } = await import('@/lib/datetime');
  await warmTimezoneCache();

  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <QueryProvider>
          <ConfirmProvider>
            <SidebarProvider>
              <AppShell session={session}>
                {children}
              </AppShell>
            </SidebarProvider>
          </ConfirmProvider>
        </QueryProvider>
        <CommandPalette />
        <OfflineBanner />
        <InstallPWA />
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                var isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
                var isDevelopment = ${process.env.NODE_ENV !== 'production'};
                var clearZationCaches = function() {
                  if (!('caches' in window)) return Promise.resolve();
                  return caches.keys().then(function(keys) {
                    return Promise.all(keys.filter(function(key) {
                      return key.indexOf('zation-') === 0;
                    }).map(function(key) {
                      return caches.delete(key);
                    }));
                  });
                };

                if (isLocalHost || isDevelopment) {
                  Promise.all([
                    navigator.serviceWorker.getRegistrations().then(function(registrations) {
                      return Promise.all(registrations.map(function(reg) {
                        return reg.unregister();
                      }));
                    }),
                    clearZationCaches()
                  ]).then(function() {
                    if (navigator.serviceWorker.controller && !sessionStorage.getItem('zation_sw_refresh_done')) {
                      sessionStorage.setItem('zation_sw_refresh_done', 'true');
                      window.location.reload();
                    }
                  }).catch(function(err) {
                    console.warn('ServiceWorker cleanup failed:', err);
                  });
                  return;
                }

                navigator.serviceWorker.register('/sw.js?v=7').then(function(reg) {
                  // When a new SW is waiting, prompt it to activate immediately
                  reg.addEventListener('updatefound', function() {
                    var newWorker = reg.installing;
                    if (newWorker) {
                      newWorker.addEventListener('statechange', function() {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                          newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                      });
                    }
                  });
                }).catch(function(err) {
                  console.warn('ServiceWorker registration failed:', err);
                });
              });
            }
          `
        }} />
        {/* Toaster must be the LAST child of body — outside every stacking context
            so backdrop-filter on modal overlays cannot trap it */}
        <Toaster
          position="top-right"
          expand={true}
          visibleToasts={6}
          closeButton
          toastOptions={{
            style: {
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              color: 'var(--foreground)',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.875rem',
            },
            classNames: {
              toast: 'sonner-toast-custom',
              title: 'sonner-title-custom',
              description: 'sonner-desc-custom',
            },
          }}
        />
      </body>
    </html>
  );
}
