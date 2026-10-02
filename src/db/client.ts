import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.js';
import * as schema from './schema/index.js';

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export const readPool = env.DATABASE_READ_URL ? new pg.Pool({ connectionString: env.DATABASE_READ_URL }) : pool;
export const readDb = env.DATABASE_READ_URL ? drizzle(readPool, { schema }) : db;

export type Database = typeof db;
export type Transaction = Parameters<Database['transaction']>[0] extends (tx: infer T) => unknown ? T : never;
export type DbClient = Database | Transaction;
