-- Agregar campos para tracking de recordatorios
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS resend_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_resends INT DEFAULT 3;

-- Índice para búsquedas rápidas de pendientes
CREATE INDEX IF NOT EXISTS idx_docs_status_reminder 
ON documents(owner_id, status, last_reminder_sent_at) 
WHERE status IN ('PENDIENTE_VISADO', 'PENDIENTE_FIRMA');
