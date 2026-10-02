CREATE TABLE IF NOT EXISTS developer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_subject text NOT NULL UNIQUE,
  email text,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  last_session_api_key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
