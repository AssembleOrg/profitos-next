-- Firmas → honorarios "a cobrar" en estados de cuenta. Idempotente.
ALTER TABLE profitos.jp_signature_proposals
  ADD COLUMN IF NOT EXISTS operation_amount double precision,
  ADD COLUMN IF NOT EXISTS operation_currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS fee_percentage double precision;

ALTER TABLE profitos.jp_account_entries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'collected',
  ADD COLUMN IF NOT EXISTS collected_at timestamp(3),
  ADD COLUMN IF NOT EXISTS signature_proposal_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jp_account_entries_signature_proposal_id_fkey'
  ) THEN
    ALTER TABLE profitos.jp_account_entries
      ADD CONSTRAINT jp_account_entries_signature_proposal_id_fkey
      FOREIGN KEY (signature_proposal_id) REFERENCES profitos.jp_signature_proposals(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS jp_account_entries_status_idx ON profitos.jp_account_entries (status);
CREATE INDEX IF NOT EXISTS jp_account_entries_signature_proposal_id_idx ON profitos.jp_account_entries (signature_proposal_id);
