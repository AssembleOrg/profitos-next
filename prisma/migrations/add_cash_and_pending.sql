-- Caja y pendientes: bolsillos (caja/banco/persona), a cobrar/a pagar en cuotas,
-- rendición al propietario, honorarios fijos y "cobramos todo" en firmas.
-- Aditivo e idempotente. La caja arranca en 0: lo cargado antes queda sin bolsillo.

ALTER TABLE profitos.jp_account_entries
  ADD COLUMN IF NOT EXISTS fund text,
  ADD COLUMN IF NOT EXISTS fund_user_id text,
  ADD COLUMN IF NOT EXISTS counterparty text,
  ADD COLUMN IF NOT EXISTS installment_group text,
  ADD COLUMN IF NOT EXISTS installment_number integer,
  ADD COLUMN IF NOT EXISTS installment_count integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jp_account_entries_fund_user_id_fkey') THEN
    ALTER TABLE profitos.jp_account_entries
      ADD CONSTRAINT jp_account_entries_fund_user_id_fkey
      FOREIGN KEY (fund_user_id) REFERENCES profitos.jp_users(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS jp_account_entries_fund_idx ON profitos.jp_account_entries (fund);
CREATE INDEX IF NOT EXISTS jp_account_entries_installment_group_idx ON profitos.jp_account_entries (installment_group);

-- Cobros de alquiler: bolsillo y rendición al propietario.
ALTER TABLE profitos.jp_rental_payment_transactions
  ADD COLUMN IF NOT EXISTS fund text,
  ADD COLUMN IF NOT EXISTS owner_paid_at timestamp(3),
  ADD COLUMN IF NOT EXISTS owner_paid_fund text,
  ADD COLUMN IF NOT EXISTS owner_paid_by_user_id text;

-- Cobros anteriores a la caja: se dan por rendidos (no aparecen como "sin retirar").
-- Solo toca filas sin bolsillo, así que correrlo de nuevo no pisa cobros nuevos.
UPDATE profitos.jp_rental_payment_transactions
  SET owner_paid_at = paid_at
  WHERE fund IS NULL AND owner_paid_at IS NULL;

CREATE INDEX IF NOT EXISTS jp_rental_payment_transactions_owner_paid_at_idx
  ON profitos.jp_rental_payment_transactions (owner_paid_at);

-- Firmas: honorarios en monto fijo y "cobramos el total y le pagamos al colega".
ALTER TABLE profitos.jp_signature_proposals
  ADD COLUMN IF NOT EXISTS fee_amount double precision,
  ADD COLUMN IF NOT EXISTS collects_all boolean NOT NULL DEFAULT false;

-- Movimientos entre bolsillos y ajustes de saldo.
CREATE TABLE IF NOT EXISTS profitos.jp_cash_transfers (
  id                  text PRIMARY KEY,
  kind                text NOT NULL,
  from_fund           text,
  from_user_id        text,
  to_fund             text NOT NULL,
  to_user_id          text,
  amount              double precision NOT NULL,
  currency            text NOT NULL DEFAULT 'ARS',
  date                date NOT NULL,
  description         text,
  created_by_user_id  text NOT NULL,
  created_at          timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS jp_cash_transfers_date_idx ON profitos.jp_cash_transfers (date);
CREATE INDEX IF NOT EXISTS jp_cash_transfers_to_fund_idx ON profitos.jp_cash_transfers (to_fund);
CREATE INDEX IF NOT EXISTS jp_cash_transfers_from_fund_idx ON profitos.jp_cash_transfers (from_fund);
-- Sin políticas: la clave pública de Supabase no puede leer. Prisma entra como dueño.
ALTER TABLE profitos.jp_cash_transfers ENABLE ROW LEVEL SECURITY;

-- Categoría de egreso para lo que se le paga al colega cuando cobramos el total.
INSERT INTO profitos.jp_account_categories (id, name, kind, color, is_system, sort_order, area, updated_at)
VALUES ('seed_colleague_payout', 'Honorarios a colegas', 'expense', '#0ea5e9', false, 7, 'ventas', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
