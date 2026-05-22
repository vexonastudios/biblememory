'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker for PWA offline support.
 *
 * Update strategy:
 *  1. On every page load, call reg.update() so the browser immediately
 *     checks if sw.js changed (rather than waiting up to 24 h).
 *  2. When a new SW takes control (via skipWaiting + clients.claim),
 *     the 'controllerchange' event fires — we reload the page so the
 *     fresh cache is used right away. This means testers and users
 *     always get new assets within one page load after a deploy.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let reloading = false;

    // Auto-reload the page when a new service worker takes control.
    // This is safe because skipWaiting() + clients.claim() in sw.js
    // means the new SW activates immediately on install, triggering this.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      console.log('[SW] New service worker active — reloading for fresh cache.');
      window.location.reload();
    });

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] Registered, scope:', reg.scope);

        // Immediately check for an updated SW on every page load.
        // Without this, browsers only check once per 24 h by default.
        reg.update().catch(() => {
          // Silently ignore update check failures (e.g. offline)
        });
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
  }, []);

  return null;
}
