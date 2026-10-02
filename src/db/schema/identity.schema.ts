import { pgTable, uuid, text, boolean, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { tenants } from './tenant.schema.js';

export const ssoConfigs = pgTable('sso_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .unique()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  issuer: text('issuer').notNull(),
  audience: text('audience').notNull(),
  jwksUri: text('jwks_uri'),
  defaultRole: text('default_role').notNull().default('member'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable(
  'members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    externalSubject: text('external_subject').notNull(),
    email: text('email'),
    role: text('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (table) => [
    unique('members_tenant_subject_unique').on(table.tenantId, table.externalSubject),
    index('members_tenant_idx').on(table.tenantId),
  ],
);
