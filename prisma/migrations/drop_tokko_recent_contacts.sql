-- Elimina la feature Tokko "últimos contactos" (RecentContact) y los
-- "seguimientos de consultas" (ContactFollowUp y afines).
-- El código ya no referencia estas tablas (commit be52473). Reemplazadas por la
-- central de mensajes unificada (/consultants, lee jp_scraped_leads + preguntas).
--
-- IRREVERSIBLE: borra datos. CASCADE limpia FKs, policies RLS y membresías de
-- publicación de realtime asociadas.
DROP TABLE IF EXISTS jp_contact_followup_status_changes CASCADE;
DROP TABLE IF EXISTS jp_contact_followup_actions CASCADE;
DROP TABLE IF EXISTS jp_contact_followups CASCADE;
DROP TABLE IF EXISTS jp_ultimos_contactos CASCADE;
