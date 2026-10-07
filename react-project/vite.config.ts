import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
// - dev: base 루트("/") + /api, /upload proxy(json-server 커스텀 서버). 로컬 개발용.
// - build: base "./" → 자원 상대경로 → labport <base href> 주입과 호환.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      // 포스터 업로드(외부 URL → 서버 다운로드) — dev 에서도 동일 서버로
      "/upload": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
      "/chat-api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/chat-api/, "/api"),
      },
    },
  },
});
