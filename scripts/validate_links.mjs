import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const htmlFiles = [
  "index.html",
  "aegis.html",
  "gridium.html",
  "compressor-cbm.html",
  "topoflow.html",
  "food.html",
  "yield.html",
  "threeui-lab.html"
];

console.log("Starting Link & Asset Integrity Validation...\n");

let totalChecked = 0;
let errors = 0;

for (const htmlFile of htmlFiles) {
  const filePath = path.join(rootDir, htmlFile);
  if (!fs.existsSync(filePath)) {
    console.error(`Missing HTML file: ${htmlFile}`);
    errors++;
    continue;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const linkMatches = [...content.matchAll(/(?:href|src)=["']([^"']+)["']/g)];

  for (const match of linkMatches) {
    let target = match[1];
    totalChecked++;

    // Ignore external URLs, data URIs, and hash-only links
    if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("#") || target.startsWith("mailto:") || target.startsWith("data:")) {
      continue;
    }

    // Strip query parameters
    const cleanTarget = target.split("?")[0].replace(/^\//, "");
    if (!cleanTarget) continue;

    const resolved = path.join(rootDir, cleanTarget);
    if (!fs.existsSync(resolved)) {
      console.warn(`[BROKEN LINK] in ${htmlFile}: ${target} -> ${resolved} not found`);
      errors++;
    }
  }
}

console.log(`\nValidation Complete: ${totalChecked} references checked across ${htmlFiles.length} pages.`);
if (errors === 0) {
  console.log("SUCCESS: 0 broken internal links found!");
} else {
  console.log(`WARNING: ${errors} unresolved references detected.`);
}
