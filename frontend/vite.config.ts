import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// package.json ตั้งค่า "type": "module" จึงใช้ __dirname ไม่ได้
const root = dirname(
  fileURLToPath(import.meta.url)
);

/**
 * โปรเจกต์นี้เป็นเว็บแบบหลายหน้า (multi-page)
 * ต้องประกาศไฟล์ HTML ทุกหน้าเป็น entry
 * มิฉะนั้น vite build จะสร้างแค่ index.html
 */
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(root, "index.html"),
        login: resolve(root, "login.html"),

        register: resolve(
          root,
          "src/pages/register/register.html"
        ),

        room: resolve(
          root,
          "src/pages/room/room.html"
        ),

        tenant: resolve(
          root,
          "src/pages/tenant/tenant.html"
        ),

        meter: resolve(
          root,
          "src/pages/meter/meter.html"
        ),

        bill: resolve(
          root,
          "src/pages/bill/bill.html"
        ),

        report: resolve(
          root,
          "src/pages/report/report.html"
        )
      }
    }
  }
});
