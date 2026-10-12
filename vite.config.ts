import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  // Build a normal Node server (for Cloud Run) instead of a Cloudflare Worker
  nitro: { preset: "node-server" },
});