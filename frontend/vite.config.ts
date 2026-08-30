import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { visualizer } from "rollup-plugin-visualizer";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/",
  plugins: [
    TanStackRouterVite(),
    tailwindcss(),
    react(),
    visualizer({ filename: "dist/stats.html", template: "treemap", gzipSize: true, json: true }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normId = id.replace(/\\/g, "/");
          if (normId.includes("node_modules")) {
            if (normId.includes("react/") || normId.includes("react-dom/")) {
              return "vendor-react";
            }
            if (normId.includes("xlsx")) {
              return "vendor-excel";
            }
            if (normId.includes("date-fns")) {
              return "vendor-utils";
            }
            if (normId.includes("recharts") || normId.includes("d3")) {
              return "vendor-charts";
            }
            if (normId.includes("@tanstack")) {
              return "vendor-tanstack";
            }
            if (normId.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (normId.includes("@radix-ui")) {
              return "vendor-ui";
            }
            return "vendor-core";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "https://api.hrnexa.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
