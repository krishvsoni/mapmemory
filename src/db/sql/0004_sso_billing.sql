ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status text;

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_member_id uuid;

CREATE TABLE IF NOT EXISTS sso_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  issuer text NOT NULL,
  audience text NOT NULL,
  jwks_uri text,
  default_role text NOT NULL DEFAULT 'member',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_subject text NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  CONSTRAINT members_tenant_subject_unique UNIQUE (tenant_id, external_subject)
);
CREATE INDEX IF NOT EXISTS members_tenant_idx ON members (tenant_id);
