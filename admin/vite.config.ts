import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5174,
    proxy: {
      "/auth": {
        target: process.env.ADMIN_API_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/admin": {
        target: process.env.ADMIN_API_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
