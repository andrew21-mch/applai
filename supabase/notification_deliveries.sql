-- Tracks which jobs were already included in a digest per recipient (no duplicate alerts)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, recipient)
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_recipient
  ON notification_deliveries(recipient);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_opportunity
  ON notification_deliveries(opportunity_id);

ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_deliveries_all" ON notification_deliveries;
CREATE POLICY "notification_deliveries_all" ON notification_deliveries
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);
