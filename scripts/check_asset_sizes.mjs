import fs from "node:fs";
import path from "node:path";

const budget = {
  html: 50 * 1024,      // 50 KB max for HTML files
  css: 80 * 1024,       // 80 KB max for CSS files
  js: 120 * 1024,      // 120 KB max for individual JS files
  image: 800 * 1024     // 800 KB max for individual images
};

console.log("Checking Asset Sizes against Performance Budgets...\n");

function checkDir(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
        checkDir(fullPath);
      }
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      const stats = fs.statSync(fullPath);
      const sizeKb = (stats.size / 1024).toFixed(1);

      let max = null;
      if (ext === ".html") max = budget.html;
      else if (ext === ".css") max = budget.css;
      else if (ext === ".js" && !fullPath.includes("vendor")) max = budget.js;
      else if ([".png", ".jpg", ".webp"].includes(ext)) max = budget.image;

      if (max && stats.size > max) {
        console.warn(`[BUDGET EXCEEDED] ${path.relative(process.cwd(), fullPath)}: ${sizeKb} KB (Limit: ${(max / 1024).toFixed(0)} KB)`);
      }
    }
  }
}

checkDir(process.cwd());
console.log("Asset performance budget verification complete.\n");
