import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// EN: `--host` (set in package.json scripts) makes Vite bind 0.0.0.0
//     so phones on the same Wi-Fi can reach the dev server via the LAN IP.
// zh-TW: `--host`（已寫進 package.json）讓 Vite 綁定 0.0.0.0，
//         同 Wi-Fi 的手機才能用 LAN IP 連到開發伺服器。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/ws": { target: "ws://localhost:8000", ws: true },
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
