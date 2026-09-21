'use client';

import { useEffect } from 'react';

function setIcon(rel: string, href: string) {
  const selector = `link[rel="${rel}"]`;
  let link = document.head.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
}

export default function BrandingHead() {
  useEffect(() => {
    fetch('/api/settings/app', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(settings => {
        if (!settings) return;
        if (settings.app_name) document.title = settings.app_name;
        // This bundled icon is intentionally not read from app settings. It is
        // reliable on first load, offline, and before the settings API responds.
        const iconUrl = '/azytion-app-icon-512.png';
        setIcon('icon', iconUrl);
        setIcon('shortcut icon', iconUrl);
        setIcon('apple-touch-icon', iconUrl);
      })
      .catch(() => {});
  }, []);

  return null;
}
