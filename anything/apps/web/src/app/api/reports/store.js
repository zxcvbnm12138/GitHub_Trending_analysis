import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import sql from "../utils/sql.js";

const HAS_DATABASE = Boolean(process.env.DATABASE_URL);
const STORE_PATH = join(process.cwd(), ".data", "trending-dashboard.json");

function today() {
  return new Date().toISOString().slice(0, 10);
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

function normalizeLocalReport(report) {
  return {
    id: report.id,
    created_at: report.created_at,
    report_date: report.report_date || report.created_at?.slice(0, 10) || today(),
    language_filter: report.language_filter ?? null,
    status: report.status || "pending",
    summary: report.summary || null,
    error_message: report.error_message || null,
    raw_data: report.raw_data || {},
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
  const result = await mutator(store);
  await writeStore(store);
  return result;
}

export async function createPendingReport(languageFilter) {
  if (HAS_DATABASE) {
    const [row] = await sql`
      INSERT INTO trending_reports (language_filter, status)
      VALUES (${languageFilter}, 'pending')
      RETURNING id
    `;
    return row;
  }

  return mutateStore((store) => {
    const id = store.nextReportId++;
    const now = new Date().toISOString();
    const report = normalizeLocalReport({
      id,
      created_at: now,
      report_date: today(),
      language_filter: languageFilter,
      status: "pending",
      raw_data: {},
    });
    store.reports.push(report);
    return { id };
  });
}

export async function createCompletedReport(languageFilter, summary, rawData) {
  if (HAS_DATABASE) {
    const [row] = await sql`
      INSERT INTO trending_reports (language_filter, status, summary, raw_data)
      VALUES (${languageFilter}, 'completed', ${summary}, ${JSON.stringify(rawData)}::jsonb)
      RETURNING id
    `;
    return row;
  }

  return mutateStore((store) => {
    const id = store.nextReportId++;
    const now = new Date().toISOString();
    const report = normalizeLocalReport({
      id,
      created_at: now,
      report_date: today(),
      language_filter: languageFilter,
      status: "completed",
      summary,
      raw_data: rawData,
    });
    store.reports.push(report);
    return { id };
  });
}

export async function findReportForDate(languageFilter, reportDate = today()) {
  if (HAS_DATABASE) {
    const [row] = await sql`
      SELECT id, status, report_date, language_filter
      FROM trending_reports
      WHERE report_date = ${reportDate}
        AND language_filter IS NOT DISTINCT FROM ${languageFilter}
        AND status IN ('pending', 'completed')
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return row || null;
  }

  const store = await readStore();
  return (
    store.reports
      .map(normalizeLocalReport)
      .filter(
        (report) =>
          report.report_date === reportDate &&
          report.language_filter === languageFilter &&
          ["pending", "completed"].includes(report.status),
      )
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] ||
    null
  );
}

export async function updateReportCompleted(id, summary, rawData) {
  if (HAS_DATABASE) {
    await sql`
      UPDATE trending_reports
      SET status = 'completed',
          summary = ${summary},
          raw_data = ${JSON.stringify(rawData)}::jsonb
      WHERE id = ${id}
    `;
    return;
  }

  await mutateStore((store) => {
    const report = store.reports.find((item) => item.id === id);
    if (!report) return;
    report.status = "completed";
    report.summary = summary;
    report.raw_data = rawData;
    report.error_message = null;
  });
}

export async function updateReportFailed(id, errorMessage) {
  if (HAS_DATABASE) {
    await sql`
      UPDATE trending_reports
      SET status = 'failed',
          error_message = ${errorMessage}
      WHERE id = ${id}
    `;
    return;
  }

  await mutateStore((store) => {
    const report = store.reports.find((item) => item.id === id);
    if (!report) return;
    report.status = "failed";
    report.error_message = errorMessage;
  });
}

export async function listReports({ language, limit = 100 } = {}) {
  if (HAS_DATABASE) {
    if (language && language !== "all") {
      return sql`
        SELECT id, created_at, report_date, language_filter, status, summary, error_message,
               raw_data->'top_repos' AS top_repos
        FROM trending_reports
        WHERE language_filter = ${language}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    return sql`
      SELECT id, created_at, report_date, language_filter, status, summary, error_message,
             raw_data->'top_repos' AS top_repos
      FROM trending_reports
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }

  const store = await readStore();
  return store.reports
    .map(normalizeLocalReport)
    .filter((report) => !language || language === "all" || report.language_filter === language)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit)
    .map((report) => ({
      id: report.id,
      created_at: report.created_at,
      report_date: report.report_date,
      language_filter: report.language_filter,
      status: report.status,
      summary: report.summary,
      error_message: report.error_message,
      top_repos: Array.isArray(report.raw_data?.top_repos) ? report.raw_data.top_repos : null,
    }));
}

export async function getReport(id) {
  if (HAS_DATABASE) {
    const [row] = await sql`SELECT * FROM trending_reports WHERE id = ${id}`;
    return row || null;
  }

  const store = await readStore();
  const report = store.reports.find((item) => item.id === id);
  return report ? normalizeLocalReport(report) : null;
}

export async function deleteReport(id) {
  if (HAS_DATABASE) {
    await sql`DELETE FROM trending_reports WHERE id = ${id}`;
    return;
  }

  await mutateStore((store) => {
    store.reports = store.reports.filter((item) => item.id !== id);
  });
}

export async function getStats() {
  if (HAS_DATABASE) {
    const [totals] = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS this_week,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days')::int AS last_week
      FROM trending_reports
    `;

    const langRows = await sql`
      SELECT COALESCE(language_filter, 'all') AS language, COUNT(*)::int AS count
      FROM trending_reports
      GROUP BY COALESCE(language_filter, 'all')
      ORDER BY count DESC
      LIMIT 1
    `;

    const schedule = await getSchedule();
    return buildStats(totals, langRows[0]?.language || "—", schedule);
  }

  const store = await readStore();
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const reports = store.reports.map(normalizeLocalReport);
  const thisWeek = reports.filter((report) => now - new Date(report.created_at).getTime() <= sevenDays).length;
  const lastWeek = reports.filter((report) => {
    const age = now - new Date(report.created_at).getTime();
    return age > sevenDays && age <= sevenDays * 2;
  }).length;
  const counts = new Map();
  for (const report of reports) {
    const language = report.language_filter || "all";
    counts.set(language, (counts.get(language) || 0) + 1);
  }
  const topLanguage = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  return buildStats(
    { total: reports.length, this_week: thisWeek, last_week: lastWeek },
    topLanguage,
    await ensureSchedule(),
  );
}

function buildStats(totals, topLanguage, schedule) {
  let weekDelta = 0;
  if (totals.last_week > 0) {
    weekDelta = Math.round(((totals.this_week - totals.last_week) / totals.last_week) * 100);
  } else if (totals.this_week > 0) {
    weekDelta = 100;
  }

  return {
    total: totals.total,
    this_week: totals.this_week,
    last_week: totals.last_week,
    week_delta: weekDelta,
    week_percent: Math.min(
      100,
      Math.max(
        0,
        totals.this_week
          ? Math.round((totals.this_week / Math.max(totals.this_week + totals.last_week, 1)) * 100)
          : 0,
      ),
    ),
    top_language: topLanguage,
    next_run_at: schedule?.next_run_at || null,
    schedule_enabled: schedule?.enabled || false,
  };
}

function defaultSchedule() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return {
    id: 1,
    enabled: false,
    cron_time: "09:00",
    languages: ["all"],
    last_run_at: null,
    next_run_at: next.toISOString(),
  };
}

export async function ensureSchedule() {
  if (HAS_DATABASE) {
    const [row] = await sql`SELECT * FROM report_schedules ORDER BY id ASC LIMIT 1`;
    if (row) return row;
    const [created] = await sql`
      INSERT INTO report_schedules (enabled, cron_time, languages, next_run_at)
      VALUES (false, '09:00', ARRAY['all']::text[], NOW() + INTERVAL '1 day')
      RETURNING *
    `;
    return created;
  }

  return mutateStore((store) => {
    if (!store.schedule) store.schedule = defaultSchedule();
    return store.schedule;
  });
}

export async function getSchedule() {
  if (HAS_DATABASE) {
    const [row] = await sql`SELECT * FROM report_schedules ORDER BY id ASC LIMIT 1`;
    return row || null;
  }
  return ensureSchedule();
}

export async function getScheduleById(id) {
  if (HAS_DATABASE) {
    const [row] = await sql`SELECT * FROM report_schedules WHERE id = ${id}`;
    return row || null;
  }

  const store = await readStore();
  const schedule = store.schedule || defaultSchedule();
  return String(schedule.id) === String(id) ? schedule : null;
}

export async function updateSchedule({ id, enabled, cronTime, languages, nextRunAt }) {
  if (HAS_DATABASE) {
    const [updated] = await sql`
      UPDATE report_schedules
      SET enabled = ${enabled},
          cron_time = ${cronTime},
          languages = ${languages},
          next_run_at = ${nextRunAt}
      WHERE id = ${id}
      RETURNING *
    `;
    return updated;
  }

  return mutateStore((store) => {
    if (!store.schedule) store.schedule = defaultSchedule();
    store.schedule = {
      ...store.schedule,
      enabled,
      cron_time: cronTime,
      languages,
      next_run_at: nextRunAt,
    };
    return store.schedule;
  });
}

export async function markScheduleRan({ id, nextRunAt }) {
  if (HAS_DATABASE) {
    await sql`
      UPDATE report_schedules
      SET last_run_at = NOW(), next_run_at = ${nextRunAt}
      WHERE id = ${id}
    `;
    return;
  }

  await mutateStore((store) => {
    if (!store.schedule) store.schedule = defaultSchedule();
    store.schedule.last_run_at = new Date().toISOString();
    store.schedule.next_run_at = nextRunAt;
  });
}
