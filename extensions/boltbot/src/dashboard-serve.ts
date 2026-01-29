import { readFileSync } from "node:fs";
import { join, normalize, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

type PluginApi = {
  registerHttpRoute: (params: {
    path: string;
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
  }) => void;
};

const DIST_DIR = join(fileURLToPath(import.meta.url), "../../dashboard/dist");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

export function registerDashboardRoutes(api: PluginApi) {
  api.registerHttpRoute({
    path: "/boltbot/dashboard",
    handler: (req, res) => {
      const url = req.url ?? "/";
      const basePath = "/boltbot/dashboard";
      const idx = url.indexOf(basePath);
      let filePath = idx !== -1 ? url.slice(idx + basePath.length) : "/";

      // Strip query string
      const qIdx = filePath.indexOf("?");
      if (qIdx !== -1) filePath = filePath.slice(0, qIdx);

      // Default to index.html
      if (!filePath || filePath === "/") filePath = "/index.html";

      // Sanitize: prevent directory traversal
      const decoded = decodeURIComponent(filePath);
      const absolutePath = join(DIST_DIR, normalize(decoded));
      const resolvedDist = resolve(DIST_DIR);
      if (!resolve(absolutePath).startsWith(resolvedDist + "/")) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      let content: Buffer;
      let servingIndex = false;
      try {
        content = readFileSync(absolutePath);
      } catch {
        // SPA catch-all: serve index.html for unknown paths
        try {
          content = readFileSync(join(DIST_DIR, "index.html"));
          servingIndex = true;
        } catch {
          res.writeHead(404);
          res.end("Not Found");
          return;
        }
      }

      const ext = servingIndex ? ".html" : extname(absolutePath);
      const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

      const headers: Record<string, string> = {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      };

      if (servingIndex || ext === ".html") {
        headers["Cache-Control"] = "no-cache";
      } else if (normalize(decoded).startsWith("/assets/")) {
        headers["Cache-Control"] = "public, max-age=31536000, immutable";
      }

      res.writeHead(200, headers);
      res.end(content);
    },
  });
}
