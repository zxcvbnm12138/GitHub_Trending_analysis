import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createSqlClient } from "./sql.js";

const STORE_PATH = join(process.cwd(), ".data", "trending-dashboard.json");

export const REQUIRED_TABLES = [
  {
    name: "app_users",
    columns: [
      "id",
      "email",
      "password_hash",
      "password_salt",
      "password_iterations",
      "role",
      "status",
      "created_at",
      "updated_at",
    ],
    indexes: ["app_users_email_unique"],
  },
  {
    name: "user_sessions",
    columns: [
      "id",
      "user_id",
      "token_hash",
      "expires_at",
      "created_at",
      "last_seen_at",
    ],
    indexes: ["user_sessions_token_unique", "user_sessions_user_idx"],
  },
  {
    name: "invite_codes",
    columns: [
      "id",
      "code",
      "code_hash",
      "role",
      "max_uses",
      "used_count",
      "expires_at",
      "disabled",
      "created_by",
      "created_at",
    ],
    indexes: ["invite_codes_code_unique"],
  },
  {
    name: "trending_reports",
    columns: [
      "id",
      "user_id",
      "created_at",
      "report_date",
      "language_filter",
      "status",
      "summary",
      "error_message",
      "raw_data",
    ],
    indexes: [
      "trending_reports_created_idx",
      "trending_reports_report_date_language_idx",
      "trending_reports_user_idx",
    ],
  },
  {
    name: "report_schedules",
    columns: [
      "id",
      "user_id",
      "enabled",
      "cron_time",
      "cron_times",
      "timezone",
      "languages",
      "last_run_at",
      "next_run_at",
    ],
    indexes: ["report_schedules_enabled_idx", "report_schedules_user_unique"],
  },
  {
    name: "report_generation_jobs",
    columns: [
      "id",
      "user_id",
      "kind",
      "schedule_id",
      "run_at",
      "status",
      "payload",
      "attempts",
      "max_attempts",
      "locked_at",
      "locked_by",
      "last_error",
      "created_at",
      "updated_at",
      "completed_at",
    ],
    indexes: [
      "report_generation_jobs_due_idx",
      "report_generation_jobs_schedule_idx",
      "report_generation_jobs_user_idx",
    ],
  },
];

function createClient(databaseUrl) {
  if (!databaseUrl) {
    throw new Error("Database URL is not configured.");
  }
  return createSqlClient(databaseUrl);
}

function defaultStore() {
  return {
    nextReportId: 1,
    nextJobId: 1,
    jobs: [],
    reports: [],
    schedule: null,
  };
}

async function readLocalStore() {
  try {
    const content = await readFile(STORE_PATH, "utf8");
    return { ...defaultStore(), ...JSON.parse(content) };
  } catch (error) {
    if (error?.code === "ENOENT") return defaultStore();
    throw error;
  }
}

function normalizeReport(report) {
  const createdAt = report.created_at || new Date().toISOString();
  return {
    id: Number(report.id),
    created_at: createdAt,
    report_date: report.report_date || createdAt.slice(0, 10),
    language_filter: report.language_filter ?? null,
    status: report.status || "pending",
    summary: report.summary || null,
    error_message: report.error_message || null,
    raw_data: report.raw_data || {},
  };
}

function normalizeJob(job) {
  const now = new Date().toISOString();
  return {
    id: Number(job.id),
    kind: job.kind || "daily_report",
    schedule_id: Number(job.schedule_id ?? job.scheduleId),
    run_at: job.run_at,
    status: job.status || "scheduled",
    payload: job.payload || {},
    attempts: Number(job.attempts) || 0,
    max_attempts: Number(job.max_attempts) || 3,
    locked_at: job.locked_at || null,
    locked_by: job.locked_by || null,
    last_error: job.last_error || null,
    created_at: job.created_at || now,
    updated_at: job.updated_at || now,
    completed_at: job.completed_at || null,
  };
}

export async function inspectDatabaseSchema(databaseUrl) {
  if (!databaseUrl) {
    return {
      storage_mode: "local_file",
      connected: false,
      tables: [],
      missing_tables: REQUIRED_TABLES.map((table) => table.name),
      missing_columns: {},
      missing_indexes: {},
    };
  }

  const sql = createClient(databaseUrl);
  await sql`SELECT 1 AS ok`;

  const tableRows = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('app_users', 'user_sessions', 'invite_codes', 'trending_reports', 'report_schedules', 'report_generation_jobs')
  `;
  const existingTables = new Set(tableRows.map((row) => row.table_name));

  const columnRows = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('app_users', 'user_sessions', 'invite_codes', 'trending_reports', 'report_schedules', 'report_generation_jobs')
  `;
  const existingColumns = new Map();
  for (const row of columnRows) {
    if (!existingColumns.has(row.table_name)) existingColumns.set(row.table_name, new Set());
    existingColumns.get(row.table_name).add(row.column_name);
  }

  const indexRows = await sql`
    SELECT tablename AS table_name, indexname AS index_name
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('app_users', 'user_sessions', 'invite_codes', 'trending_reports', 'report_schedules', 'report_generation_jobs')
  `;
  const existingIndexes = new Map();
  for (const row of indexRows) {
    if (!existingIndexes.has(row.table_name)) existingIndexes.set(row.table_name, new Set());
    existingIndexes.get(row.table_name).add(row.index_name);
  }

  const missingTables = [];
  const missingColumns = {};
  const missingIndexes = {};

  for (const table of REQUIRED_TABLES) {
    if (!existingTables.has(table.name)) {
      missingTables.push(table.name);
      missingColumns[table.name] = table.columns;
      missingIndexes[table.name] = table.indexes;
      continue;
    }

    const columns = existingColumns.get(table.name) || new Set();
    const indexes = existingIndexes.get(table.name) || new Set();
    const tableMissingColumns = table.columns.filter((column) => !columns.has(column));
    const tableMissingIndexes = table.indexes.filter((index) => !indexes.has(index));

    if (tableMissingColumns.length) missingColumns[table.name] = tableMissingColumns;
    if (tableMissingIndexes.length) missingIndexes[table.name] = tableMissingIndexes;
  }

  return {
    storage_mode: "database",
    connected: true,
    tables: [...existingTables],
    missing_tables: missingTables,
    missing_columns: missingColumns,
    missing_indexes: missingIndexes,
  };
}

export function schemaIsReady(schema) {
  return (
    schema.connected &&
    schema.missing_tables.length === 0 &&
    Object.keys(schema.missing_columns).length === 0 &&
    Object.keys(schema.missing_indexes).length === 0
  );
}

export async function ensureDatabaseSchema(databaseUrl) {
  const sql = createClient(databaseUrl);

  await sql`
    CREATE TABLE IF NOT EXISTS app_users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_iterations INTEGER NOT NULL DEFAULT 120000,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash TEXT`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_salt TEXT`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_iterations INTEGER NOT NULL DEFAULT 120000`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_unique
    ON app_users (LOWER(email))
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS user_id BIGINT`;
  await sql`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS token_hash TEXT`;
  await sql`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`;
  await sql`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_token_unique
    ON user_sessions (token_hash)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS user_sessions_user_idx
    ON user_sessions (user_id, expires_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id BIGSERIAL PRIMARY KEY,
      code TEXT,
      code_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      max_uses INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ,
      disabled BOOLEAN NOT NULL DEFAULT false,
      created_by BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS code TEXT`;
  await sql`ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS code_hash TEXT`;
  await sql`ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`;
  await sql`ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS max_uses INTEGER NOT NULL DEFAULT 1`;
  await sql`ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`;
  await sql`ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS created_by BIGINT`;
  await sql`ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS invite_codes_code_unique
    ON invite_codes (code_hash)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS trending_reports (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      report_date DATE NOT NULL DEFAULT CURRENT_DATE,
      language_filter TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      summary TEXT,
      error_message TEXT,
      raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `;
  await sql`ALTER TABLE trending_reports ADD COLUMN IF NOT EXISTS id BIGSERIAL`;
  await sql`ALTER TABLE trending_reports ADD COLUMN IF NOT EXISTS user_id BIGINT`;
  await sql`ALTER TABLE trending_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`ALTER TABLE trending_reports ADD COLUMN IF NOT EXISTS report_date DATE NOT NULL DEFAULT CURRENT_DATE`;
  await sql`ALTER TABLE trending_reports ADD COLUMN IF NOT EXISTS language_filter TEXT`;
  await sql`ALTER TABLE trending_reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'`;
  await sql`ALTER TABLE trending_reports ADD COLUMN IF NOT EXISTS summary TEXT`;
  await sql`ALTER TABLE trending_reports ADD COLUMN IF NOT EXISTS error_message TEXT`;
  await sql`ALTER TABLE trending_reports ADD COLUMN IF NOT EXISTS raw_data JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await sql`
    CREATE INDEX IF NOT EXISTS trending_reports_created_idx
    ON trending_reports (created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS trending_reports_report_date_language_idx
    ON trending_reports (user_id, report_date, language_filter, status)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS trending_reports_user_idx
    ON trending_reports (user_id, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS report_schedules (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT,
      enabled BOOLEAN NOT NULL DEFAULT false,
      cron_time TEXT NOT NULL DEFAULT '09:00',
      cron_times TEXT[] NOT NULL DEFAULT ARRAY['09:00','14:00','22:00']::text[],
      timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
      languages TEXT[] NOT NULL DEFAULT ARRAY['all']::text[],
      last_run_at TIMESTAMPTZ,
      next_run_at TIMESTAMPTZ
    )
  `;
  await sql`ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS id BIGSERIAL`;
  await sql`ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS user_id BIGINT`;
  await sql`ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS cron_time TEXT NOT NULL DEFAULT '09:00'`;
  await sql`ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS cron_times TEXT[] NOT NULL DEFAULT ARRAY['09:00','14:00','22:00']::text[]`;
  await sql`ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai'`;
  await sql`ALTER TABLE report_schedules ALTER COLUMN timezone SET DEFAULT 'Asia/Shanghai'`;
  await sql`ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS languages TEXT[] NOT NULL DEFAULT ARRAY['all']::text[]`;
  await sql`ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ`;
  await sql`ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ`;
  await sql`
    CREATE INDEX IF NOT EXISTS report_schedules_enabled_idx
    ON report_schedules (user_id, enabled)
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS report_schedules_user_unique
    ON report_schedules (user_id)
    WHERE user_id IS NOT NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS report_generation_jobs (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT,
      kind TEXT NOT NULL DEFAULT 'daily_report',
      schedule_id BIGINT NOT NULL,
      run_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      locked_at TIMESTAMPTZ,
      locked_by TEXT,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `;
  await sql`ALTER TABLE report_generation_jobs ADD COLUMN IF NOT EXISTS id BIGSERIAL`;
  await sql`ALTER TABLE report_generation_jobs ADD COLUMN IF NOT EXISTS user_id BIGINT`;
  await sql`ALTER TABLE report_generation_jobs ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'daily_report'`;
  await sql`ALTER TABLE report_generation_jobs ADD COLUMN IF NOT EXISTS schedule_id BIGINT`;
  await sql`ALTER TABLE report_generation_jobs ADD COLUMN IF NOT EXISTS run_at TIMESTAMPTZ`;
  await sql`ALTER TABLE report_generation_jobs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled'`;
  await sql`ALTER TABLE report_generation_jobs ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE report_generation_jobs ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE report_generation_jobs ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3`;
  await sql`ALTER TABLE report_generation_jobs ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ`;
  await sql`ALTER TABLE report_generation_jobs ADD COLUMN IF NOT EXISTS locked_by TEXT`;
  await sql`ALTER TABLE report_generation_jobs ADD COLUMN IF NOT EXISTS last_error TEXT`;
  await sql`ALTER TABLE report_generation_jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`ALTER TABLE report_generation_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`ALTER TABLE report_generation_jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`;
  await sql`
    CREATE INDEX IF NOT EXISTS report_generation_jobs_due_idx
    ON report_generation_jobs (status, run_at)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS report_generation_jobs_schedule_idx
    ON report_generation_jobs (schedule_id, status)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS report_generation_jobs_user_idx
    ON report_generation_jobs (user_id, status, run_at)
  `;

  return inspectDatabaseSchema(databaseUrl);
}

export async function getLocalStoreSummary() {
  const store = await readLocalStore();
  return {
    reports: Array.isArray(store.reports) ? store.reports.length : 0,
    jobs: Array.isArray(store.jobs) ? store.jobs.length : 0,
    has_schedule: Boolean(store.schedule),
  };
}

async function resetSequences(sql) {
  await sql`
    SELECT setval(
      pg_get_serial_sequence('trending_reports', 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 1) FROM trending_reports), 1),
      true
    )
  `;
  await sql`
    SELECT setval(
      pg_get_serial_sequence('report_schedules', 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 1) FROM report_schedules), 1),
      true
    )
  `;
  await sql`
    SELECT setval(
      pg_get_serial_sequence('report_generation_jobs', 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 1) FROM report_generation_jobs), 1),
      true
    )
  `;
}

export async function migrateLocalStoreToDatabase(databaseUrl) {
  await ensureDatabaseSchema(databaseUrl);
  const sql = createClient(databaseUrl);
  const store = await readLocalStore();
  const result = {
    reports: { inserted: 0, skipped: 0, failed: 0 },
    schedule: { inserted: 0, skipped: 0, failed: 0 },
    jobs: { inserted: 0, skipped: 0, failed: 0 },
  };

  for (const item of Array.isArray(store.reports) ? store.reports : []) {
    const report = normalizeReport(item);
    if (!report.id) {
      result.reports.failed += 1;
      continue;
    }
    const rows = await sql`
      INSERT INTO trending_reports (
        id, created_at, report_date, language_filter, status, summary, error_message, raw_data
      )
      VALUES (
        ${report.id},
        ${report.created_at},
        ${report.report_date},
        ${report.language_filter},
        ${report.status},
        ${report.summary},
        ${report.error_message},
        ${JSON.stringify(report.raw_data)}::jsonb
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;
    if (rows.length) result.reports.inserted += 1;
    else result.reports.skipped += 1;
  }

  if (store.schedule) {
    const schedule = store.schedule;
    const rows = await sql`
      INSERT INTO report_schedules (
        id, enabled, cron_time, cron_times, timezone, languages, last_run_at, next_run_at
      )
      VALUES (
        ${Number(schedule.id) || 1},
        ${Boolean(schedule.enabled)},
        ${schedule.cron_time || "09:00"},
        ${Array.isArray(schedule.cron_times) && schedule.cron_times.length ? schedule.cron_times : ["09:00", "14:00", "22:00"]},
        ${schedule.timezone || "Asia/Shanghai"},
        ${Array.isArray(schedule.languages) && schedule.languages.length ? schedule.languages : ["all"]},
        ${schedule.last_run_at || null},
        ${schedule.next_run_at || null}
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;
    if (rows.length) result.schedule.inserted += 1;
    else result.schedule.skipped += 1;
  }

  for (const item of Array.isArray(store.jobs) ? store.jobs : []) {
    const job = normalizeJob(item);
    if (!job.id || !job.schedule_id || !job.run_at) {
      result.jobs.failed += 1;
      continue;
    }
    const rows = await sql`
      INSERT INTO report_generation_jobs (
        id, kind, schedule_id, run_at, status, payload, attempts, max_attempts,
        locked_at, locked_by, last_error, created_at, updated_at, completed_at
      )
      VALUES (
        ${job.id},
        ${job.kind},
        ${job.schedule_id},
        ${job.run_at},
        ${job.status},
        ${JSON.stringify(job.payload)}::jsonb,
        ${job.attempts},
        ${job.max_attempts},
        ${job.locked_at},
        ${job.locked_by},
        ${job.last_error},
        ${job.created_at},
        ${job.updated_at},
        ${job.completed_at}
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;
    if (rows.length) result.jobs.inserted += 1;
    else result.jobs.skipped += 1;
  }

  await resetSequences(sql);
  return result;
}
