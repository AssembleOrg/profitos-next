import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const OUT = process.env.SHOT_DIR;
const ROUTES = process.env.SHOT_ROUTES.split(",");
const VIEW = process.env.SHOT_VIEW === "mobile"
  ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
  : { width: 1440, height: 1000, deviceScaleFactor: 1 };

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/home/charly/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome",
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: VIEW.width, height: VIEW.height }, ...VIEW });
const page = await ctx.newPage();

for (const route of ROUTES) {
  const name = route.replace(/\//g, "_").replace(/^_/, "") || "root";
  try {
    await page.goto(`http://localhost:3000${route}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    console.log(`OK ${route}`);
  } catch (e) {
    console.log(`FAIL ${route} :: ${e.message.split("\n")[0]}`);
  }
}

await browser.close();
