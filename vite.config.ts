import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    // P2 后端代理层：前端以同源 /api/providers/:id/query 调用，转发到本地
    // Express 代理服务（默认端口 8788，见 meta.json proxyPort；服务端可用 PORT 覆盖）。
    // Express 侧负责：上游分派、密钥注入、域名白名单、浏览器 UA、错误归一与 CORS。
    // 生产环境改由 nginx 的 /api -> Express 反代（见 .docs/开发计划-SSOT.md P2/P7）。
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
      },
    },
  },
});
