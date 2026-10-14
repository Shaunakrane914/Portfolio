import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Robust Playwright loader that works across standard npm installs,
 * environment variables, and cached runtime directories.
 */
export async function getPlaywright() {
  // 1. Try standard module resolution
  try {
    const pw = await import("playwright");
    if (pw && pw.chromium) return pw;
  } catch {}

  // 2. Try process.env.PLAYWRIGHT_ROOT
  if (process.env.PLAYWRIGHT_ROOT && fs.existsSync(process.env.PLAYWRIGHT_ROOT)) {
    try {
      const pwPath = path.join(process.env.PLAYWRIGHT_ROOT, "index.mjs");
      const pw = await import(pathToFileURL(pwPath).href);
      if (pw && pw.chromium) return pw;
    } catch {}
  }

  // 3. Known fallback directories
  const candidates = [
    path.join(process.cwd(), "node_modules", "playwright"),
    path.join(process.cwd(), "..", "node_modules", "playwright"),
    "C:\\Users\\Shaunak Rane\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright",
    path.join(process.env.USERPROFILE || "", ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", "playwright")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const file = path.join(candidate, "index.mjs");
        if (fs.existsSync(file)) {
          const pw = await import(pathToFileURL(file).href);
          if (pw && pw.chromium) return pw;
        }
      } catch {}
    }
  }

  throw new Error("Unable to locate Playwright in standard node_modules or runtime directories. Set PLAYWRIGHT_ROOT environment variable.");
}
