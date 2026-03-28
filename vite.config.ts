import fs from "node:fs";
import path, { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const REPO_LIBRARIES_DIR = resolve(__dirname, "libraries");

function getContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".json":
      return "application/json; charset=utf-8";
    case ".gltf":
      return "model/gltf+json; charset=utf-8";
    case ".bin":
      return "application/octet-stream";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function serveRepoLibrariesPlugin() {
  return {
    name: "serve-repo-libraries",
    configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { setHeader: (name: string, value: string) => void; end: (body: Buffer | string) => void; statusCode: number }, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        const requestUrl = req.url;
        if (!requestUrl || !requestUrl.startsWith("/libraries/")) {
          next();
          return;
        }

        const relativePath = decodeURIComponent(requestUrl.slice("/libraries/".length).split("?")[0] ?? "");
        const targetPath = path.resolve(REPO_LIBRARIES_DIR, relativePath);

        if (!targetPath.startsWith(REPO_LIBRARIES_DIR)) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }

        if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
          next();
          return;
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", getContentType(targetPath));
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.end(fs.readFileSync(targetPath));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveRepoLibrariesPlugin()],
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
