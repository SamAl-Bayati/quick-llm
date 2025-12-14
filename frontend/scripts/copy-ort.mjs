import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import fs from "fs/promises";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function findPackageRootFromFile(resolvedFile) {
  let dir = path.dirname(resolvedFile);
  while (true) {
    const pkg = path.join(dir, "package.json");
    if (await pathExists(pkg)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate onnxruntime-web package root");
}

let ortEntry = null;
try {
  ortEntry = require.resolve("onnxruntime-web");
} catch {
  console.warn("onnxruntime-web not resolvable, skipping ORT copy");
  process.exit(0);
}

const ortRoot = await findPackageRootFromFile(ortEntry);

const srcDir = path.join(ortRoot, "dist");
const destDir = path.resolve(__dirname, "..", "vendor", "ort");

if (!(await pathExists(srcDir))) {
  throw new Error(`onnxruntime-web dist dir not found at ${srcDir}`);
}

await fs.rm(destDir, { recursive: true, force: true });
await fs.mkdir(destDir, { recursive: true });
await fs.cp(srcDir, destDir, { recursive: true });

console.log(`Copied ORT dist -> ${destDir}`);
