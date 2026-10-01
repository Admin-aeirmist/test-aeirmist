// ============================================================
// All imports MUST be at the top of the file (ESM standard)
// ============================================================
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/ui/OfflineBanner.tsx';
import { logger } from '@/src/utils/logger';
import { PermissionManager } from './components/ui/PermissionManager';
import { ResonanceTracker } from './components/ResonanceTracker';
import { SEO } from './components/ui/SEO';
import { applyDeviceOptimizations } from './utils/deviceTier';
import App from './App.tsx';
import './services/authHelpers';
import { securityShield } from './services/SecurityShieldService';
import './index.css';

// Initialize in-app runtime security barrier
securityShield.initialize();

// Apply adaptive optimizations for Android and budget/low-RAM devices early
applyDeviceOptimizations();

// ============================================================
// Register Service Worker for PWA/TWA support (Bypass on Native Capacitor)
// ============================================================
const isNativeCapacitor = typeof window !== 'undefined' && Boolean(
  (window as any).Capacitor?.isNativePlatform?.() || 
  navigator?.userAgent?.includes('Capacitor') ||
  /Android.*(wv|Mobile)/i.test(navigator?.userAgent)
);

if (typeof window !== 'undefined' && isNativeCapacitor) {
  document.documentElement.classList.add('is-native-app');
  const curSat = getComputedStyle(document.documentElement).getPropertyValue('--sat');
  if (!curSat || curSat.trim() === '' || curSat.trim() === '0px') {
    document.documentElement.style.setProperty('--sat', '38px');
    document.documentElement.style.setProperty('--sab', '16px');
  }
  import('./utils/nativeSettings').then(({ NativeSettings }) => {
    NativeSettings.getSystemInsets().then(insets => {
      if (insets && insets.top > 0) {
        document.documentElement.style.setProperty('--sat', `${insets.top}px`);
        document.documentElement.style.setProperty('--safe-area-inset-top', `${insets.top}px`);
      }
      if (insets && insets.bottom > 0) {
        document.documentElement.style.setProperty('--sab', `${insets.bottom}px`);
        document.documentElement.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`);
      }
    }).catch(() => {});
  }).catch(() => {});
}

if ('serviceWorker' in navigator && !isNativeCapacitor) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          logger.info('Service Worker registered successfully with scope:', registration.scope);
        })
        .catch((error) => {
          logger.warn('Service Worker registration failed:', error);
        });
    } catch (error) {
      logger.warn('Error during Service Worker registration setup:', error);
    }
  });
}

// ============================================================
// Safe Storage Polyfill for iFrame / Sandbox Environments
// ============================================================
(function() {
  if (typeof window === 'undefined') return;

  function createInMemoryStorage() {
    let store: Record<string, string> = {};
    return {
      getItem(key: string) {
        return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
      },
      setItem(key: string, value: string) {
        store[key] = String(value);
      },
      removeItem(key: string) {
        delete store[key];
      },
      clear() {
        store = {};
      },
      get length() {
        return Object.keys(store).length;
      },
      key(index: number) {
        return Object.keys(store)[index] || null;
      }
    };
  }

  // Test and polyfill localStorage
  let localCacheStore: any = null;
  function getLocalCache() {
    if (!localCacheStore) {
      localCacheStore = createInMemoryStorage();
    }
    return localCacheStore;
  }

  try {
    const test = window.localStorage;
    const testKey = '__storage_test__';
    test.setItem(testKey, testKey);
    test.removeItem(testKey);
  } catch (e) {
    logger.warn("[Storage Polyfill] localStorage is blocked or throws error. Activating safe in-memory fallback.", e);
    try {
      Object.defineProperty(window, 'localStorage', {
        value: getLocalCache(),
        writable: true,
        configurable: true
      });
    } catch (err) {
      try {
        Object.defineProperty(Window.prototype, 'localStorage', {
          get: function() {
            return getLocalCache();
          },
          configurable: true
        });
      } catch (err2) {
        logger.error("[Storage Polyfill] Failed to polyfill localStorage on Window.prototype.", err2);
      }
    }
  }

  // Test and polyfill sessionStorage
  let sessionCacheStore: any = null;
  function getSessionCache() {
    if (!sessionCacheStore) {
      sessionCacheStore = createInMemoryStorage();
    }
    return sessionCacheStore;
  }

  try {
    const test = window.sessionStorage;
    const testKey = '__session_test__';
    test.setItem(testKey, testKey);
    test.removeItem(testKey);
  } catch (e) {
    logger.warn("[Storage Polyfill] sessionStorage is blocked or throws error. Activating safe in-memory fallback.", e);
    try {
      Object.defineProperty(window, 'sessionStorage', {
        value: getSessionCache(),
        writable: true,
        configurable: true
      });
    } catch (err) {
      try {
        Object.defineProperty(Window.prototype, 'sessionStorage', {
          get: function() {
            return getSessionCache();
          },
          configurable: true
        });
      } catch (err2) {
        logger.error("[Storage Polyfill] Failed to polyfill sessionStorage on Window.prototype.", err2);
      }
    }
  }
})();

// ============================================================
// Centralized Error Handling & Vite HMR Noise Silence
// ============================================================
if (typeof window !== 'undefined') {
  if (import.meta.env.DEV) {
    // Silence development-only Vite HMR websocket noise when developing locally
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('[vite] failed to connect')) {
        return;
      }
      originalWarn.apply(console, args);
    };
  }

  window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('Cannot set property fetch of #<Window>')) {
      logger.warn('Environmental fetch patch warning:', event.error || event.message);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    // Gracefully report quota or network failures while preserving observability
    if (event.reason && (
      event.reason.code === 'quota-exceeded' || 
      String(event.reason).includes('Quota')
    )) {
      logger.warn('Storage quota warning or network pressure:', event.reason);
    } else {
      logger.error('Unhandled Promise Rejection:', event.reason);
    }
  });
}

// ============================================================
// React App Mount
// ============================================================
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <ErrorBoundary>
        <OfflineBanner />
        <App />
      </ErrorBoundary>
    </HelmetProvider>
  </StrictMode>,
);
