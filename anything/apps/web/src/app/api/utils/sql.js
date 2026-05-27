import { neon } from '@neondatabase/serverless';
import pg from 'pg';
import { getConfiguredDatabaseUrlSync } from './app-config.js';

const NullishQueryFunction = () => {
  throw new Error(
    'No database connection string was provided to `neon()`. Set DATABASE_URL or configure the database URL in Settings.'
  );
};
NullishQueryFunction.transaction = () => {
  throw new Error(
    'No database connection string was provided to `neon()`. Set DATABASE_URL or configure the database URL in Settings.'
  );
};
const { Pool } = pg;

function buildPgTag(databaseUrl) {
  const pool = new Pool({ connectionString: databaseUrl });

  const run = async (strings, ...values) => {
    const text = strings.reduce((query, chunk, index) => {
      return `${query}${chunk}${index < values.length ? `$${index + 1}` : ''}`;
    }, '');
    const result = await pool.query(text, values);
    return result.rows;
  };

  run.transaction = async (callback) => {
    const client = await pool.connect();
    const tx = async (strings, ...values) => {
      const text = strings.reduce((query, chunk, index) => {
        return `${query}${chunk}${index < values.length ? `$${index + 1}` : ''}`;
      }, '');
      const result = await client.query(text, values);
      return result.rows;
    };
    try {
      await client.query('BEGIN');
      const result = await callback(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };

  return run;
}

function shouldUsePg(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function createSqlClient(databaseUrl) {
  if (!databaseUrl) return NullishQueryFunction;
  return shouldUsePg(databaseUrl) ? buildPgTag(databaseUrl) : neon(databaseUrl);
}

const databaseUrl = getConfiguredDatabaseUrlSync();
export const hasDatabase = Boolean(databaseUrl);
const sql = createSqlClient(databaseUrl);

export default sql;
