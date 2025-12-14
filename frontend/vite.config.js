import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ORT_DIR = path.resolve(__dirname, "vendor", "ort");

function ortStatic() {
  let outDir = "dist";

  return {
    name: "ort-static",
    configResolved(cfg) {
      outDir = cfg.build.outDir;
    },
    configureServer(server) {
      server.middlewares.use("/ort", (req, res, next) => {
        try {
          const u = new URL(req.url || "/", "http://localhost");
          const rel = u.pathname.replace(/^\/+/, "");
          const filePath = path.join(ORT_DIR, rel);
          if (!filePath.startsWith(ORT_DIR)) return next();
          if (!fs.existsSync(filePath)) return next();
          const stat = fs.statSync(filePath);
          if (!stat.isFile()) return next();

          const ext = path.extname(filePath).toLowerCase();
          if (ext === ".wasm")
            res.setHeader("Content-Type", "application/wasm");
          else if (ext === ".mjs" || ext === ".js") {
            res.setHeader("Content-Type", "text/javascript");
          }

          res.setHeader("Cache-Control", "no-cache");
          fs.createReadStream(filePath).pipe(res);
        } catch {
          next();
        }
      });
    },
    async closeBundle() {
      if (!fs.existsSync(ORT_DIR)) return;
      const dest = path.resolve(outDir, "ort");
      await fsp.rm(dest, { recursive: true, force: true });
      await fsp.mkdir(dest, { recursive: true });
      await fsp.cp(ORT_DIR, dest, { recursive: true });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ortStatic()],
});
