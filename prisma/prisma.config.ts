import path from "node:path";
import fs from "node:fs";
import { defineConfig } from "prisma/config";

// Manually parse .env since dotenv may not work in Prisma CLI context
function loadEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf-8");
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

const env = loadEnv();

export default defineConfig({
  schema: "schema.prisma",
  datasource: {
    url: env.DIRECT_URL ?? env.DATABASE_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
