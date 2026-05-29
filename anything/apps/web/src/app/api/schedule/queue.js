import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { generateReport } from "../reports/generator.js";
import {
  ensureSchedule,
  getScheduleById,
  listEnabledSchedules,
  markScheduleRan,
} from "../reports/store.js";
import sql, { hasDatabase } from "../utils/sql.js";
import {
  DEFAULT_CRON_TIMES,
  computeNextRunAt,
  normalizeCronTimes,
  normalizeScheduleTimeZone,
  reportDateFromRunAt,
} from "./time.js";

const HAS_DATABASE = hasDatabase;
const STORE_PATH = join(process.cwd(), ".data", "trending-dashboard.json");
const JOB_KIND = "daily_report";

function defaultStore() {
  return {
    nextReportId: 1,
    nextJobId: 1,
    reports: [],
    jobs: [],
    schedule: null,
  };
}

function normalizeJob(job) {
  return {
    id: job.id,
    user_id: job.user_id ?? null,
    kind: job.kind || JOB_KIND,
    schedule_id: job.schedule_id ?? job.scheduleId,
    run_at: job.run_at,
    status: job.status || "scheduled",
    payload: job.payload || {},
    attempts: job.attempts || 0,
    max_attempts: job.max_attempts || 3,
    locked_at: job.locked_at || null,
    locked_by: job.locked_by || null,
    last_error: job.last_error || null,
    created_at: job.created_at || new Date().toISOString(),
    updated_at: job.updated_at || new Date().toISOString(),
    completed_at: job.completed_at || null,
  };
}

async function readStore() {
  try {
    const content = await readFile(STORE_PATH, "utf8");
    return { ...defaultStore(), ...JSON.parse(content) };
  } catch (error) {
    if (error?.code === "ENOENT") return defaultStore();
    throw error;
  }
}

async function writeStore(store) {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

async function mutateStore(mutator) {
  const store = await readStore();
  store.jobs = Array.isArray(store.jobs) ? store.jobs : [];
  store.nextJobId = store.nextJobId || 1;
  const result = await mutator(store);
  await writeStore(store);
  return result;
}

function buildPayload(schedule) {
  const cronTimes = normalizeCronTimes(schedule.cron_times || schedule.cron_time);
  return {
    schedule_id: schedule.id,
    user_id: schedule.user_id ?? null,
    cron_time: cronTimes[0],
    cron_times: cronTimes,
    timezone: normalizeScheduleTimeZone(schedule.timezone),
    languages:
      Array.isArray(schedule.languages) && schedule.languages.length
        ? schedule.languages
        : ["all"],
  };
}

export async function ensureQueueSchema() {
  if (!HAS_DATABASE) return;

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

  await sql`ALTER TABLE report_generation_jobs ADD COLUMN IF NOT EXISTS user_id BIGINT`;

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
}

export async function syncScheduleJob(schedule) {
  await ensureQueueSchema();

  if (!schedule?.id) return null;

  if (HAS_DATABASE) {
    if (!schedule.enabled || !schedule.next_run_at) {
      await sql`
        UPDATE report_generation_jobs
        SET status = 'cancelled',
            updated_at = NOW()
        WHERE kind = ${JOB_KIND}
          AND schedule_id = ${schedule.id}
          AND user_id IS NOT DISTINCT FROM ${schedule.user_id ?? null}
          AND status = 'scheduled'
      `;
      return null;
    }

    const [updated] = await sql`
      UPDATE report_generation_jobs
      SET run_at = ${schedule.next_run_at},
          payload = ${JSON.stringify(buildPayload(schedule))}::jsonb,
          updated_at = NOW()
      WHERE id = (
        SELECT id
        FROM report_generation_jobs
        WHERE kind = ${JOB_KIND}
          AND schedule_id = ${schedule.id}
          AND user_id IS NOT DISTINCT FROM ${schedule.user_id ?? null}
          AND status = 'scheduled'
        ORDER BY run_at ASC, id ASC
        LIMIT 1
      )
      RETURNING *
    `;

    if (updated) return updated;

    const [row] = await sql`
      INSERT INTO report_generation_jobs (user_id, kind, schedule_id, run_at, status, payload)
      VALUES (
        ${schedule.user_id ?? null},
        ${JOB_KIND},
        ${schedule.id},
        ${schedule.next_run_at},
        'scheduled',
        ${JSON.stringify(buildPayload(schedule))}::jsonb
      )
      RETURNING *
    `;
    return row;
  }

  return mutateStore((store) => {
    const now = new Date().toISOString();
    const jobs = store.jobs.map(normalizeJob);

    if (!schedule.enabled || !schedule.next_run_at) {
      store.jobs = jobs.map((job) =>
        job.kind === JOB_KIND &&
        String(job.schedule_id) === String(schedule.id) &&
        String(job.user_id ?? "") === String(schedule.user_id ?? "") &&
        job.status === "scheduled"
          ? { ...job, status: "cancelled", updated_at: now }
          : job,
      );
      return null;
    }

    const existing = jobs.find(
      (job) =>
        job.kind === JOB_KIND &&
        String(job.schedule_id) === String(schedule.id) &&
        String(job.user_id ?? "") === String(schedule.user_id ?? "") &&
        job.status === "scheduled",
    );

    if (existing) {
      const updated = {
        ...existing,
        run_at: schedule.next_run_at,
        payload: buildPayload(schedule),
        updated_at: now,
      };
      store.jobs = jobs.map((job) => (job.id === existing.id ? updated : job));
      return updated;
    }

    const job = normalizeJob({
      id: store.nextJobId++,
      user_id: schedule.user_id ?? null,
      schedule_id: schedule.id,
      run_at: schedule.next_run_at,
      payload: buildPayload(schedule),
      created_at: now,
      updated_at: now,
    });
    store.jobs.push(job);
    return job;
  });
}

export async function bootstrapScheduleJobs() {
  const schedules = await listEnabledSchedules();
  for (const schedule of schedules) {
    await syncScheduleJob(schedule);
  }
  return schedules;
}

async function claimDueScheduleJobs({ limit = 5, workerId } = {}) {
  await ensureQueueSchema();

  if (HAS_DATABASE) {
    return sql`
      WITH due AS (
        SELECT id
        FROM report_generation_jobs
        WHERE kind = ${JOB_KIND}
          AND status = 'scheduled'
          AND run_at <= NOW()
        ORDER BY run_at ASC, id ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE report_generation_jobs jobs
      SET status = 'running',
          attempts = jobs.attempts + 1,
          locked_at = NOW(),
          locked_by = ${workerId},
          updated_at = NOW()
      WHERE jobs.id IN (SELECT id FROM due)
      RETURNING jobs.*
    `;
  }

  return mutateStore((store) => {
    const now = Date.now();
    const jobs = store.jobs.map(normalizeJob);
    const due = jobs
      .filter(
        (job) =>
          job.kind === JOB_KIND &&
          job.status === "scheduled" &&
          new Date(job.run_at).getTime() <= now,
      )
      .sort((a, b) => new Date(a.run_at) - new Date(b.run_at))
      .slice(0, limit)
      .map((job) => job.id);

    const claimed = [];
    store.jobs = jobs.map((job) => {
      if (!due.includes(job.id)) return job;
      const updated = {
        ...job,
        status: "running",
        attempts: job.attempts + 1,
        locked_at: new Date().toISOString(),
        locked_by: workerId,
        updated_at: new Date().toISOString(),
      };
      claimed.push(updated);
      return updated;
    });

    return claimed;
  });
}

async function completeScheduleJob(jobId) {
  if (HAS_DATABASE) {
    await sql`
      UPDATE report_generation_jobs
      SET status = 'completed',
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${jobId}
    `;
    return;
  }

  await mutateStore((store) => {
    store.jobs = store.jobs.map((item) => {
      const job = normalizeJob(item);
      return String(job.id) === String(jobId)
        ? {
            ...job,
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        : job;
    });
  });
}

async function failScheduleJob(job, error) {
  const retry = job.attempts < job.max_attempts;
  const retryAt = new Date(Date.now() + Math.min(job.attempts, 6) * 5 * 60 * 1000);
  const status = retry ? "scheduled" : "failed";
  const errorMessage = String(error.message || error);

  if (HAS_DATABASE) {
    await sql`
      UPDATE report_generation_jobs
      SET status = ${status},
          run_at = CASE WHEN ${retry} THEN ${retryAt.toISOString()}::timestamptz ELSE run_at END,
          locked_at = NULL,
          locked_by = NULL,
          last_error = ${errorMessage},
          updated_at = NOW()
      WHERE id = ${job.id}
    `;
    return;
  }

  await mutateStore((store) => {
    store.jobs = store.jobs.map((item) => {
      const stored = normalizeJob(item);
      return String(stored.id) === String(job.id)
        ? {
            ...stored,
            status,
            run_at: retry ? retryAt.toISOString() : stored.run_at,
            locked_at: null,
            locked_by: null,
            last_error: errorMessage,
            updated_at: new Date().toISOString(),
          }
        : stored;
    });
  });
}

function getJobPayload(job) {
  if (typeof job.payload === "string") {
    try {
      return JSON.parse(job.payload);
    } catch {
      return {};
    }
  }
  return job.payload || {};
}

async function executeScheduleJob(job) {
  const payload = getJobPayload(job);
  const scheduleId = job.schedule_id ?? payload.schedule_id;
  const userId = job.user_id ?? payload.user_id ?? null;
  const schedule = await getScheduleById(scheduleId, userId);

  if (!schedule || !schedule.enabled) {
    await completeScheduleJob(job.id);
    return {
      id: job.id,
      skipped: true,
      reason: "schedule disabled or missing",
    };
  }

  const languages =
    Array.isArray(schedule.languages) && schedule.languages.length
      ? schedule.languages
      : Array.isArray(payload.languages) && payload.languages.length
        ? payload.languages
        : ["all"];

  const timezone = normalizeScheduleTimeZone(schedule.timezone || payload.timezone);
  const reportDate = reportDateFromRunAt(job.run_at, timezone);
  const created = [];

  for (const language of languages) {
    const report = await generateReport({
      userId,
      language,
      user: `trending-dashboard-user-${userId}-schedule-${schedule.id}`,
      reportDate,
    });
    created.push(report.id);
  }

  const nextRunAt = computeNextRunAt(
    schedule.cron_times ||
      payload.cron_times ||
      schedule.cron_time ||
      payload.cron_time ||
      DEFAULT_CRON_TIMES,
    new Date(job.run_at),
    timezone,
  ).toISOString();

  await markScheduleRan({ id: schedule.id, userId, nextRunAt });
  await syncScheduleJob({ ...schedule, next_run_at: nextRunAt });
  await completeScheduleJob(job.id);

  return { id: job.id, created, next_run_at: nextRunAt };
}

export async function runDueScheduleJobsOnce({
  limit = 5,
  workerId = `schedule-worker-${process.pid}`,
} = {}) {
  const jobs = await claimDueScheduleJobs({ limit, workerId });
  const results = [];

  for (const job of jobs) {
    try {
      results.push(await executeScheduleJob(job));
    } catch (error) {
      await failScheduleJob(job, error);
      results.push({
        id: job.id,
        failed: true,
        error: String(error.message || error),
      });
    }
  }

  return { claimed: jobs.length, results };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startScheduleWorker({
  pollMs = Number(process.env.SCHEDULE_WORKER_POLL_MS || 15000),
  limit = Number(process.env.SCHEDULE_WORKER_LIMIT || 5),
  workerId = `schedule-worker-${process.pid}`,
} = {}) {
  let stopped = false;
  const stop = () => {
    stopped = true;
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  await bootstrapScheduleJobs();
  console.log(`schedule worker started (${workerId}), polling every ${pollMs}ms`);

  while (!stopped) {
    const result = await runDueScheduleJobsOnce({ limit, workerId });
    if (result.claimed > 0) {
      console.log(JSON.stringify(result));
    }
    await sleep(pollMs);
  }

  console.log("schedule worker stopped");
}
