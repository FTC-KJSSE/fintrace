import { defineConfig } from "vite";

// Static marketing build. No backend, no proxy — everything on this page is
// either baked-in data or a client-side WebGL render.
export default defineConfig({
  base: "./",
  server: { port: 5174 },
  build: {
    outDir: "dist",
    assetsInlineLimit: 2048,
  },
});
