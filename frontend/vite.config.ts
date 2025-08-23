import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

// Health check plugin to keep API alive
const healthCheckPlugin = () => {
  let healthCheckInterval: NodeJS.Timeout;
  
  return {
    name: 'health-check',
    configureServer() {
      // Start health check when dev server starts
      healthCheckInterval = setInterval(async () => {
        try {
          const response = await fetch('https://verificationagent.onrender.com/health', {
            headers: {
              'ngrok-skip-browser-warning': 'true'
            }
          });
          console.log(`Health check: ${response.status} at ${new Date().toISOString()}`);
        } catch (error) {
          console.error(`Health check failed: ${error.message}`);
        }
      }, 600000); // Every 10 minutes (600000ms)
    },
    closeBundle() {
      // Clean up when server stops
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
      }
    }
  };
};

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
    healthCheckPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    include: ["buffer"],
    esbuildOptions: {
      target: "esnext", // Use latest target
    },
  },
  build: {
    target: "esnext", // Support import assertions
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    proxy: {
      '/api': {
        target: 'https://verificationagent.onrender.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
            // Add ngrok headers
            proxyReq.setHeader('ngrok-skip-browser-warning', 'true');
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
});
