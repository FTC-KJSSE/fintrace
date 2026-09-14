import { defineConfig } from "vite";

const BACKEND_PORT = process.env.BACKEND_PORT || 3001;

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${BACKEND_PORT}`,
        changeOrigin: true,
      },
    },
  },
});

