ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scoped_space_id uuid;

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_api_key_id uuid,
  event_type text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_tenant_idx ON audit_log (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS audit_log_event_type_idx ON audit_log (tenant_id, event_type);
