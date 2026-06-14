'use client';

import { useEffect } from 'react';

/**
 * Service Worker Registration Component
 * 
 * Registers the PWA service worker AFTER the initial DOM paint
 * to avoid blocking any UI rendering or wallet connector initialization.
 * 
 * This component renders nothing — it's purely a lifecycle side-effect.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        // Listen for new service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'activated' &&
              navigator.serviceWorker.controller
            ) {
              // New version activated — the user will get it on next navigation
              console.log('[ArcOmni PWA] New version ready.');
            }
          });
        });

        console.log('[ArcOmni PWA] Service Worker registered successfully.');
      } catch (error) {
        console.warn('[ArcOmni PWA] Service Worker registration failed:', error);
      }
    };

    // Defer registration until after the window load event
    // This ensures the initial paint, Web3 providers, and wallet
    // connectors are fully initialized before SW takes over fetch
    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW, { once: true });
    }

    // Cleanup: handle controller changes gracefully
    const onControllerChange = () => {
      console.log('[ArcOmni PWA] Controller changed — new SW active.');
    };

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      onControllerChange
    );

    return () => {
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange
      );
    };
  }, []);

  // Renders nothing — pure side-effect component
  return null;
}
