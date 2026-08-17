# ============================================================================
# Imagen para Railway: Next.js + Playwright (Chrome headed bajo pantalla virtual)
# ============================================================================

# Partimos de la imagen OFICIAL de Playwright: ya trae Chromium, TODAS las
# librerías del sistema que el navegador necesita, y Xvfb (la pantalla virtual).
# El tag DEBE coincidir con la versión de "playwright" en package.json (1.62.0).
FROM mcr.microsoft.com/playwright:v1.62.0-noble

WORKDIR /app

# pnpm en la versión exacta del proyecto (corepack viene incluido con Node).
RUN corepack enable && corepack prepare pnpm@10.18.1 --activate

# --- 1) Dependencias (capa cacheable: solo se rehace si cambian los lockfiles) ---
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- 2) Google Chrome REAL ---
# El scraper usa Chrome de Google (pasa Cloudflare mejor que el Chromium pelado).
RUN pnpm exec playwright install chrome

# --- 3) Código + build (prisma generate + next build) ---
COPY . .
RUN pnpm run build

# El navegador corre HEADED bajo Xvfb (Railway no tiene monitor).
# Dejamos esto fijo acá para no depender de configurarlo a mano en Railway.
ENV SCRAPER_HEADLESS=false
ENV NODE_ENV=production

# Railway inyecta la variable PORT; `next start` la respeta automáticamente.
EXPOSE 3000

# xvfb-run levanta la pantalla virtual, exporta DISPLAY, y recién ahí arranca el
# server. Todo proceso hijo (incluido Chrome) hereda esa pantalla.
CMD ["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1280x1024x24", "pnpm", "start"]
