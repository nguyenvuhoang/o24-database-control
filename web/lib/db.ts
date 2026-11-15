import { Pool } from 'pg';

const globalForPg = globalThis as typeof globalThis & { monitorPool?: Pool };
export const pool = globalForPg.monitorPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
if (process.env.NODE_ENV !== 'production') globalForPg.monitorPool = pool;
