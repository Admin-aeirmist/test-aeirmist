import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isProd = mode === 'production';
  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    define: {
    },
    esbuild: isProd ? {
      drop: ['debugger'],
    } : {},
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    build: {
      target: 'esnext',
      sourcemap: !isProd, // Disable in production (security: don't expose source)
      // Strip console.log/debug/info and debugger statements from production builds.
      // console.error and console.warn are kept so real runtime problems are still visible.
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'motion-vendor': ['motion/react'],
            'lucide-vendor': ['lucide-react'],
            'emoji-vendor': ['emoji-picker-react'],
            'charts-vendor': ['recharts'],
            'stripe-vendor': ['@stripe/stripe-js'],
            'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          }
        }
      }
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
