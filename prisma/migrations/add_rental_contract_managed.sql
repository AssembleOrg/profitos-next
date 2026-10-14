-- Contratos que NO administra la inmobiliaria (los administra el propietario).
--
-- Se cargan para tener el legajo (propiedad, inquilino, propietario, fechas y
-- condiciones) y registrar los honorarios de la operación en Estados de
-- cuenta, pero no generan cuotas, recibos ni avisos de cobro o aumento.
--
-- 100% aditivo e idempotente: todos los contratos existentes quedan como
-- administrados (default true), igual que hasta ahora.
--
-- Aplicar:
--   pnpm prisma db execute --file prisma/migrations/add_rental_contract_managed.sql --config prisma/prisma.config.ts

SET search_path TO profitos;

ALTER TABLE jp_rental_contracts
  ADD COLUMN IF NOT EXISTS managed boolean NOT NULL DEFAULT true;
