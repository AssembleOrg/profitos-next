#!/bin/sh
# Entrypoint del scraper-worker (Dockerfile.worker).
#
# node arranca directo con el loader de tsx, sin `pnpm exec tsx`: así no quedan
# vivos pnpm, la CLI de tsx y un esbuild extra al lado del worker (~160MB de RAM
# que Railway cobra). NODE_PATH replica lo que exportaba el shim de pnpm, por si
# alguna dependencia no declarada se resuelve por ahí.

Xvfb :99 -screen 0 1280x1024x24 -nolisten tcp &
export DISPLAY=:99
sleep 2
echo '[entry] Xvfb listo, arrancando worker (server)'

# Brave, Chrome, LLVM y las fuentes dejan ~500MB en la page cache después de
# cada corrida. Railway la cobra como RAM y en el contenedor nunca hay presión
# de memoria que la libere. Cada 2 minutos, si la caché creció más de 100MB
# desde la última limpieza y no hay ningún navegador vivo (los zombis no
# cuentan), le pedimos al kernel que la suelte: `dd iflag=nocache count=0` hace
# fadvise(DONTNEED) sobre el archivo. Lo que está mapeado por procesos vivos
# (node, Xvfb) no se toca.
navegador_vivo() {
  for f in /proc/[0-9]*/status; do
    grep -qE '^Name:[[:space:]]*(brave|chrome)' "$f" 2>/dev/null || continue
    grep -qE '^State:[[:space:]]*Z' "$f" 2>/dev/null || return 0
  done
  return 1
}

cache_actual() {
  awk '$1 == "file" { print $2 }' /sys/fs/cgroup/memory.stat 2>/dev/null
}

soltar_cache() {
  base=0
  while sleep 120; do
    cache=$(cache_actual)
    [ "${cache:-0}" -gt $((base + 104857600)) ] || continue
    navegador_vivo && continue
    find /opt/brave.com /ms-playwright /usr/lib/x86_64-linux-gnu /usr/share/fonts -type f \
      -exec dd if={} iflag=nocache count=0 status=none \; 2>/dev/null
    base=$(cache_actual)
  done
}
soltar_cache &

export NODE_PATH=/app/node_modules/.pnpm/node_modules
exec node --import tsx scripts/scraper/serve-worker.ts
