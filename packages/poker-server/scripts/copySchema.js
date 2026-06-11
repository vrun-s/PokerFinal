import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcPath = path.join(__dirname, "../src/db/schema.sql");
const destDir = path.join(__dirname, "../dist/db");
const destPath = path.join(destDir, "schema.sql");

try {
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(srcPath, destPath);
  console.log("Copied schema.sql to dist/db/schema.sql successfully.");
} catch (error) {
  console.error("Error copying schema.sql to dist:", error);
  process.exit(1);
}
