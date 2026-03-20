import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        assetLibraryStudio: resolve(__dirname, "asset-library-studio.html"),
        assetScreenshotStudio: resolve(__dirname, "asset-screenshot-studio.html"),
      },
    },
  },
  server: {
    open: false,
  },
});
